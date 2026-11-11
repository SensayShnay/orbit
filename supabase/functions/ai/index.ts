// Orbit AI: drafts, personal reads and spins. Calls Claude with your key, signed-in users only.
// Each person gets a daily allowance (ai_take in the database) and requests are size-capped,
// so nobody can run up the bill.
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
};
const MAX_CHARS = 16000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ code: "unavailable", message: "POST only" }, 405);
  const auth = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ code: "not_granted", message: "Sign in first" }, 401);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ code: "unavailable", message: "Add ANTHROPIC_API_KEY in Edge Function secrets" }, 500);

  let body: { input?: unknown; system?: unknown; modelTier?: string };
  try { body = await req.json(); } catch { return json({ code: "unavailable", message: "Bad request" }, 400); }
  const { input, system, modelTier } = body;
  const messages = typeof input === "string" ? [{ role: "user", content: input }] : input;
  if (!Array.isArray(messages) || !messages.length) return json({ code: "unavailable", message: "Nothing to write" }, 400);
  const size = JSON.stringify(messages).length + (typeof system === "string" ? system.length : 0);
  if (size > MAX_CHARS) return json({ code: "too_large", message: "That request is too long" }, 413);

  const take = await sb.rpc("ai_take");
  if (take.error || take.data !== true) return json({ code: "rate_limited", message: "Daily limit reached" }, 429);

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODELS[modelTier ?? ""] ?? MODELS.default,
      max_tokens: 1000,
      ...(typeof system === "string" && system ? { system } : {}),
      messages,
    }),
  });
  if (r.status === 429) return json({ code: "rate_limited", message: "Too many requests" }, 429);
  const out = await r.json();
  if (!r.ok) return json({ code: "unavailable", message: out?.error?.message ?? "AI error" }, 502);
  const text = (out.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
  return json({ text, truncated: out.stop_reason === "max_tokens" });
});
