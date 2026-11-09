// Orbit signup and first-run setup (standalone app only).
// Screens 1-2 (welcome, account) show when signed out. Screens 3-9 run once after the first sign-in,
// then the app loads. Nothing here reads messages; contacts are read only after the iPhone permission prompt,
// and only the people the user picks are saved.
(function(){
const STEPS=9, LIMITS={inner:5,close:15,friends:50,family:Infinity};
const LAYER_NAME={inner:'Inner sphere',close:'Close friends',friends:'Friends',family:'Family'};
const LAYER_COLOR={inner:'var(--inner)',close:'var(--accent)',friends:'var(--orbit)',family:'var(--fam)'};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ICON={
 back:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
 check:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
 lock:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" style="stroke:var(--accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
 chat:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" style="stroke:var(--accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/></svg>',
 trash:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" style="stroke:var(--accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
 search:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" style="stroke:var(--muted)" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
 mac:'<svg viewBox="0 0 24 24" width="26" height="26" fill="none" style="stroke:var(--accent)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19h20"/></svg>',
 ok:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" style="stroke:var(--inner)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>'
};
const LOGO='<svg viewBox="0 0 100 100" width="120" height="120" aria-hidden="true"><circle cx="50" cy="50" r="30" fill="none" style="stroke:var(--ink)" stroke-width="2.4"/><circle cx="71.2" cy="28.8" r="8" style="fill:var(--accent)"/></svg>';

let root=null;
function mount(){if(!root){root=document.createElement('div');root.id='onb';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');document.body.appendChild(root)}return root}
function close(){if(root){root.remove();root=null}}
function head(step,backTo){return `<div class="onb-top">${backTo?`<button type="button" class="onb-back" data-go="${backTo}" aria-label="Back">${ICON.back}</button>`:'<span class="onb-back"></span>'}<div class="onb-prog" aria-hidden="true"><i style="width:${Math.round(step/STEPS*100)}%"></i></div><span class="onb-step">${step} of ${STEPS}</span></div>`}
function screen(html){const r=mount();r.innerHTML=`<div class="onb-screen">${html}</div>`;r.scrollTop=0;const f=r.querySelector('[autofocus]');if(f)setTimeout(()=>f.focus(),50);return r}

// ---------- signed out: welcome, create account, sign in ----------
let SB=null;
function welcome(){screen(`<div class="onb-hero">${LOGO}<h1 class="onb-big">Orbit</h1><p class="onb-lede">Stay close to the people who matter, before anyone drifts away.</p></div>
 <div class="onb-card"><div class="onb-li">${ICON.lock}<span>Your sphere is private. Only you can see it.</span></div><div class="onb-li">${ICON.chat}<span>We never read your messages. At most, who and when.</span></div><div class="onb-li">${ICON.trash}<span>Delete your account and data anytime.</span></div></div>
 <div class="onb-grow"></div><button type="button" class="onb-cta" data-go="create">Get started</button><button type="button" class="onb-link" data-go="signin">I already have an account</button>`)}
function authForm(mode){const up=mode==='create';screen(`${up?head(2,'welcome'):`<div class="onb-top"><button type="button" class="onb-back" data-go="welcome" aria-label="Back">${ICON.back}</button></div>`}
 <div class="onb-titles"><h1>${up?'Create your account':'Welcome back'}</h1><p>${up?'So your sphere is saved and follows you to any device.':'Sign in to see your people.'}</p></div>
 <form class="onb-form" id="onbAuth" autocomplete="on">
  <label>Email<input name="email" type="email" required autocomplete="username" placeholder="you@email.com" autofocus></label>
  <label>Password<input name="pw" type="password" required minlength="${up?8:6}" autocomplete="${up?'new-password':'current-password'}" placeholder="${up?'At least 8 characters':''}"></label>
  ${up?`<label>Invite code <em>Optional</em><input name="invite" autocapitalize="characters" autocomplete="off" placeholder="From the friend who invited you" value="${esc(inviteFromLink())}"></label>`:''}
  ${up?`<label class="onb-check"><input type="checkbox" name="agree"><span>I agree to the <button type="button" class="onb-inline" data-show="terms">Terms</button> and <button type="button" class="onb-inline" data-show="privacy">Privacy Policy</button></span></label>`:''}
  <p class="onb-msg" role="status"></p>
  <button type="submit" class="onb-cta">${up?'Create account':'Sign in'}</button>
 </form>`);
 const f=root.querySelector('#onbAuth'),msg=root.querySelector('.onb-msg');
 f.onsubmit=async e=>{e.preventDefault();const email=f.email.value.trim(),password=f.pw.value;
  if(up&&!f.agree.checked){msg.textContent='Please agree to the Terms and Privacy Policy.';return}
  if(up&&password.length<8){msg.textContent='Use at least 8 characters for your password.';return}
  if(up&&f.invite.value.trim()){try{localStorage.setItem('orbit-invite',f.invite.value.trim().toUpperCase())}catch(_){}}
  const b=f.querySelector('.onb-cta');b.disabled=true;msg.textContent=up?'Creating your account…':'Signing in…';
  const r=up?await SB.auth.signUp({email,password}):await SB.auth.signInWithPassword({email,password});
  b.disabled=false;
  if(r.error){msg.textContent=r.error.message==='Invalid login credentials'?'That email and password don’t match. New here? Go back and tap Get started.':r.error.message;return}
  if(up&&!r.data.session){msg.textContent='Check your email to confirm your account, then come back and sign in.';return}
  msg.textContent=''}}
const LEGAL={terms:['Terms','Orbit is a personal tool for keeping track of your own relationships. Use it for yourself, keep what you add respectful of the people in it, and don’t use it to harass or track anyone. The beta is provided as is, and features may change.'],
 privacy:['Privacy','Your sphere is stored in your own private account and only you can see it. Orbit never reads the content of your messages. If you connect the Mac helper, it sends only who you talked with and when. When you ask for a drafted text or a personal read, the details on that person’s card are sent to Anthropic’s Claude to write it. We don’t sell or share your data. Delete your account in Settings and everything is erased.']};
function showLegal(k){const [t,b]=LEGAL[k];const d=document.createElement('div');d.className='onb-sheet';d.innerHTML=`<div class="onb-sheet-in" role="dialog" aria-label="${t}"><h2>${t}</h2><p>${b}</p><button type="button" class="onb-cta" data-close>Close</button></div>`;d.onclick=e=>{if(e.target===d||e.target.closest('[data-close]'))d.remove()};mount().appendChild(d)}

function inviteFromLink(){try{const m=location.search.match(/[?&]invite=([A-Za-z0-9-]+)/);return m?m[1].toUpperCase():(localStorage.getItem('orbit-invite')||'')}catch(_){return ''}}
function startSignedOut(sb){SB=sb;welcome()}

// ---------- first-run setup ----------
let S=null,UID=null,done=null;
const KEY=()=>'orbit-onboard-'+UID;
function persist(){try{localStorage.setItem(KEY(),JSON.stringify(S))}catch(_){}}
function load(){try{return JSON.parse(localStorage.getItem(KEY())||'null')}catch(_){return null}}
async function needs(sb,uid){
  const {data,error}=await sb.from('docs').select('id,data').eq('coll','meta').eq('id','settings').maybeSingle();
  if(error)return false;
  if(data&&data.data&&(data.data.onboarded||data.data.profile&&data.data.profile.name&&!data.data.onboarding))return false;
  const {count}=await sb.from('docs').select('id',{count:'exact',head:true}).eq('coll','contacts');
  return !(count>0);
}
function run(sb,uid){SB=sb;UID=uid;S=load()||{step:3,me:{},people:[],picked:{},layer:{},remind:{note:'weekly',drift:182},notif:true,cities:{}};
  return new Promise(res=>{done=res;go(S.step||3)})}

function go(n){S.step=n;persist();({3:about,4:contacts,5:pick,6:circles,7:places,8:touch,9:ready})[n]()}

// geocoding for city fields (Open-Meteo, no key)
let geoT=0;
async function geoSearch(q){if(!q||q.trim().length<2)return [];try{const r=await fetch('https://geocoding-api.open-meteo.com/v1/search?count=5&language=en&name='+encodeURIComponent(q.trim()));const j=await r.json();
  return (j.results||[]).map(x=>{const us=x.country_code==='US',st=us&&x.admin1?STATE[x.admin1]||x.admin1:'';return {label:us?`${x.name}, ${st}`:`${x.name}, ${x.country}`,sub:us?'United States':(x.admin1||''),lat:+x.latitude.toFixed(4),lng:+x.longitude.toFixed(4),name:x.name}})}catch(_){return []}}
const STATE={Alabama:'AL',Alaska:'AK',Arizona:'AZ',Arkansas:'AR',California:'CA',Colorado:'CO',Connecticut:'CT',Delaware:'DE',Florida:'FL',Georgia:'GA',Hawaii:'HI',Idaho:'ID',Illinois:'IL',Indiana:'IN',Iowa:'IA',Kansas:'KS',Kentucky:'KY',Louisiana:'LA',Maine:'ME',Maryland:'MD',Massachusetts:'MA',Michigan:'MI',Minnesota:'MN',Mississippi:'MS',Missouri:'MO',Montana:'MT',Nebraska:'NE',Nevada:'NV','New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND',Ohio:'OH',Oklahoma:'OK',Oregon:'OR',Pennsylvania:'PA','Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD',Tennessee:'TN',Texas:'TX',Utah:'UT',Vermont:'VT',Virginia:'VA',Washington:'WA','West Virginia':'WV',Wisconsin:'WI',Wyoming:'WY','District of Columbia':'DC'};
function cityField(input,onPick){const box=document.createElement('div');box.className='onb-sugg';box.hidden=true;input.after(box);
  input.addEventListener('input',()=>{onPick(null);clearTimeout(geoT);const q=input.value;geoT=setTimeout(async()=>{const rs=await geoSearch(q);if(input.value!==q)return;
    box.innerHTML=rs.map((r,i)=>`<button type="button" data-i="${i}"><span>${esc(r.label)}</span><small>${esc(r.sub)}</small></button>`).join('');box.hidden=!rs.length;
    box.onclick=e=>{const b=e.target.closest('[data-i]');if(!b)return;const r=rs[+b.dataset.i];input.value=r.label;box.hidden=true;onPick(r)}},250)})}
const cityKey=s=>String(s||'').toLowerCase().replace(/\s*\(.*?\)\s*/g,' ').split(',')[0].trim();

// 3. about you
function about(){const m=S.me;screen(`${head(3)}
 <div class="onb-titles"><h1>A little about you</h1><p>You’re the center of your orbit.</p></div>
 <div class="onb-form">
  <label>Your name<input id="oName" value="${esc(m.name||'')}" autocomplete="name" placeholder="First and last" autofocus></label>
  <label>What should we call you?<input id="oCall" value="${esc(m.callMe||'')}" autocomplete="nickname" placeholder="A nickname is fine"></label>
  <label><span>Where do you live? <em class="onb-req">Required</em></span><input id="oCity" value="${esc(m.city||'')}" autocomplete="off" placeholder="Start typing your city"></label>
  <p class="onb-note">Just your city. We never use your phone’s location.</p>
  <label><span>Birthday <em>Optional</em></span><input id="oBday" type="date" value="${esc(m.birthday||'')}"></label>
  <p class="onb-msg" role="status"></p>
 </div><div class="onb-grow"></div><button type="button" class="onb-cta" id="oNext">Continue</button>`);
 let picked=m.city?{label:m.city,lat:m.lat,lng:m.lng}:null;cityField(root.querySelector('#oCity'),r=>picked=r);
 root.querySelector('#oNext').onclick=()=>{const name=root.querySelector('#oName').value.trim(),city=root.querySelector('#oCity').value.trim(),msg=root.querySelector('.onb-msg');
  if(!name){msg.textContent='Add your name.';return}if(!city){msg.textContent='Add the city you live in. It’s how your map starts.';return}
  S.me={name,callMe:root.querySelector('#oCall').value.trim()||name.split(' ')[0],city:picked?picked.label:city,lat:picked&&picked.lat,lng:picked&&picked.lng,birthday:root.querySelector('#oBday').value};
  if(picked&&picked.lat!=null)S.cities[cityKey(S.me.city)]=[picked.lat,picked.lng,picked.name||S.me.city.split(',')[0]];
  go(4)}}

// 4. contacts permission
function nativeContacts(){const C=window.Capacitor;return C&&C.isNativePlatform&&C.isNativePlatform()&&C.Plugins&&C.Plugins.Contacts}
function contacts(){screen(`${head(4,3)}
 <div class="onb-art" aria-hidden="true"><svg viewBox="0 0 200 160" width="230" height="184"><circle cx="100" cy="80" r="34" fill="none" style="stroke:var(--line2)" stroke-width="1.5"/><circle cx="100" cy="80" r="62" fill="none" style="stroke:var(--line2)" stroke-width="1.5"/><circle cx="100" cy="80" r="9" style="fill:var(--accent)"/><circle cx="128" cy="62" r="7" style="fill:var(--inner)"/><circle cx="70" cy="96" r="6" style="fill:var(--fam)"/><circle cx="152" cy="112" r="6" style="fill:var(--orbit)"/><circle cx="44" cy="52" r="5" style="fill:var(--ink)"/><circle cx="96" cy="19" r="5" style="fill:var(--ink)"/></svg></div>
 <div class="onb-titles"><h1>Bring in your people</h1><p>Let Orbit look at your contacts so you can pick your people in a few taps. Their birthdays and cities come along, so you type less.</p></div>
 <div class="onb-card"><div class="onb-li">${ICON.ok}<span>Only the people you pick are saved</span></div><div class="onb-li">${ICON.ok}<span>We never message or invite anyone</span></div><div class="onb-li">${ICON.ok}<span>Change it anytime in iPhone Settings</span></div></div>
 <p class="onb-msg" role="status"></p><div class="onb-grow"></div>
 <button type="button" class="onb-cta" id="oAllow">Allow contacts</button><button type="button" class="onb-link" id="oManual">Add people by hand instead</button>`);
 root.querySelector('#oManual').onclick=()=>{S.fromContacts=false;go(5)};
 root.querySelector('#oAllow').onclick=async()=>{const P=nativeContacts(),msg=root.querySelector('.onb-msg');
  if(!P){msg.textContent='Contacts only work in the iPhone app. Add people by hand for now.';return}
  try{const perm=await P.requestPermissions();if((perm.contacts||perm.readContacts)!=='granted'){msg.textContent='No problem. You can add people by hand.';S.fromContacts=false;setTimeout(()=>go(5),900);return}
   msg.textContent='Reading your contacts…';
   const {contacts:cs}=await P.getContacts({projection:{name:true,phones:true,emails:true,birthday:true,postalAddresses:true}});
   const seen=new Set();S.people=(cs||[]).map((c,i)=>{const n=c.name||{};const first=(n.given||'').trim(),last=(n.family||'').trim(),disp=(n.display||[first,last].join(' ')).trim();if(!disp)return null;
     const b=c.birthday,bd=b&&b.month&&b.day?`${b.year&&b.year>1900?b.year:1604}-${String(b.month).padStart(2,'0')}-${String(b.day).padStart(2,'0')}`:'';
     const a=(c.postalAddresses||[]).find(x=>x.city)||null,us=a&&/^(us|usa|united states)/i.test(a.country||'');
     const city=a?(us||!a.country?`${a.city}${a.region?', '+(STATE[a.region]||a.region):''}`:`${a.city}, ${a.country}`):'';
     return {key:'c'+i,first:first||disp.split(' ')[0],last:last||(first?'':disp.split(' ').slice(1).join(' ')),name:disp,phone:((c.phones||[])[0]||{}).number||'',email:((c.emails||[])[0]||{}).address||'',birthday:bd,city}}).filter(p=>p&&!seen.has(p.name.toLowerCase())&&seen.add(p.name.toLowerCase()))
     .sort((a,b)=>a.name.localeCompare(b.name));
   S.fromContacts=true;go(5)}catch(err){msg.textContent='Couldn’t read contacts. You can add people by hand.';S.fromContacts=false}}}

// 5. pick your sphere
let pickQ='';
function pickedList(){return S.people.filter(p=>S.picked[p.key])}
function pick(){const n=pickedList().length,need=Math.max(0,10-n);
 const q=pickQ.toLowerCase(),list=S.people.filter(p=>!q||p.name.toLowerCase().includes(q)).slice(0,200);
 screen(`${head(5,4)}
 <div class="onb-titles"><h1>Pick your sphere</h1><p>Choose at least 10 people you want to stay close to. You can add more later.</p></div>
 ${S.people.length?`<label class="onb-search">${ICON.search}<input type="search" id="oQ" aria-label="Search" placeholder="Search contacts" value="${esc(pickQ)}"></label>`:''}
 <form class="onb-add" id="oAdd"><input id="oAddName" aria-label="Add someone by name" placeholder="${S.people.length?'Someone not in your contacts? Type a name':'Type a name and tap Add'}" autocomplete="off"><button type="submit">Add</button></form>
 <div class="onb-count"><b>${n} of 10 picked</b><span class="onb-dots" aria-hidden="true">${Array.from({length:10},(_,i)=>`<i class="${i<n?'on':''}"></i>`).join('')}</span></div>
 <div class="onb-list" id="oList">${list.map(p=>`<button type="button" class="onb-person${S.picked[p.key]?' on':''}" data-k="${p.key}" aria-pressed="${!!S.picked[p.key]}"><span class="onb-av">${esc(initials(p.name))}</span><span class="onb-pn"><span>${esc(p.name)}</span><small>${esc([p.city,p.birthday?'birthday '+fmtB(p.birthday):''].filter(Boolean).join(' · ')||' ')}</small></span><span class="onb-tick">${ICON.check}</span></button>`).join('')||'<p class="onb-note">Nobody yet. Add your first person above.</p>'}</div>
 <button type="button" class="onb-cta" id="oNext" ${need?'disabled':''}>${need?`Pick ${need} more`:'Continue'}</button>`);
 const qi=root.querySelector('#oQ');if(qi){qi.oninput=()=>{pickQ=qi.value;const pos=qi.selectionStart;pick();const q2=root.querySelector('#oQ');q2.focus();q2.setSelectionRange(pos,pos)}}
 root.querySelector('#oList').onclick=e=>{const b=e.target.closest('[data-k]');if(!b)return;const k=b.dataset.k;if(S.picked[k])delete S.picked[k];else S.picked[k]=1;persist();const st=root.querySelector('.onb-list').scrollTop;pick();root.querySelector('.onb-list').scrollTop=st};
 root.querySelector('#oAdd').onsubmit=e=>{e.preventDefault();const v=root.querySelector('#oAddName').value.trim();if(!v)return;const parts=v.split(/\s+/);const k='m'+Date.now().toString(36);
   S.people.unshift({key:k,first:parts[0],last:parts.slice(1).join(' '),name:v,phone:'',email:'',birthday:'',city:''});S.picked[k]=1;pickQ='';persist();pick()};
 root.querySelector('#oNext').onclick=()=>{if(pickedList().length>=10)go(6)}}
const initials=n=>n.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();
const fmtB=b=>{const [,m,d]=b.split('-').map(Number);return new Date(2000,m-1,d).toLocaleDateString(undefined,{month:'short',day:'numeric'})};

// 6. circles
function layerOf(p){return S.layer[p.key]||'friends'}
function circles(){const ps=pickedList();const by={inner:[],close:[],friends:[],family:[]};ps.forEach(p=>by[layerOf(p)].push(p));
 const group=k=>`<div class="onb-group"><div class="onb-gh"><span><i style="background:${LAYER_COLOR[k]}"></i>${LAYER_NAME[k]}</span><small>${by[k].length}${LIMITS[k]===Infinity?'':' of '+LIMITS[k]}</small></div><div class="onb-chips">${by[k].map(p=>`<button type="button" data-k="${p.key}" style="border-color:${LAYER_COLOR[k]}">${esc(p.name)}</button>`).join('')||'<span class="onb-note">Tap a name to move someone here</span>'}</div></div>`;
 screen(`${head(6,5)}<div class="onb-titles"><h1>How close are they?</h1><p>Most of us have about 5 people closest, then 15, then 50. Tap someone to move them to the next circle.</p></div>
 ${group('inner')}${group('close')}${group('friends')}${group('family')}
 <p class="onb-note">When a circle is full, Orbit asks who’s moving out. Family has no limit.</p><div class="onb-grow"></div>
 <button type="button" class="onb-cta" id="oNext">Continue</button>`);
 root.querySelectorAll('.onb-chips').forEach(c=>c.onclick=e=>{const b=e.target.closest('[data-k]');if(!b)return;const p=S.people.find(x=>x.key===b.dataset.k);const order=['inner','close','friends','family'];let i=order.indexOf(layerOf(p));
   for(let t=0;t<4;t++){i=(i+1)%4;const k=order[i];if(by[k].length<LIMITS[k]){S.layer[p.key]=k;break}}persist();circles()});
 root.querySelector('#oNext').onclick=()=>go(7)}

// 7. fill the gaps
function places(){const ps=pickedList(),missing=ps.filter(p=>!p.city),have=ps.filter(p=>p.city),bd=ps.filter(p=>p.birthday).length;
 screen(`${head(7,6)}<div class="onb-titles"><h1>Where do they live?</h1><p>${missing.length?`${have.length?have.length+' already have a city. ':''}Add a city for the rest so they show up on your map.`:'Everyone has a city. Nice.'}</p></div>
 <div class="onb-form">${missing.map(p=>`<label>${esc(p.name)}<input data-k="${p.key}" class="oPlace" autocomplete="off" placeholder="City (skip if you don’t know)"></label>`).join('')}</div>
 ${have.length?`<div class="onb-card onb-rows">${have.slice(0,4).map(p=>`<div><span>${esc(p.name)}</span><small>${esc(p.city)}</small></div>`).join('')}${have.length>4?`<div><span>+ ${have.length-4} more</span><small style="color:var(--inner)">From contacts</small></div>`:''}</div>`:''}
 <div class="onb-card"><b>Birthdays</b><small>${bd?`${bd} found from your contacts. `:''}Add the others anytime on their card.</small></div>
 <div class="onb-grow"></div><button type="button" class="onb-cta" id="oNext">Continue</button>`);
 const geo={};root.querySelectorAll('.oPlace').forEach(inp=>cityField(inp,r=>geo[inp.dataset.k]=r));
 root.querySelector('#oNext').onclick=()=>{root.querySelectorAll('.oPlace').forEach(inp=>{const v=inp.value.trim();if(!v)return;const p=S.people.find(x=>x.key===inp.dataset.k),g=geo[inp.dataset.k];p.city=g?g.label:v;if(g)S.cities[cityKey(p.city)]=[g.lat,g.lng,g.name]});go(8)}}

// 8. stay in touch
function touch(){const r=S.remind,seg=(name,opts,cur)=>`<div class="onb-seg" role="group" aria-label="${name}">${opts.map(([v,l])=>`<button type="button" data-${name}="${v}" aria-pressed="${String(cur)===String(v)}">${l}</button>`).join('')}</div>`;
 screen(`${head(8,7)}<div class="onb-titles"><h1>Stay in touch</h1><p>How should Orbit nudge you?</p></div>
 <div class="onb-field"><span>Send me a reach-out note</span>${seg('note',[['weekly','Weekly'],['biweekly','Every 2 weeks'],['monthly','Monthly']],r.note)}</div>
 <div class="onb-field"><span>Warn me when someone’s been quiet for</span>${seg('drift',[[91,'3 months'],[182,'6 months'],[365,'A year']],r.drift)}</div>
 <div class="onb-card onb-toggle"><div><b>Reminders</b><small>Birthdays and drift alerts</small></div><button type="button" id="oNotif" class="onb-switch" aria-pressed="${!!S.notif}" aria-label="Reminders"><i></i></button></div>
 <div class="onb-card onb-dashed"><div class="onb-li">${ICON.mac}<span><b>Have a Mac?</b> <em>Optional</em><br><small>Orbit Helper will count your texts on your Mac so Orbit knows when you last talked. Messages never leave your computer. It’s coming soon, and you’ll find it in Settings.</small></span></div></div>
 <div class="onb-grow"></div><button type="button" class="onb-cta" id="oNext">Continue</button>`);
 root.onclick=e=>{const a=e.target.closest('[data-note]'),b=e.target.closest('[data-drift]');if(a){r.note=a.dataset.note;persist();touch()}if(b){r.drift=+b.dataset.drift;persist();touch()}};
 root.querySelector('#oNotif').onclick=()=>{S.notif=!S.notif;persist();touch()};
 root.querySelector('#oNext').onclick=()=>{root.onclick=null;go(9)}}

// 9. ready, then save everything
function ready(){const ps=pickedList(),c={inner:0,close:0,friends:0,family:0};ps.forEach(p=>c[layerOf(p)]++);
 const R={inner:52,close:96,friends:140,family:96},dots=ps.map((p,i)=>{const L=layerOf(p),r=R[L]+(L==='family'?8:0),a=i*2.399+(L==='inner'?0.6:0);return `<circle cx="${(160+r*Math.cos(a)).toFixed(1)}" cy="${(160+r*Math.sin(a)).toFixed(1)}" r="${L==='inner'?9:L==='friends'?6:7}" style="fill:${LAYER_COLOR[L]}"/>`}).join('');
 const circlesUsed=Object.values(c).filter(Boolean).length;
 screen(`${head(9)}<div class="onb-art"><svg viewBox="0 0 320 320" width="300" height="300" role="img" aria-label="Your orbit with ${ps.length} people"><circle cx="160" cy="160" r="52" fill="none" style="stroke:var(--line2)" stroke-width="1.5"/><circle cx="160" cy="160" r="96" fill="none" style="stroke:var(--line2)" stroke-width="1.5"/><circle cx="160" cy="160" r="140" fill="none" style="stroke:var(--line2)" stroke-width="1.5" stroke-dasharray="3 5"/><circle cx="160" cy="160" r="13" style="fill:var(--accent)"/>${dots}<text x="160" y="187" text-anchor="middle" style="fill:var(--ink)" font-family="Inter, sans-serif" font-size="12" font-weight="600">You</text></svg></div>
 <div class="onb-titles onb-center"><h1>Your orbit is ready</h1><p>${ps.length} people across ${circlesUsed} circle${circlesUsed===1?'':'s'}. We’ll nudge you before anyone drifts.</p></div>
 <div class="onb-stats">${['inner','close','friends','family'].filter(k=>c[k]).map(k=>`<div><b style="color:${LAYER_COLOR[k]}">${c[k]}</b><small>${LAYER_NAME[k]}</small></div>`).join('')}</div>
 <p class="onb-msg" role="status"></p><div class="onb-grow"></div><button type="button" class="onb-cta" id="oNext">Open my orbit</button>`);
 root.querySelector('#oNext').onclick=async e=>{const b=e.currentTarget,msg=root.querySelector('.onb-msg');b.disabled=true;b.textContent='Setting up…';
  try{await save();try{localStorage.removeItem(KEY())}catch(_){}close();done()}catch(err){b.disabled=false;b.textContent='Try again';msg.textContent='Couldn’t save just now: '+(err.message||err)}}}

const slug=s=>String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g,'').trim().replace(/\s+/g,'-').slice(0,40)||'person';
async function save(){const Y=new Date().getFullYear(),now=new Date().toISOString(),used=new Set();
 const rows=pickedList().map(p=>{let id=slug(p.name);while(used.has(id))id+='-'+Math.random().toString(36).slice(2,5);used.add(id);const L=layerOf(p);
  const d={first:p.first||p.name,last:p.last||'',circle:L==='family'?'Family':'Friend',layer:L,years:[Y],touches:[],addedAt:now.slice(0,10)};
  if(L==='inner')d.inner=true;if(p.city)d.city=p.city;if(p.birthday)d.birthday=p.birthday;if(p.phone)d.phone=p.phone;if(p.email)d.email=p.email;
  return {user_id:UID,coll:'contacts',id,data:d,updated_at:now}});
 const noteDays={weekly:7,biweekly:14,monthly:30}[S.remind.note]||7;
 const settings={profile:{name:S.me.name,callMe:S.me.callMe,city:S.me.city,birthday:S.me.birthday||''},
  remind:{driftDays:S.remind.drift,reachDays:Math.min(90,S.remind.drift),birthdayDays:60,homeBirthdays:true,homeDrift:true,weeklyNote:true,noteEveryDays:noteDays,notifications:!!S.notif,pauseUntil:''},
  look:{},custom:{circles:[]},onboarded:true,onboardedAt:now};
 rows.push({user_id:UID,coll:'meta',id:'settings',data:settings,updated_at:now});
 if(Object.keys(S.cities).length)rows.push({user_id:UID,coll:'meta',id:'geo',data:{cities:S.cities},updated_at:now});
 const {error}=await SB.from('docs').upsert(rows);if(error)throw error}

// shared clicks
document.addEventListener('click',e=>{if(!root||!root.contains(e.target))return;const g=e.target.closest('[data-go]');if(g){const t=g.dataset.go;if(t==='welcome')welcome();else if(t==='create'||t==='signin')authForm(t);else go(+t);return}
 const l=e.target.closest('[data-show]');if(l)showLegal(l.dataset.show)});

window.OrbitOnboard={startSignedOut,needs,run,close,showLegal};
})();
