// Reports inbox for the Orbit owner. Shows only for accounts in app_admins. Lists reported Signals with
// Dismiss / Hide / Remove, and puts a small banner on Home while anything is waiting.
(function(){
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sb=()=>window.orbitSB;
let admin=null,reports=[],urls={},busy=false;
const when=t=>{const m=Math.round((Date.now()-new Date(t))/6e4);return m<60?m+' min ago':m<1440?Math.round(m/60)+'h ago':Math.round(m/1440)+'d ago'};
async function load(){if(busy||admin===false)return;busy=true;
  try{if(admin===null){const r=await sb().rpc('is_app_admin');admin=!!(r&&r.data);if(!admin){busy=false;paint();return}}
    const r=await sb().rpc('open_reports');reports=(r&&r.data)||[];
    const need=reports.filter(x=>x.photo_path&&!urls[x.photo_path]).map(x=>x.photo_path);
    if(need.length){const {data}=await sb().storage.from('signals').createSignedUrls(need,3600);(data||[]).forEach(d=>{if(d.signedUrl)urls[d.path]=d.signedUrl})}}
  catch(e){console.error('reports',e)}finally{busy=false;paint()}}
function paint(){
  const bar=document.getElementById('adminBar');
  if(bar)bar.innerHTML=admin&&reports.length?`<button type="button" class="adm-bar" data-adm="open">⚑ ${reports.length} reported ${reports.length===1?'signal needs':'signals need'} a look <span>Review</span></button>`:'';
  const card=document.getElementById('reportsCard');if(!card)return;
  if(!admin){card.hidden=true;return}card.hidden=false;
  card.innerHTML=`<h3>Reports</h3><p class="lede">Signals people flagged. Apple expects these handled within a day. Hide takes a signal out of everyone’s feed; Remove deletes it. Either one closes the report.</p>
   ${reports.length?reports.map(r=>`<div class="adm-rep" data-rid="${esc(r.id)}">
     <div class="adm-top"><b>${esc(r.reported)}</b><small>reported by ${esc(r.reporter)} · ${when(r.at)}${r.prior?` · ${r.prior} earlier ${r.prior===1?'report':'reports'} on them`:''}</small></div>
     ${r.reason?`<p class="adm-why">“${esc(r.reason)}”</p>`:''}
     <div class="adm-sig">${r.photo_path?(urls[r.photo_path]?`<img src="${esc(urls[r.photo_path])}" alt="Reported photo">`:'<span class="hint">Photo no longer available</span>'):''}${r.body?`<p>${esc(r.body)}</p>`:''}${!r.body&&!r.photo_path?'<span class="hint">No content saved</span>':''}</div>
     <div class="adm-meta">${!r.live?'Already expired.':r.hidden?'Hidden from feeds.':'Still live in feeds.'}</div>
     <div class="adm-acts"><button type="button" class="btn small" data-adm="dismiss">Dismiss</button>${r.live&&!r.hidden?`<button type="button" class="btn small" data-adm="hide">Hide</button>`:''}${r.live?`<button type="button" class="btn small danger" data-adm="remove">Remove</button>`:''}</div></div>`).join('')
   :'<p class="hint" style="margin:0">Nothing waiting. Reports show up here as soon as someone flags a signal.</p>'}`}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-adm]');if(!b)return;e.preventDefault();const a=b.dataset.adm;
  if(a==='open'){const s=document.querySelector('[data-view="settings"]');if(s)s.click();setTimeout(()=>{const c=document.getElementById('reportsCard');if(c)c.scrollIntoView({behavior:'smooth',block:'start'})},250);return}
  const rep=b.closest('[data-rid]');if(!rep)return;
  if(a==='remove'&&!confirm('Delete this signal for everyone and close the report?'))return;
  b.disabled=true;const r=await sb().rpc('resolve_report',{p_report:rep.dataset.rid,p_action:a});
  if(r.error){b.disabled=false;alert('Couldn’t do that: '+r.error.message);return}
  reports=reports.filter(x=>x.id!==rep.dataset.rid);paint();load()});
new MutationObserver(()=>{const c=document.getElementById('reportsCard'),b=document.getElementById('adminBar');if((c&&!c.dataset.done)||(b&&!b.dataset.done)){if(c)c.dataset.done='1';if(b)b.dataset.done='1';paint();load()}}).observe(document.body,{childList:true,subtree:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&admin)load()});
window.claude.use('db').then(()=>load());
})();
