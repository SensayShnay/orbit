// Orbit AI: drafts, personal reads and spins. Calls Claude with your key, signed-in users only.
// Deploy: Supabase dashboard > Edge Functions > Deploy a new function > name it "ai" > paste this.
// Then Edge Functions > Secrets: add ANTHROPIC_API_KEY.
import { createClient } from "npm:@supabase/supabase-js@2.117.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const MODELS: Record<string, string> = {
  quick: "claude-haiku-5-5",
  default: "claude-sonnet-5-5",
  complex: "claude-opus-5-5",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const auth = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ code: "not_granted", message: "Sign in first" }, 401);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ code: "unavailable", message: "Add ANTHROPIC_API_KEY in Edge Function secrets" }, 500);

  const { input, system, modelTier } = await req.json();
  const messages = typeof input === "string" ? [{ role: "user", content: input }] : input;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODELS[modelTier] ?? MODELS.default,
      max_tokens: 1500,
      ...(system ? { system } : {}),
      messages,
    }),
  });
  if (r.status === 429) return json({ code: "rate_limited", message: "Too many requests" }, 429);
  const out = await r.json();
  if (!r.ok) return json({ code: "unavailable", message: out?.error?.message ?? "AI error" }, 502);
  const text = (out.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
  return json({ text, truncated: out.stop_reason === "max_tokens" });
});
