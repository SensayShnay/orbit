// Builds www/index.html from src/orbit.html (the same Orbit you use in Claude) plus the Supabase runtime.
import fs from 'node:fs';
const src = fs.readFileSync('src/orbit.html', 'utf8');
const read = f => fs.readFileSync(f, 'utf8');
let app = src;
const swap = (a, b) => { if (!app.includes(a)) throw new Error('build: could not find ' + a.slice(0, 60)); app = app.split(a).join(b); };
swap('src="/_blob/${p.photo}"', 'src="${window.ORBIT_BLOB(p.photo)}"');
swap('Open this page signed in to Claude to see your people. Your sphere is stored privately and loads only for you.', 'Couldn’t reach your Orbit. Check your connection and reopen the app.');
swap('Your Orbit is private to your Claude account.</p></section>',
  'Your Orbit is private to your account.</p><div class="acts" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button type="button" class="btn small" data-orbit="restore">Restore from backup</button><button type="button" class="btn small" data-orbit="signout">Sign out</button><button type="button" class="btn small" data-orbit="delete" style="color:var(--danger)">Delete my account</button></div></section>');
swap('<meta name="claude:viewport-fit-sides" content="cover">', '');
// invite button on each person's card, and an Invite card in Settings
swap("${a(p.email?'mailto:'+p.email:'','mail','Email')}</div>", "${a(p.email?'mailto:'+p.email:'','mail','Email')}</div><button type=\"button\" class=\"invbar\" data-orbit=\"invite\" data-pid=\"${esc(p.id)}\" data-first=\"${esc(p.first||'')}\" data-phone=\"${e164?'+'+e164:''}\"><svg><use href=\"#i-gift\"/></svg>${p.invitedAt?'Invited to Orbit · send again':'Invite '+esc(p.first||'them')+' to Orbit'}</button>");
swap('<section class="scard"><h3>About Orbit</h3>', '<section class="scard" id="reportsCard" hidden></section><section class="scard" id="msyncCard"></section><section class="scard"><h3>Invite friends</h3><p class="lede">Every friend gets your code, so you can see who joined through you.</p><p id="orbitInviteInfo" style="margin:8px 0 12px">Loading your code…</p><button type="button" class="btn small primary" data-orbit="invite">Share an invite</button></section><section class="scard"><h3>About Orbit</h3>');
swap('<div id="signalRow"></div>', '<div id="adminBar"></div><div id="signalRow"></div>');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="theme-color" content="#0c0f1f">
<style>*,*::before,*::after{box-sizing:border-box}body{margin:0;-webkit-text-size-adjust:100%}[hidden]{display:none!important}
${read('src/shim.css')}${read('src/onboard.css')}${read('src/signals.css')}</style>
<script>${read('node_modules/@supabase/supabase-js/dist/umd/supabase.js')}</script>
<script>${read('src/config.js')}</script>
<script>${read('src/contacts.js')}</script><script>${read('src/onboard.js')}</script>
<script>${read('src/shim.js')}</script>
</head><body>${app}<script>${read('src/extra.js')}</script><script>${read('src/notify.js')}</script><script>${read('src/signals.js')}</script><script>${read('src/msync.js')}</script><script>${read('src/admin.js')}</script></body></html>`;
fs.mkdirSync('www', { recursive: true });
// The hosted password-reset page needs the same public config.
fs.writeFileSync('docs/config.js', read('src/config.js'));
fs.writeFileSync('www/index.html', html);
console.log('Built www/index.html', (html.length / 1e6).toFixed(2) + 'MB');
