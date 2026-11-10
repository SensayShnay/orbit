// Orbit sync endpoint. The Mac posts counts and dates (never message text).
// Auth: a sync token (x-orbit-token header) checked against the sync_tokens table.
// GET ?get=install|sync|uninstall serves the Message sync scripts for testers' Macs (no token, no data),
// straight from the public repo (tools/mac/*.sh). kind "script" serves the owner's tools/orbit_push.py.
import { createClient } from "npm:@supabase/supabase-js@2.117.0";

const RAW = "https://raw.githubusercontent.com/SensayShnay/orbit/main/tools/";
const MAC = new Set(["install", "sync", "uninstall"]);
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const fetchText = async (path: string) => {
  const r = await fetch(RAW + path, { headers: { "Cache-Control": "no-cache" } });
  if (!r.ok) throw new Error("fetch " + r.status);
  return await r.text();
};

Deno.serve(async (req) => {
  if (req.method === "GET") {
    const g = new URL(req.url).searchParams.get("get") ?? "";
    if (!MAC.has(g)) return new Response("Orbit Message sync", { status: 404 });
    try {
      return new Response(await fetchText(`mac/${g}.sh`), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
    } catch { return new Response("echo 'Could not download Orbit Message sync. Try again in a minute.'; exit 1", { status: 502 }); }
  }
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const token = req.headers.get("x-orbit-token") ?? "";
  if (!token.startsWith("orb_")) return json({ error: "missing token" }, 401);
  let body: { kind?: string; payload?: unknown };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const kind = body.kind ?? "";
  if (!["handles", "hnorm", "stats", "wrapped", "summary", "status", "script"].includes(kind)) return json({ error: "bad kind" }, 400);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await sb.rpc("orbit_sync_ingest", { p_token: token, p_kind: kind === "script" ? "handles" : kind, p_payload: body.payload ?? {} });
  if (error) return json({ error: error.message }, error.code === "28000" ? 401 : 500);
  if (kind === "script") {
    try { return new Response(await fetchText("orbit_push.py"), { headers: { "Content-Type": "text/x-python" } }); }
    catch { return json({ error: "script unavailable" }, 502); }
  }
  return json(data);
});
