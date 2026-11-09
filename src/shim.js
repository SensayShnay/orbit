// Orbit standalone runtime: gives the app the same db / sample / assets / downloads
// interface it had inside Claude, backed by Supabase.
(function(){
const C=window.ORBIT_CONFIG, sb=window.supabase.createClient(C.url,C.anonKey,{auth:{persistSession:true,autoRefreshToken:true}});
window.orbitSB=sb;
let uid=null, readyRes; const ready=new Promise(r=>readyRes=r);
const BLOB_BASE=()=>`${C.url}/storage/v1/object/public/photos/${uid}/`;
window.ORBIT_BLOB=id=>BLOB_BASE()+id+'.jpg';

// ---------- sign in and first-run setup (src/onboard.js) ----------
const whenDom=f=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',f):f();
async function afterLogin(){
  const OB=window.OrbitOnboard;
  try{const code=localStorage.getItem('orbit-invite');if(code){await sb.rpc('redeem_invite',{p_code:code});localStorage.removeItem('orbit-invite')}}catch(_){}
  try{if(OB&&await OB.needs(sb,uid))await new Promise(r=>whenDom(()=>OB.run(sb,uid).then(r)))}catch(e){console.error(e)}
  if(OB)OB.close();readyRes()}
sb.auth.onAuthStateChange((ev,session)=>{
  if(session&&session.user){if(!uid){uid=session.user.id;setTimeout(afterLogin,0)}}
  else if(ev==='SIGNED_OUT'){location.reload()}
  else if(!uid){whenDom(()=>window.OrbitOnboard&&window.OrbitOnboard.startSignedOut(sb))}});
window.orbitSignOut=()=>sb.auth.signOut();

// ---------- db ----------
const T='docs', listeners=new Map(), cache=new Map(); // coll -> Map(id -> data)
function emit(coll){const m=cache.get(coll);if(!m)return;const docs=[...m].map(([id,d])=>({id,data:()=>d,exists:true}));(listeners.get(coll)||[]).forEach(cb=>{try{cb({docs,size:docs.length})}catch(e){console.error(e)}})}
function local(coll,id,data){const m=cache.get(coll);if(!m)return;data===null?m.delete(id):m.set(id,data);emit(coll)}
const split=p=>{const i=p.lastIndexOf('/');return [p.slice(0,i),p.slice(i+1)]};
const err=(e)=>{const x=new Error(e.message||'error');x.code=e.code||'unavailable';return x};
function strip(o){if(o&&typeof o==='object'&&!Array.isArray(o)){const r={};for(const[k,v]of Object.entries(o)){if(v&&typeof v==='object'&&v.__delete__)continue;r[k]=strip(v)}return r}return o}
async function loadColl(coll){const m=new Map();let from=0;for(;;){const {data,error}=await sb.from(T).select('id,data').eq('coll',coll).range(from,from+999);if(error)throw err(error);data.forEach(r=>m.set(r.id,r.data));if(data.length<1000)break;from+=1000}return m}
let chan=null;
function realtime(){if(chan)return;chan=sb.channel('docs-'+uid).on('postgres_changes',{event:'*',schema:'public',table:T,filter:`user_id=eq.${uid}`},pl=>{
  const row=pl.new&&pl.new.coll?pl.new:pl.old;if(!row||!row.coll)return;const m=cache.get(row.coll);if(!m)return;
  if(pl.eventType==='DELETE')m.delete(row.id);else m.set(row.id,pl.new.data);emit(row.coll)}).subscribe()}
const db={
  collection(coll){return {
    onSnapshot(cb,onErr){(listeners.get(coll)||listeners.set(coll,[]).get(coll)).push(cb);
      if(cache.has(coll))emit(coll);else loadColl(coll).then(m=>{cache.set(coll,m);emit(coll);realtime()}).catch(e=>onErr&&onErr(e));
      return ()=>{const a=listeners.get(coll)||[];a.splice(a.indexOf(cb),1)}},
    doc(id){return db.doc(coll+'/'+id)},
    async get(){const m=await loadColl(coll);return {docs:[...m].map(([id,d])=>({id,data:()=>d,exists:true}))}}}},
  doc(path){const [coll,id]=split(path);return {
    async get(){const {data,error}=await sb.from(T).select('data').eq('coll',coll).eq('id',id).maybeSingle();if(error)throw err(error);return {id,exists:!!data,data:()=>data?data.data:undefined}},
    async set(d){d=strip(d);local(coll,id,d);const {error}=await sb.from(T).upsert({user_id:uid,coll,id,data:d,updated_at:new Date().toISOString()});if(error)throw err(error)},
    async update(patch){const m=cache.get(coll);if(m&&m.has(id)){const n={...m.get(id)};for(const[k,v]of Object.entries(patch)){if(v&&typeof v==='object'&&v.__delete__)delete n[k];else n[k]=v}local(coll,id,n)}
      const {error}=await sb.rpc('doc_update',{p_coll:coll,p_id:id,p_patch:patch});if(error)throw err(error)},
    async delete(){local(coll,id,null);const {error}=await sb.from(T).delete().eq('coll',coll).eq('id',id);if(error)throw err(error)}}}};

// ---------- sample (Claude via your Supabase function) ----------
async function sample(input,opts={}){const {data,error}=await sb.functions.invoke(C.aiFunction||'ai',{body:{input,system:opts.system,modelTier:opts.modelTier}});
  if(error){let code='unavailable';try{const b=await error.context.json();code=b.code||code}catch(_){}const e=new Error(error.message);e.code=code;throw e}
  const text=data.text||'';if(opts.onText)opts.onText({text,delta:text});return {text,truncated:!!data.truncated}}
sample.json=async(input,opts)=>{const r=await sample(input,opts);const m=r.text.match(/[\[{][\s\S]*[\]}]/);return JSON.parse(m?m[0]:r.text)};
sample.limits=async()=>({images:false});

// ---------- assets (photos in Supabase Storage) ----------
const hex=()=>[...crypto.getRandomValues(new Uint8Array(16))].map(b=>b.toString(16).padStart(2,'0')).join('');
const assets={async upload(blob){const id=hex();const {error}=await sb.storage.from('photos').upload(`${uid}/${id}.jpg`,blob,{contentType:blob.type||'image/jpeg',upsert:false});if(error)throw err(error);return {id,url:window.ORBIT_BLOB(id),sizeBytes:blob.size,contentType:blob.type}},
  async delete(id){await sb.storage.from('photos').remove([`${uid}/${id}.jpg`])},
  async list(){const {data}=await sb.storage.from('photos').list(uid,{limit:1000});return {assets:(data||[]).map(f=>({id:f.name.replace(/\.jpg$/,''),url:window.ORBIT_BLOB(f.name.replace(/\.jpg$/,''))})),usage:{}}}};

// ---------- downloads (share sheet on iPhone, normal download on web) ----------
const downloads={async save({filename,data}){const Cap=window.Capacitor,P=Cap&&Cap.Plugins;
  if(Cap&&Cap.isNativePlatform&&Cap.isNativePlatform()&&P.Filesystem&&P.Share){const text=typeof data==='string'?data:await new Response(data).text();
    const w=await P.Filesystem.writeFile({path:filename,data:text,directory:'CACHE',encoding:'utf8'});await P.Share.share({title:filename,url:w.uri});return {saved:true}}
  const blob=data instanceof Blob?data:new Blob([data],{type:'text/plain'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);return {saved:true}}};

const NS={db,sample,assets,downloads};
window.claude={use:async name=>{if(!(name in NS))return null;await ready;return NS[name]}};
})();
