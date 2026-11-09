// Signals: 24-hour photo or text posts, shared with everyone you're connected to on Orbit.
// Data lives in Supabase (signals, signal_views, signal_reactions, connections); photos in a private bucket.
(function(){
const REACTS=['❤️','🔥','😂','😮','🙏'];
const BGS=[['#E9B44C','#1A1830'],['#6050C2','#FFFFFF'],['#1D8577','#FFFFFF'],['#C4553A','#FFFFFF'],['#1A1830','#FFFFFF']];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ini=n=>String(n||'?').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();
const hue=s=>{let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))>>>0;return h%360};
const ago=t=>{const m=Math.round((Date.now()-new Date(t))/6e4);return m<1?'just now':m<60?m+'m':Math.round(m/60)+'h'};
const left=t=>{const h=Math.max(0,Math.round((new Date(t)-Date.now())/36e5));return h<1?'under an hour left':h+'h left'};
let feed=[],conns=[],urls={},me=null,busy=false,lastLoad=0;
const sb=()=>window.orbitSB;

async function load(force){if(busy||(!force&&Date.now()-lastLoad<20000))return;busy=true;
  try{if(!me){const {data}=await sb().auth.getUser();me=data.user&&data.user.id}
    const [f,c]=await Promise.all([sb().rpc('signal_feed'),sb().rpc('my_connections')]);
    if(!f.error)feed=f.data||[];if(!c.error)conns=c.data||[];
    const need=feed.flatMap(g=>g.signals).filter(s=>s.photo_path&&!urls[s.photo_path]).map(s=>s.photo_path);
    if(need.length){const {data}=await sb().storage.from('signals').createSignedUrls(need,3600);(data||[]).forEach(d=>{if(d.signedUrl)urls[d.path]=d.signedUrl})}
    lastLoad=Date.now();paint()}catch(e){console.error('signals',e)}finally{busy=false}}

function avatar(name,id,size,photo){const u=photo&&window.ORBIT_USER_PHOTO?ORBIT_USER_PHOTO(id,photo):'';if(u)return `<img class="sg-av" src="${esc(u)}" alt="" style="width:${size}px;height:${size}px;object-fit:cover">`;return `<span class="sg-av" style="width:${size}px;height:${size}px;font-size:${Math.round(size*.36)}px;background:hsl(${hue(id)} 45% 55%)">${esc(ini(name))}</span>`}
function paint(){const el=document.getElementById('signalRow');if(!el)return;
  const mine=feed.find(g=>g.me),others=feed.filter(g=>!g.me),pending=conns.filter(c=>c.status==='pending'&&c.direction==='in').length,connected=conns.filter(c=>c.status==='accepted').length;
  el.innerHTML=`<section class="sg-row" aria-label="Signals">
   <div class="sg-head"><h2>Signals</h2><button type="button" class="sg-conn" data-sg="conns" aria-label="Connections${pending?`, ${pending} new request${pending>1?'s':''}`:''}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M17 8v6M14 11h6"/></svg>${connected?`<span>${connected}</span>`:''}${pending?`<i>${pending}</i>`:''}</button></div>
   <div class="sg-strip">
    <button type="button" class="sg-item" data-sg="${mine?'view':'compose'}" data-uid="${mine?esc(me):''}"><span class="sg-ring ${mine?'seen':'none'}">${avatar(mine?mine.name:((window.orbitMe&&orbitMe().name)||'You'),me||'me',58,mine?mine.photo:(window.orbitMe&&orbitMe().photo))}</span>${mine?'':'<b class="sg-plus">+</b>'}<small>${mine?'Your signal':'Add signal'}</small></button>
    ${mine?`<button type="button" class="sg-item" data-sg="compose"><span class="sg-ring none"><span class="sg-av sg-addav">+</span></span><small>Add</small></button>`:''}
    ${others.map(g=>`<button type="button" class="sg-item" data-sg="view" data-uid="${esc(g.user_id)}"><span class="sg-ring ${g.unseen?'new':'seen'}">${avatar(g.name,g.user_id,58,g.photo)}</span><small>${esc(g.short)}</small></button>`).join('')}
    ${!others.length?`<div class="sg-empty">${connected?'No signals from your people right now.':'Connect with friends on Orbit to see their signals here.'}<button type="button" data-sg="conns">${connected?'Connections':'Connect or invite'}</button></div>`:''}
   </div></section>`}

// ---------- sheets ----------
function sheet(html,cls){closeSheet();const d=document.createElement('div');d.className='sg-sheet '+(cls||'');d.id='sgSheet';d.innerHTML=`<div class="sg-panel" role="dialog" aria-modal="true">${html}</div>`;
  d.addEventListener('click',e=>{if(e.target===d||e.target.closest('[data-sg="close"]'))closeSheet()});document.body.appendChild(d);return d}
