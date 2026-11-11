// Message sync: Settings card for setting up the Mac helper, which sends who you texted and when (never the text).
(function(){
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CFG=()=>window.ORBIT_CONFIG||{};
const EP=()=>CFG().url+'/functions/v1/orbit-sync';
const HOW='https://sensayshnay.github.io/orbit/sync.html';
let st=null,info=null,loaded=false;
const ago=t=>{const m=Math.round((Date.now()-new Date(t))/6e4);return m<2?'just now':m<60?m+' min ago':m<1440?Math.round(m/60)+'h ago':Math.round(m/1440)+' days ago'};
function state(){if(!info&&!st)return ['off','Not set up'];
  if(st&&st.message==='no_access')return ['warn','Needs permission on your Mac. Turn on Full Disk Access for Orbit Message Sync.'];
  if(st&&!st.ok)return ['warn','Last try didn’t work ('+esc(st.message)+'). It will try again later.'];
  if(st&&st.at){const old=(Date.now()-new Date(st.at))>3*864e5;return [old?'warn':'ok',(old?'Hasn’t synced since ':'Working · last synced ')+ago(st.at)+' · '+st.people+' '+(st.people===1?'person':'people')+(old?'. Is your Mac on and awake sometimes?':'')]}
  return ['warn','Waiting for your Mac. Run the setup command, then turn on Full Disk Access.']}
function paint(){const el=document.getElementById('msyncCard');if(!el)return;const [k,t]=state(),on=!!(info||st);
  el.innerHTML=`<h3>Message sync <small class="ms-opt">Optional · needs a Mac</small></h3>
   <p class="lede">A small helper for your Mac that tells Orbit when you last talked to each person, so Reach out and drift alerts work without you logging anything.</p>
   <div class="ms-facts">
    <div class="ms-fact yes"><b>What it reads</b><span>Who you messaged and when, from 1-on-1 chats in Messages (and WhatsApp if it’s on your Mac).</span></div>
    <div class="ms-fact yes"><b>What it sends to Orbit</b><span>Message counts and dates, only for people already in your sphere. Everyone else stays on your Mac.</span></div>
    <div class="ms-fact no"><b>What it never does</b><span>Read, store or send the words in any message. Not to Orbit, not to anyone.</span></div>
    <div class="ms-fact"><b>Your control</b><span>Turn it off here any time. The code it uses stops working the moment you do, and the helper can be removed from your Mac in one step. The script is <a href="https://github.com/SensayShnay/orbit/blob/main/tools/mac/sync.sh" target="_blank" rel="noopener">open to read</a>.</span></div>
   </div>
   <p class="ms-status ${k}"><i></i><span>${t}</span></p>
   <div class="ms-acts">${on?'<button type="button" class="btn small" data-ms="email">Email me the setup again</button><button type="button" class="btn small" data-ms="setup">Show it here</button><button type="button" class="btn small" data-ms="off">Turn off</button>':'<button type="button" class="btn small primary" data-ms="email">Email me the setup</button><button type="button" class="btn small" data-ms="setup">Show it here</button>'}<a class="ms-how" href="${HOW}" target="_blank" rel="noopener">Full details</a></div>
   <p class="ms-mail" id="msMail" role="status"></p>`}
async function load(){const sb=window.orbitSB;if(!sb)return;try{const r=await sb.rpc('my_sync_token_info');info=r.data||null}catch(_){}loaded=true;paint()}
function sheet(html){close();const d=document.createElement('div');d.className='sg-sheet';d.id='msSheet';d.innerHTML=`<div class="sg-panel ms-panel" role="dialog" aria-modal="true" aria-labelledby="msT">${html}</div>`;
  d.addEventListener('click',e=>{if(e.target===d||e.target.closest('[data-ms-close]'))close()});document.body.appendChild(d);return d}
function close(){const d=document.getElementById('msSheet');if(d)d.remove()}
async function copy(text,btn){try{await navigator.clipboard.writeText(text)}catch(_){const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();try{document.execCommand('copy')}catch(_){}t.remove()}if(btn){const o=btn.textContent;btn.textContent='Copied';setTimeout(()=>btn.textContent=o,1500)}}
async function share(text){const P=window.Capacitor&&window.Capacitor.Plugins;try{if(P&&P.Share){await P.Share.share({title:'Orbit Message sync',text});return}if(navigator.share){await navigator.share({title:'Orbit Message sync',text});return}}catch(_){return}copy(text)}
async function setup(){const sb=window.orbitSB;let d=sheet('<div class="sg-top"><h3 id="msT">Set up Message sync</h3><button type="button" class="sg-x" data-ms-close aria-label="Close">✕</button></div><p class="sg-note">Making your private setup code…</p>');
  const r=await sb.rpc('create_sync_token');if(r.error||!r.data){d.querySelector('.sg-note').textContent='Couldn’t make a code just now. Try again.';return}
  const cmd=`curl -fsSL "${EP()}?get=install" | bash -s ${r.data}`;info={created_at:new Date().toISOString()};st=null;paint();
  d=sheet(`<div class="sg-top"><h3 id="msT">Set up Message sync</h3><button type="button" class="sg-x" data-ms-close aria-label="Close">✕</button></div>
   <ol class="ms-steps">
    <li><b>Get this line onto your Mac.</b> Tap Copy, then paste on your Mac (if they share an Apple ID, copy-paste just works). Or tap Send to AirDrop it or email it to yourself.</li>
    <li><b>Open Terminal on the Mac.</b> Press ⌘ Space, type <em>Terminal</em>, press Return.</li>
    <li><b>Paste the line and press Return.</b> It takes a few seconds, then opens Full Disk Access and shows you <em>Orbit Message Sync</em>.</li>
    <li><b>Turn it on.</b> Drag Orbit Message Sync into the Full Disk Access list, switch it on, and press Return in Terminal. Done.</li>
   </ol>
   <pre class="ms-cmd" aria-label="Setup command">${esc(cmd)}</pre>
   <div class="ms-row"><button type="button" class="sg-cta" id="msCopy">Copy</button><button type="button" class="sg-ghost wide" id="msSend">Send</button></div>
   <p class="sg-note">This line has a private code that links the Mac to your account, so only send it to yourself. It only shares who you messaged and when, for people already in your Orbit. Never what anyone said. <a href="${HOW}" target="_blank" rel="noopener">How it works</a></p>`);
  d.querySelector('#msCopy').onclick=e=>copy(cmd,e.currentTarget);d.querySelector('#msSend').onclick=()=>share(cmd)}
async function off(){if(!confirm('Turn off Message sync? Your Mac will stop sending updates. What’s already synced stays.'))return;
  await window.orbitSB.rpc('revoke_sync_tokens');info=null;st=null;paint();
  const cmd=`curl -fsSL "${EP()}?get=uninstall" | bash`;
  const d=sheet(`<div class="sg-top"><h3 id="msT">Message sync is off</h3><button type="button" class="sg-x" data-ms-close aria-label="Close">✕</button></div>
   <p class="sg-note">Your Mac can’t send anything anymore. To remove the helper from the Mac too, paste this into Terminal there:</p><pre class="ms-cmd">${esc(cmd)}</pre>
   <div class="ms-row"><button type="button" class="sg-cta" id="msCopy">Copy</button><button type="button" class="sg-ghost wide" data-ms-close>Done</button></div>`);
  d.querySelector('#msCopy').onclick=e=>copy(cmd,e.currentTarget)}
async function email(btn){const out=document.getElementById('msMail');btn.disabled=true;const was=btn.textContent;btn.textContent='Sending…';if(out)out.textContent='';
  try{const {data,error}=await window.orbitSB.functions.invoke('setup-email',{body:{}});
    if(error){let code='';try{const b=await error.context.json();code=b.code}catch(_){}
      if(out)out.textContent=code==='not_configured'?'Email isn’t switched on for Orbit yet. Use Show it here instead.':code==='rate_limited'?'You’ve had a few of these today. Check your inbox and spam, or use Show it here.':'Couldn’t send the email just now. Try Show it here.';return}
    info={created_at:new Date().toISOString()};st=null;paint();const o2=document.getElementById('msMail');if(o2)o2.textContent=`Sent to ${data&&data.to?data.to:'your email'}. Open it on your Mac and follow the steps. If you had Message sync set up before, that old code no longer works.`}
  catch(_){if(out)out.textContent='Couldn’t send the email just now. Try Show it here.'}
  finally{btn.disabled=false;btn.textContent=was}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-ms]');if(!b)return;e.preventDefault();if(b.dataset.ms==='setup')setup();if(b.dataset.ms==='off')off();if(b.dataset.ms==='email')email(b)});
new MutationObserver(()=>{const el=document.getElementById('msyncCard');if(el&&!el.firstChild){paint();load()}}).observe(document.body,{childList:true,subtree:true});
window.orbitOpenMessageSync=()=>setup();
window.claude.use('db').then(db=>{if(!db)return;db.collection('meta').onSnapshot(s=>{const d=s.docs.find(x=>x.id==='syncstatus');st=d?d.data():null;paint()})});
})();
