// Orbit reminders on the iPhone: schedules local notifications for per-person reminders and birthdays,
// sets the app icon badge to how many reminders are due, and opens the person when a notification is tapped.
// Everything is computed on the phone; nothing is sent to a server.
(function(){
const C=window.Capacitor,P=C&&C.Plugins;
if(!(C&&C.isNativePlatform&&C.isNativePlatform()&&P&&P.LocalNotifications))return;
const LN=P.LocalNotifications,BADGE=P.Badge;
const pad=n=>String(n).padStart(2,'0');
const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const at9=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d,9,0,0)};
const add=(s,n)=>{const d=at9(s);d.setDate(d.getDate()+n);return iso(d)};
const lastSeen=p=>[...(p.touches||[]).map(t=>t.date),p.textStats&&p.textStats.last,p.whatsappStats&&p.whatsappStats.last,p.instagramStats&&p.instagramStats.last].filter(Boolean).sort().pop()||null;
const due=(p,today)=>{const r=p.remind;if(!r)return null;let d=null;if(r.date)d=r.date;else if(r.every)d=add(lastSeen(p)||r.setAt||today,r.every);if(d&&r.snooze&&r.snooze>d)d=r.snooze;return d};
const idOf=s=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>1)%2000000000};
const ago=d=>{if(!d)return '';const n=Math.round((Date.now()-at9(d))/864e5);return n<14?`${n} days`:n<60?`${Math.round(n/7)} weeks`:n<365?`${Math.round(n/30)} months`:`over a year`};
let people=[],settings={},timer=0,asked=false;

async function permitted(ask){try{let s=await LN.checkPermissions();if(s.display!=='granted'&&ask&&!asked){asked=true;s=await LN.requestPermissions()}return s.display==='granted'}catch(_){return false}}

async function sync(){
  const today=iso(new Date()),now=Date.now(),on=!(settings.remind&&settings.remind.notifications===false);
  const withRem=people.filter(p=>p.remind);
  const dueNow=withRem.filter(p=>{const d=due(p,today);return d&&d<=today});
  try{if(BADGE)await BADGE.set({count:dueNow.length})}catch(_){}
  if(!await permitted(on&&withRem.length>0))return;
  try{const pend=await LN.getPending();if(pend.notifications.length)await LN.cancel({notifications:pend.notifications.map(n=>({id:n.id}))})}catch(_){}
  if(!on)return;
  const items=[];
  withRem.forEach(p=>{const d=due(p,today);if(!d)return;const t=at9(d);if(t.getTime()<=now)return;const first=p.first||'them',ls=lastSeen(p);
    items.push({kind:'r',t,p,title:`Reach out to ${first}`,body:p.remind.date?`You asked Orbit to remind you about ${first} today.`:`It’s been ${ago(ls)||'a while'} since you talked. Tap to say hi.`})});
  if(!(settings.remind&&settings.remind.homeBirthdays===false))people.forEach(p=>{if(p.circle==='In memory')return;
    const bday=(who,b,kid)=>{if(!b)return;const [,m,d]=String(b).split('-').map(Number);if(!m||!d)return;
      const y=new Date().getFullYear();let t=new Date(y,m-1,d,9);if(t.getTime()<=now)t=new Date(y+1,m-1,d,9);if(t.getTime()-now>60*864e5)return;
      items.push({kind:'b',key:kid?'k'+who:'',t,p,title:`${who||'Someone'}’s birthday is today`,body:kid?`${p.first||'Their parent'}’s kid. A quick note to ${p.first||'them'} goes a long way.`:'Send them a note. The Draft button can help.'})};
    bday(p.first,p.birthday,false);(p.kids||[]).forEach(k=>{if(k&&k.name)bday(k.name,k.birthday,true)})});
  items.sort((a,b)=>a.t-b.t);let count=dueNow.length;
  const notifications=items.slice(0,56).map(it=>{if(it.kind==='r')count++;return {id:idOf(it.kind+(it.key||'')+it.p.id+iso(it.t)),title:it.title,body:it.body,schedule:{at:it.t,allowWhileIdle:true},
    extra:{pid:it.p.id},threadIdentifier:it.kind==='r'?'orbit-reminders':'orbit-birthdays',summaryArgument:it.p.first||'',badge:count}});
  // The reach-out note: a nudge every week (or 2 weeks, or month) on a Sunday morning, counted from who's gone quiet.
  const R=settings.remind||{};
  if(R.weeklyNote!==false&&!(R.pauseUntil&&R.pauseUntil>=today)){const reach=+R.reachDays||90,every=Math.max(7,+R.noteEveryDays||7);
    const quiet=people.filter(p=>!['Outer Orbit','In memory','Long Orbit'].includes(p.circle)).filter(p=>{const ls=lastSeen(p);return !ls||(now-at9(ls).getTime())/864e5>reach}).length;
    if(quiet>0){const first=new Date();first.setHours(9,30,0,0);first.setDate(first.getDate()+((7-first.getDay())%7||7));
      for(let i=0;i<4;i++){const t=new Date(first);t.setDate(t.getDate()+i*every);notifications.push({id:idOf('note'+iso(t)),title:'Your Orbit note',body:`${quiet} ${quiet===1?'person':'people'} could use a hello. Tap to see who.`,schedule:{at:t,allowWhileIdle:true},extra:{view:'reach'},threadIdentifier:'orbit-note'})}}}
  if(notifications.length)try{await LN.schedule({notifications})}catch(e){console.error('schedule',e)}
}
const kick=()=>{clearTimeout(timer);timer=setTimeout(sync,1500)};

LN.addListener('localNotificationActionPerformed',a=>{const ex=a&&a.notification&&a.notification.extra||{};if(ex.view){location.hash='#'+ex.view;const b=document.querySelector(`[data-view="${ex.view}"]`);if(b)b.click();return}const id=ex.pid;if(!id)return;
  const tryOpen=(n)=>{if(window.orbitOpenPerson&&document.querySelector('#detail')){window.orbitOpenPerson(id)}else if(n<20)setTimeout(()=>tryOpen(n+1),300)};tryOpen(0)});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)kick()});

(async()=>{const db=await window.claude.use('db');if(!db)return;
  db.collection('contacts').onSnapshot(s=>{people=s.docs.map(d=>({...d.data(),id:d.id}));kick()});
  db.collection('meta').onSnapshot(s=>{const d=s.docs.find(x=>x.id==='settings');settings=d?d.data():{};kick()})})();
window.orbitAskNotifications=()=>permitted(true).then(kick);
})();