function closeSheet(){const d=document.getElementById('sgSheet');if(d)d.remove()}
const toast=m=>{let t=document.getElementById('sgToast');if(!t){t=document.createElement('div');t.id='sgToast';t.className='sg-toast';document.body.appendChild(t)}t.textContent=m;t.classList.add('on');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('on'),2200)};

// compose
let draft={kind:'text',bg:0,file:null,preview:null};
function compose(){const b=BGS[draft.bg];const d=sheet(`<div class="sg-top"><h3>New signal</h3><button type="button" class="sg-x" data-sg="close" aria-label="Close">✕</button></div>
  <div class="sg-tabs" role="tablist"><button type="button" role="tab" aria-selected="${draft.kind==='text'}" data-kind="text">Text</button><button type="button" role="tab" aria-selected="${draft.kind==='photo'}" data-kind="photo">Photo</button></div>
  ${draft.kind==='text'?`<div class="sg-card" style="background:${b[0]};color:${b[1]}"><textarea id="sgText" maxlength="280" placeholder="What’s happening?" style="color:${b[1]}" aria-label="Your signal"></textarea></div>
    <div class="sg-bgs">${BGS.map((x,i)=>`<button type="button" data-bg="${i}" aria-label="Background ${i+1}" aria-pressed="${i===draft.bg}" style="background:${x[0]}"></button>`).join('')}</div>`
  :`<label class="sg-pick">${draft.preview?`<img src="${draft.preview}" alt="Your photo">`:'<span>Choose a photo or take one</span>'}<input type="file" id="sgFile" accept="image/*"></label>
    <input id="sgCaption" class="sg-input" maxlength="200" placeholder="Add a caption (optional)">`}
  <p class="sg-note">Visible to everyone you’re connected to for 24 hours, then it’s deleted.</p>
  <p class="sg-msg" role="status"></p>
  <button type="button" class="sg-cta" id="sgPost">Share signal</button>`);
  d.querySelectorAll('[data-kind]').forEach(x=>x.onclick=()=>{draft.kind=x.dataset.kind;compose()});
  d.querySelectorAll('[data-bg]').forEach(x=>x.onclick=()=>{const t=(d.querySelector('#sgText')||{}).value||'';draft.bg=+x.dataset.bg;compose();d.ownerDocument.getElementById('sgText').value=t});
  const f=d.querySelector('#sgFile');if(f)f.onchange=async()=>{const file=f.files[0];if(!file)return;draft.file=await shrink(file);draft.preview=URL.createObjectURL(draft.file);compose()};
  d.querySelector('#sgPost').onclick=post;
  const ta=d.querySelector('#sgText');if(ta)setTimeout(()=>ta.focus(),60)}
function shrink(file){return new Promise(res=>{const img=new Image();img.onload=()=>{const s=Math.min(1,1440/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);c.getContext('2d').drawImage(img,0,0,c.width,c.height);c.toBlob(b=>res(b||file),'image/jpeg',.85)};img.onerror=()=>res(file);img.src=URL.createObjectURL(file)})}
async function post(){const d=document.getElementById('sgSheet'),msg=d.querySelector('.sg-msg'),btn=d.querySelector('#sgPost');
  try{let row;if(draft.kind==='text'){const t=d.querySelector('#sgText').value.trim();if(!t){msg.textContent='Write something first.';return}row={kind:'text',body:t,bg:BGS[draft.bg][0]}}
    else{if(!draft.file){msg.textContent='Choose a photo first.';return}btn.disabled=true;btn.textContent='Uploading…';
      const path=`${me}/${crypto.randomUUID()}.jpg`;const up=await sb().storage.from('signals').upload(path,draft.file,{contentType:'image/jpeg'});if(up.error)throw up.error;
      row={kind:'photo',photo_path:path,body:d.querySelector('#sgCaption').value.trim()||null}}
    btn.disabled=true;btn.textContent='Sharing…';const {error}=await sb().from('signals').insert(row);if(error)throw error;
    draft={kind:'text',bg:draft.bg,file:null,preview:null};closeSheet();toast('Signal shared');load(true)}
  catch(e){btn.disabled=false;btn.textContent='Share signal';msg.textContent='Couldn’t share: '+(e.message||e)}}

