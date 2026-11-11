// Standalone-only extras: sign out and restore from a full backup file.
document.addEventListener('click',async e=>{
  const t=e.target.closest('[data-orbit]');if(!t)return;
  if(t.dataset.orbit==='delete'){if(!confirm('Delete your Orbit account? Every person, note, photo and setting will be erased. This can’t be undone.'))return;if(prompt('Type DELETE to confirm')!=='DELETE')return;
    t.disabled=true;t.textContent='Deleting…';const sb=window.orbitSB,{data:{user}}=await sb.auth.getUser();
    for(const bucket of ['photos','signals']){try{for(let i=0;i<20;i++){const {data:files}=await sb.storage.from(bucket).list(user.id,{limit:1000});if(!files||!files.length)break;await sb.storage.from(bucket).remove(files.map(f=>user.id+'/'+f.name));if(files.length<1000)break}}catch(_){}}
    const {error}=await sb.rpc('delete_my_account');if(error){alert('Couldn’t delete: '+error.message);t.disabled=false;t.textContent='Delete my account';return}
    try{localStorage.clear()}catch(_){}await sb.auth.signOut();location.reload();return}
  if(t.dataset.orbit==='signout'){if(confirm('Sign out of Orbit on this device?'))window.orbitSignOut();return}
  if(t.dataset.orbit==='restore'){const inp=document.createElement('input');inp.type='file';inp.accept='.json,application/json';
    inp.onchange=async()=>{const f=inp.files[0];if(!f)return;let dump;try{dump=JSON.parse(await f.text())}catch(_){alert('That file isn’t a valid backup.');return}
      const sb=window.orbitSB,{data:{user}}=await sb.auth.getUser();const rows=[];
      for(const [coll,docs] of Object.entries(dump.collections||{}))for(const [id,data] of Object.entries(docs))rows.push({user_id:user.id,coll,id,data,updated_at:new Date().toISOString()});
      if(!rows.length){alert('No records found in that file.');return}
      const ph=Object.entries(dump.photos||{});
      if(!confirm(`Restore ${rows.length} records${ph.length?` and ${ph.length} photos`:''} into this account? Matching records get replaced.`))return;
      t.disabled=true;for(let i=0;i<rows.length;i+=200){t.textContent=`Restoring ${Math.min(i+200,rows.length)} of ${rows.length}…`;const {error}=await sb.from('docs').upsert(rows.slice(i,i+200));if(error){alert('Restore stopped: '+error.message);t.disabled=false;t.textContent='Restore from backup';return}}
      for(let i=0;i<ph.length;i++){const [id,b64]=ph[i];t.textContent=`Photo ${i+1} of ${ph.length}…`;const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));await sb.storage.from('photos').upload(`${user.id}/${id}.jpg`,new Blob([bin],{type:'image/jpeg'}),{contentType:'image/jpeg',upsert:true})}
      location.reload()};inp.click()}});

// ---------- invites (trackable: each person has a code; joins are counted in Supabase) ----------
let myInvite=null;
async function getInvite(){if(myInvite)return myInvite;const {data,error}=await window.orbitSB.rpc('my_invite');if(error)throw error;myInvite=data;return data}
function inviteText(code,name){const url=(window.ORBIT_CONFIG||{}).inviteUrl;
  return `${name?`Hey ${name}! `:''}I’ve been using Orbit to stay close to the people who matter, and I think you’d like it.${url?` Get it here: ${url}`:''} Use my invite code ${code} when you sign up.`}
async function shareInvite(name,phone){let inv;try{inv=await getInvite()}catch(e){alert('Couldn’t get your invite code just now.');return}
  const text=inviteText(inv.code,name),C=window.Capacitor,P=C&&C.Plugins;
  if(phone){location.href=`sms:${phone}&body=${encodeURIComponent(text)}`;return true}
  try{if(C&&C.isNativePlatform&&C.isNativePlatform()&&P.Share){await P.Share.share({title:'Join me on Orbit',text,dialogTitle:'Invite a friend'});return true}
    if(navigator.share){await navigator.share({title:'Join me on Orbit',text});return true}}catch(e){return false}
  try{await navigator.clipboard.writeText(text);alert('Invite copied. Paste it anywhere.');return true}catch(_){prompt('Copy your invite:',text)}}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-orbit="invite"]');if(!b)return;e.preventDefault();e.stopPropagation();
  const ok=await shareInvite(b.dataset.first||'',b.dataset.phone||'');
  if(ok&&b.dataset.pid){try{await window.orbitSB.rpc('doc_update',{p_coll:'contacts',p_id:b.dataset.pid,p_patch:{invitedAt:(d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'))(new Date())}})}catch(_){}}},true);
// fill the Invite card in Settings whenever it appears
new MutationObserver(()=>{const el=document.getElementById('orbitInviteInfo');if(!el||el.dataset.done)return;el.dataset.done='1';
  getInvite().then(inv=>{el.innerHTML=`Your code <b style="font-family:var(--mono);letter-spacing:.04em">${inv.code}</b> · ${inv.joined?`${inv.joined} friend${inv.joined===1?'':'s'} joined`:'nobody yet'}`}).catch(()=>{el.textContent='Sign in to get your invite code.'})}).observe(document.body,{childList:true,subtree:true});
