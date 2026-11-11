// Emails the signed-in person their own Message sync setup instructions (with their private setup line).
// Sends through Resend. Needs two Edge Function secrets: RESEND_API_KEY and ORBIT_MAIL_FROM (an address on
// the domain verified in Resend, e.g. "Orbit <orbit@mail.example.com>"). Limited to 3 emails a day per person.
import { createClient } from "npm:@supabase/supabase-js@2.117.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ code: "bad_request" }, 405);
  const key = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("ORBIT_MAIL_FROM");
  if (!key || !from) return json({ code: "not_configured", message: "Email isn't set up yet" }, 503);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await sb.auth.getUser();
  if (!user || !user.email) return json({ code: "not_granted", message: "Sign in first" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const lim = await admin.rpc("orbit_rate_ok_for", { p_user: user.id, p_kind: "setupmail", p_max: 3, p_window: "1 day" });
  if (lim.error || lim.data !== true) return json({ code: "rate_limited", message: "That's enough emails for today" }, 429);

  const tok = await sb.rpc("create_sync_token");
  if (tok.error || !tok.data) return json({ code: "unavailable", message: "Couldn't make a setup code" }, 500);
  const base = `${Deno.env.get("SUPABASE_URL")}/functions/v1/orbit-sync`;
  const cmd = `curl -fsSL "${base}?get=install" | bash -s ${tok.data}`;
  const name = (user.user_metadata?.name as string | undefined) ?? "";

  const text = `Hi${name ? " " + name.split(" ")[0] : ""},

Here's how to set up Message sync for Orbit on your Mac. It takes about two minutes.

WHAT IT DOES
Message sync tells Orbit WHO you messaged and WHEN, so Orbit can show who you haven't talked to in a while. It never reads, stores or sends WHAT anyone said. It only sends counts for people who are already in your Orbit; everyone else stays on your Mac. You can turn it off any time in Orbit > Settings > Message sync.

SETUP
1. On your Mac, open Terminal. Press Command + Space, type Terminal, press Return.
2. Copy this whole line, paste it into Terminal, and press Return:

${cmd}

3. It installs a small app called "Orbit Message Sync" and opens System Settings on Full Disk Access, plus a Finder window showing the app. Drag "Orbit Message Sync" into the Full Disk Access list and switch it on. macOS needs this permission for any app to read Messages.
4. Go back to Terminal and press Return. It syncs once right away, then twice a day on its own.

This line contains a private code that links your Mac to your Orbit account, so please don't forward this email. If you ever want a new code, tap "Email me the setup" again in Orbit and the old one stops working.

How it works, in detail: https://sensayshnay.github.io/orbit/sync.html
To remove it later: paste  curl -fsSL "${base}?get=uninstall" | bash  into Terminal.

Orbit`;

  const html = `<div style="font:16px/1.55 -apple-system,Helvetica,Arial,sans-serif;color:#1A1830;max-width:600px;margin:0 auto;padding:24px">
<p>Hi${name ? " " + esc(name.split(" ")[0]) : ""},</p>
<p>Here's how to set up <b>Message sync</b> for Orbit on your Mac. It takes about two minutes.</p>
<div style="background:#F3EEE3;border-radius:14px;padding:16px 18px;margin:18px 0">
<p style="margin:0 0 8px"><b>What it does</b></p>
<p style="margin:0 0 8px">Message sync tells Orbit <b>who</b> you messaged and <b>when</b>, so Orbit can show who you haven't talked to in a while.</p>
<p style="margin:0 0 8px">It never reads, stores or sends <b>what</b> anyone said. It only sends counts for people who are already in your Orbit; everyone else stays on your Mac.</p>
<p style="margin:0">You can turn it off any time in Orbit &rsaquo; Settings &rsaquo; Message sync.</p></div>
<p><b>Setup</b></p>
<ol style="padding-left:20px">
<li style="margin-bottom:10px">On your Mac, open <b>Terminal</b>. Press <b>Command + Space</b>, type <i>Terminal</i>, press Return.</li>
<li style="margin-bottom:10px">Copy this whole line, paste it into Terminal, and press Return:<br>
<code style="display:block;margin:10px 0;padding:12px 14px;background:#1A1830;color:#F2F0EA;border-radius:10px;font:13px/1.5 Menlo,monospace;word-break:break-all">${esc(cmd)}</code></li>
<li style="margin-bottom:10px">It installs a small app called <b>Orbit Message Sync</b> and opens System Settings on <b>Full Disk Access</b>, plus a Finder window showing the app. Drag <b>Orbit Message Sync</b> into the Full Disk Access list and switch it on. macOS needs this permission for any app to read Messages.</li>
<li>Go back to Terminal and press Return. It syncs once right away, then twice a day on its own.</li></ol>
<p style="color:#5E5B72;font-size:14px">This line contains a private code that links your Mac to your Orbit account, so please don't forward this email. If you ever want a new code, tap <b>Email me the setup</b> again in Orbit and the old one stops working.</p>
<p style="color:#5E5B72;font-size:14px"><a href="https://sensayshnay.github.io/orbit/sync.html" style="color:#B07A1E">How it works, in detail</a> &middot; To remove it later, paste <code>curl -fsSL "${esc(base)}?get=uninstall" | bash</code> into Terminal.</p>
<p>Orbit</p></div>`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [user.email], subject: "Set up Message sync for Orbit (2 minutes)", text, html }),
  });
  if (!r.ok) { const e = await r.text(); return json({ code: "send_failed", message: e.slice(0, 200) }, 502); }
  return json({ ok: true, to: user.email });
});