// viewer
let V=null;
function view(uid){const gi=feed.findIndex(g=>g.user_id===uid);if(gi<0)return;const g=feed[gi];let i=g.me?0:Math.max(0,g.signals.findIndex(s=>!s.seen));V={gi,i};show()}
function show(){clearTimeout(V&&V.t);const g=feed[V.gi],s=g&&g.signals[V.i];if(!s){closeView();return}
  let el=document.getElementById('sgView');if(!el){el=document.createElement('div');el.id='sgView';el.className='sg-view';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');document.body.appendChild(el)}
  const b=BGS.find(x=>x[0]===s.bg)||BGS[0];
  el.innerHTML=`<div class="sg-bars">${g.signals.map((x,k)=>`<i class="${k<V.i?'done':k===V.i?'now':''}" style="--d:${s.kind==='photo'?7:6}s"></i>`).join('')}</div>
   <div class="sg-vhead">${avatar(g.name,g.user_id,36,g.photo)}<div><b>${g.me?'Your signal':esc(g.name)}</b><small>${ago(s.created_at)} · ${left(s.expires_at)}</small></div><button type="button" class="sg-x" data-v="close" aria-label="Close">✕</button></div>
   <div class="sg-stage" data-v="tap">${s.kind==='photo'?`<img src="${esc(urls[s.photo_path]||'')}" alt="${esc(s.body||'Photo signal')}">${s.body?`<p class="sg-cap">${esc(s.body)}</p>`:''}`:`<div class="sg-textcard" style="background:${b[0]};color:${b[1]}"><p>${esc(s.body)}</p></div>`}</div>
   <div class="sg-foot">${g.me?`<button type="button" class="sg-seen" data-v="seen">Seen by ${s.views?s.views.length:0}${s.views&&s.views.some(v=>v.reaction)?' · '+s.views.filter(v=>v.reaction).map(v=>v.reaction).join(''):''}</button><button type="button" class="sg-ghost" data-v="del">Delete</button>`
     :`<div class="sg-reacts">${REACTS.map(r=>`<button type="button" data-react="${r}" aria-label="React ${r}" aria-pressed="${s.my_reaction===r}">${r}</button>`).join('')}</div><button type="button" class="sg-ghost" data-v="more" aria-label="More options">⋯</button>`}</div>`;
  if(!g.me&&!s.seen){s.seen=true;g.unseen=Math.max(0,(g.unseen||1)-1);sb().from('signal_views').insert({signal_id:s.id}).then(()=>{},()=>{})}
  V.t=setTimeout(next,s.kind==='photo'?7000:6000)}
function next(){const g=feed[V.gi];if(V.i<g.signals.length-1){V.i++;show()}else if(V.gi<feed.length-1&&!feed[V.gi+1].me){V.gi++;V.i=0;show()}else closeView()}
function prev(){if(V.i>0){V.i--;show()}}
function closeView(){if(V)clearTimeout(V.t);V=null;const el=document.getElementById('sgView');if(el)el.remove();paint()}
document.addEventListener('click',async e=>{const v=document.getElementById('sgView');if(!v||!v.contains(e.target))return;const t=e.target.closest('[data-v],[data-react]');if(!t)return;
  const g=feed[V.gi],s=g.signals[V.i];
  if(t.dataset.react){clearTimeout(V.t);const r=t.dataset.react,same=s.my_reaction===r;s.my_reaction=same?null:r;
    if(same)await sb().from('signal_reactions').delete().eq('signal_id',s.id);else await sb().from('signal_reactions').upsert({signal_id:s.id,emoji:r});
    toast(same?'Reaction removed':'Sent '+r);show();return}
  const a=t.dataset.v;
  if(a==='close')return closeView();
  if(a==='tap'){const x=e.clientX/window.innerWidth;x<.3?prev():next();return}
  if(a==='seen'){clearTimeout(V.t);sheet(`<div class="sg-top"><h3>Seen by ${s.views.length}</h3><button type="button" class="sg-x" data-sg="close" aria-label="Close">✕</button></div>${s.views.length?`<ul class="sg-list">${s.views.map(w=>`<li><span class="sg-who">${avatar(w.name,w.user_id||w.name,34,w.photo)}${esc(w.name)}</span><span>${w.reaction?esc(w.reaction)+' ':''}<small>${ago(w.at)}</small></span></li>`).join('')}</ul>`:'<p class="sg-note">Nobody yet.</p>'}`,'sg-top-layer');return}
  if(a==='del'){clearTimeout(V.t);if(!confirm('Delete this signal?')){show();return}if(s.photo_path)await sb().storage.from('signals').remove([s.photo_path]);await sb().from('signals').delete().eq('id',s.id);toast('Signal deleted');closeView();load(true);return}
  if(a==='more'){clearTimeout(V.t);const d=sheet(`<div class="sg-top"><h3>${esc(g.name)}</h3><button type="button" class="sg-x" data-sg="close" aria-label="Close">✕</button></div>
     <button type="button" class="sg-row-btn" id="sgReport">Report this signal</button><button type="button" class="sg-row-btn danger" id="sgBlock">Block ${esc(g.short)}</button>
     <p class="sg-note">Reports go to the Orbit team. Blocking removes the connection and hides their signals, and they won’t see yours.</p>`,'sg-top-layer');
    d.querySelector('#sgReport').onclick=async()=>{const why=prompt('What’s wrong with this signal? (optional)')||'';await sb().rpc('report_signal',{p_signal:s.id,p_reason:why});closeSheet();toast('Reported. You won’t see it again');closeView();load(true)};
    d.querySelector('#sgBlock').onclick=async()=>{if(!confirm(`Block ${g.name}? You won’t see each other’s signals.`))return;await sb().rpc('block_user',{p_other:g.user_id});closeSheet();toast('Blocked');closeView();load(true)}}
});

// connections
function connsSheet(){const inc=conns.filter(c=>c.status==='pending'&&c.direction==='in'),out=conns.filter(c=>c.status==='pending'&&c.direction==='out'),ok=conns.filter(c=>c.status==='accepted');
  const d=sheet(`<div class="sg-top"><h3>Connections</h3><button type="button" class="sg-x" data-sg="close" aria-label="Close">✕</button></div>
   <form class="sg-connect" id="sgReq"><label for="sgWho">Connect with someone on Orbit</label><div><input id="sgWho" class="sg-input" placeholder="Their email or invite code" autocomplete="off" autocapitalize="off"><button type="submit">Send</button></div><p class="sg-msg" role="status"></p></form>
   ${inc.length?`<h4>Requests</h4><ul class="sg-list">${inc.map(c=>`<li><span class="sg-who">${avatar(c.name,c.user_id,34,c.photo)}${esc(c.name)}</span><span class="sg-acts"><button type="button" data-acc="${esc(c.user_id)}" class="sg-mini primary">Accept</button><button type="button" data-dec="${esc(c.user_id)}" class="sg-mini">Decline</button></span></li>`).join('')}</ul>`:''}
   <h4>Connected <small>${ok.length}</small></h4>${ok.length?`<ul class="sg-list">${ok.map(c=>`<li><span class="sg-who">${avatar(c.name,c.user_id,34,c.photo)}${esc(c.name)}${c.source==='invite'?' <small>joined with an invite</small>':''}</span><span class="sg-acts"><button type="button" data-rm="${esc(c.user_id)}" class="sg-mini">Remove</button></span></li>`).join('')}</ul>`:'<p class="sg-note">Nobody yet. Friends who join with your invite code connect automatically.</p>'}
   ${out.length?`<h4>Waiting on them</h4><ul class="sg-list">${out.map(c=>`<li><span class="sg-who">${avatar(c.name,c.user_id,34,c.photo)}${esc(c.name)}</span><small>Request sent</small></li>`).join('')}</ul>`:''}
   <button type="button" class="sg-ghost wide" data-orbit="invite">Invite someone new</button>`,'');
  d.querySelector('#sgReq').onsubmit=async e=>{e.preventDefault();const v=d.querySelector('#sgWho').value.trim(),m=d.querySelector('#sgReq .sg-msg');if(!v)return;
    const r=await sb().rpc('request_connection',v.includes('@')?{p_email:v}:{p_code:v});const x=r.data||{};
    m.textContent=r.error?'Something went wrong. Try again.':!x.ok?(x.reason==='self'?'That’s you.':'Nobody on Orbit with that email or code yet. Send them an invite.'):x.status==='accepted'?`You’re connected with ${x.name}.`:`Request sent to ${x.name}. They need to accept.`;
    if(x.ok){await load(true);setTimeout(connsSheet,1200)}};
  d.addEventListener('click',async e=>{const a=e.target.closest('[data-acc],[data-dec],[data-rm]');if(!a)return;const id=a.dataset.acc||a.dataset.dec||a.dataset.rm;
    if(a.dataset.rm&&!confirm('Remove this connection? You’ll stop seeing each other’s signals.'))return;
    await sb().rpc('respond_connection',{p_other:id,p_accept:!!a.dataset.acc});toast(a.dataset.acc?'Connected':'Done');await load(true);connsSheet()})}

document.addEventListener('click',e=>{const t=e.target.closest('[data-sg]');if(!t)return;const a=t.dataset.sg;
  if(a==='compose'){e.preventDefault();compose()}else if(a==='view'){e.preventDefault();view(t.dataset.uid)}else if(a==='conns'){e.preventDefault();connsSheet()}});
// fill the row whenever Home renders, refresh now and then
new MutationObserver(()=>{const el=document.getElementById('signalRow');if(el&&!el.firstChild){paint();load(false)}}).observe(document.body,{childList:true,subtree:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load(true)});
setInterval(()=>{if(!document.hidden&&document.getElementById('signalRow'))load(true)},90000);
window.addEventListener('orbit-me',()=>{paint();load(true)});
window.claude.use('db').then(()=>load(true));
})();
