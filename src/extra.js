// Standalone-only extras: sign out and restore from a full backup file.
document.addEventListener('click',async e=>{
  const t=e.target.closest('[data-orbit]');if(!t)return;
  if(t.dataset.orbit==='delete'){if(!confirm('Delete your Orbit account? Every person, note, photo and setting will be erased. This can’t be undone.'))return;if(prompt('Type DELETE to confirm')!=='DELETE')return;
    t.disabled=true;t.textContent='Deleting…';const sb=window.orbitSB,{data:{user}}=await sb.auth.getUser();
    try{const {data:files}=await sb.storage.from('photos').list(user.id,{limit:1000});if(files&&files.length)await sb.storage.from('photos').remove(files.map(f=>user.id+'/'+f.name))}catch(_){}
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
