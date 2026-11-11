// Pick people from the iPhone's contacts, any time after signup (Settings > Import people, or the Add button).
// Asks for contacts permission on first use. Only the people you tick are handed to Orbit's import step.
(function(){
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STATE={Alabama:'AL',Alaska:'AK',Arizona:'AZ',Arkansas:'AR',California:'CA',Colorado:'CO',Connecticut:'CT',Delaware:'DE',Florida:'FL',Georgia:'GA',Hawaii:'HI',Idaho:'ID',Illinois:'IL',Indiana:'IN',Iowa:'IA',Kansas:'KS',Kentucky:'KY',Louisiana:'LA',Maine:'ME',Maryland:'MD',Massachusetts:'MA',Michigan:'MI',Minnesota:'MN',Mississippi:'MS',Missouri:'MO',Montana:'MT',Nebraska:'NE',Nevada:'NV','New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND',Ohio:'OH',Oklahoma:'OK',Oregon:'OR',Pennsylvania:'PA','Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD',Tennessee:'TN',Texas:'TX',Utah:'UT',Vermont:'VT',Virginia:'VA',Washington:'WA','West Virginia':'WV',Wisconsin:'WI',Wyoming:'WY','District of Columbia':'DC'};
const plugin=()=>{const C=window.Capacitor;return C&&C.isNativePlatform&&C.isNativePlatform()&&C.Plugins&&C.Plugins.Contacts||null};
const available=()=>!!plugin();
let cache=null;
async function read(){const P=plugin();if(!P)throw Object.assign(new Error('Contacts only work in the iPhone app.'),{code:'web'});
  const perm=await P.requestPermissions();if((perm.contacts||perm.readContacts)!=='granted')throw Object.assign(new Error('denied'),{code:'denied'});
  const {contacts:cs}=await P.getContacts({projection:{name:true,phones:true,emails:true,birthday:true,postalAddresses:true}});
  const seen=new Set();cache=(cs||[]).map((c,i)=>{const n=c.name||{};const first=(n.given||'').trim(),last=(n.family||'').trim(),disp=(n.display||[first,last].join(' ')).trim();if(!disp)return null;
    const b=c.birthday,bd=b&&b.month&&b.day?`${b.year&&b.year>1900?b.year:1604}-${String(b.month).padStart(2,'0')}-${String(b.day).padStart(2,'0')}`:'';
    const a=(c.postalAddresses||[]).find(x=>x.city)||null,us=a&&/^(us|usa|united states)/i.test(a.country||'');
    const city=a?(us||!a.country?`${a.city}${a.region?', '+(STATE[a.region]||a.region):''}`:`${a.city}, ${a.country}`):'';
    return {key:'c'+i,first:first||disp.split(' ')[0],last:last||(first?'':disp.split(' ').slice(1).join(' ')),name:disp,phone:((c.phones||[])[0]||{}).number||'',email:((c.emails||[])[0]||{}).address||'',birthday:bd,city}})
    .filter(p=>p&&!seen.has(p.name.toLowerCase())&&seen.add(p.name.toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name));
  return cache}
const ini=n=>n.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();
let picked=new Set(),q='';
function close(){const d=document.getElementById('ctSheet');if(d)d.remove()}
function paint(d,list){const ql=q.toLowerCase(),rows=list.filter(p=>!ql||p.name.toLowerCase().includes(ql)).slice(0,300);
  const inOrbit=window.orbitHasPerson||(()=>false);
  d.querySelector('#ctList').innerHTML=rows.map(p=>{const have=inOrbit(p);return `<button type="button" class="onb-person${picked.has(p.key)?' on':''}${have?' have':''}" data-ck="${p.key}" aria-pressed="${picked.has(p.key)}"${have?' disabled':''}><span class="onb-av">${esc(ini(p.name))}</span><span class="onb-pn"><span>${esc(p.name)}</span><small>${have?'Already in Orbit':esc([p.city,p.phone?'':'no phone'].filter(Boolean).join(' · ')||' ')}</small></span><span class="onb-tick"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg></span></button>`}).join('')||'<p class="sg-note">Nobody matches.</p>';
  const n=picked.size,room=window.orbitRoomLeft?orbitRoomLeft():Infinity;d.querySelector('#ctGo').textContent=n?`Continue with ${n}`:'Pick people above';d.querySelector('#ctGo').disabled=!n;
  d.querySelector('#ctRoom').textContent=room<Infinity&&room<=20?`${room} of 150 spots left in your orbit.`:''}
async function pick(){close();picked=new Set();q='';
  const d=document.createElement('div');d.className='sg-sheet';d.id='ctSheet';d.innerHTML=`<div class="sg-panel ct-panel" role="dialog" aria-modal="true" aria-labelledby="ctT"><div class="sg-top"><h3 id="ctT">From your contacts</h3><button type="button" class="sg-x" data-ct-close aria-label="Close">✕</button></div><p class="sg-note" id="ctMsg">Asking for permission…</p></div>`;
  d.addEventListener('click',e=>{if(e.target===d||e.target.closest('[data-ct-close]'))close()});document.body.appendChild(d);
  let list;try{list=cache||await read()}catch(e){const m=d.querySelector('#ctMsg');
    if(e.code==='denied')m.innerHTML='Orbit doesn’t have access to your contacts. To allow it: open the iPhone <b>Settings</b> app, scroll to <b>Orbit</b>, and turn on <b>Contacts</b>. Then come back here.';
    else if(e.code==='web')m.textContent='Contacts can only be read in the iPhone app. On the web, use a file instead.';
    else m.textContent='Couldn’t read your contacts just now.';return}
  d.querySelector('.ct-panel').innerHTML=`<div class="sg-top"><h3 id="ctT">From your contacts</h3><button type="button" class="sg-x" data-ct-close aria-label="Close">✕</button></div>
   <p class="sg-note">Tick the people you want in Orbit. Only the ones you tick are saved; the rest stay on your phone.</p>
   <input class="sg-input" id="ctQ" type="search" placeholder="Search ${list.length} contacts" autocomplete="off">
   <div class="onb-list ct-list" id="ctList"></div>
   <p class="sg-note" id="ctRoom"></p>
   <button type="button" class="sg-cta" id="ctGo" disabled>Pick people above</button>`;
  paint(d,list);
  d.querySelector('#ctQ').addEventListener('input',e=>{q=e.target.value;paint(d,list)});
  d.querySelector('#ctList').addEventListener('click',e=>{const b=e.target.closest('[data-ck]');if(!b||b.disabled)return;const k=b.dataset.ck;picked.has(k)?picked.delete(k):picked.add(k);const st=d.querySelector('#ctList').scrollTop;paint(d,list);d.querySelector('#ctList').scrollTop=st});
  d.querySelector('#ctGo').addEventListener('click',()=>{const rows=list.filter(p=>picked.has(p.key)).map(p=>({first:p.first,last:p.last,phone:p.phone,email:p.email,city:p.city,birthday:p.birthday,nickname:'',job:'',notes:'',instagram:'',circle:'',whereMet:''}));close();if(window.orbitImportRows)orbitImportRows(rows,'your contacts')})}
document.addEventListener('click',e=>{const b=e.target.closest('[data-ct="pick"]');if(b){e.preventDefault();pick()}});
window.OrbitContacts={available,pick,read};
})();
