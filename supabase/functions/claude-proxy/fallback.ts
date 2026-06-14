// fallback.ts — multi-provider auto-fallback for claude-proxy.
// When Anthropic is rate-limited/overloaded/erroring, retry the SAME request on a
// strong model from another provider. Input & output stay Anthropic-shaped, so the
// app's response parsing (data.content[0].text) keeps working unchanged.
//
// Providers tried in order (only those with an API key set are attempted).
// Configure via Supabase Edge secrets:
//   GEMINI_API_KEY, OPENAI_API_KEY, DEEPSEEK_API_KEY
// Optional model/order overrides:
//   FALLBACK_ORDER          (default "gemini,openai,deepseek")
//   FALLBACK_GEMINI_MODEL   (default "gemini-3-pro")
//   FALLBACK_OPENAI_MODEL   (default "gpt-5.5")
//   FALLBACK_DEEPSEEK_MODEL (default "deepseek-chat")

type AnthropicMsg = { role: string; content: any };
type AnthropicPayload = { model?: string; system?: any; messages?: AnthropicMsg[]; max_tokens?: number };

const env = (k: string) => Deno.env.get(k) || "";

// Load provider keys/models/order from the provider_keys table (set via the admin UI,
// no redeploy needed). Read with the service role; the table is RLS-locked from anon.
// Returns a map keyed like the env vars; env is used as fallback when a field is empty.
async function loadKeys(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const sk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (url && sk) {
      const r = await fetch(url + "/rest/v1/provider_keys?id=eq.global&select=*", {
        headers: { apikey: sk, Authorization: "Bearer " + sk },
      });
      const rows = await r.json();
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row) {
        if (row.gemini_api_key) out.GEMINI_API_KEY = row.gemini_api_key;
        if (row.openai_api_key) out.OPENAI_API_KEY = row.openai_api_key;
        if (row.deepseek_api_key) out.DEEPSEEK_API_KEY = row.deepseek_api_key;
        if (row.gemini_model) out.FALLBACK_GEMINI_MODEL = row.gemini_model;
        if (row.openai_model) out.FALLBACK_OPENAI_MODEL = row.openai_model;
        if (row.deepseek_model) out.FALLBACK_DEEPSEEK_MODEL = row.deepseek_model;
        if (row.fallback_order) out.FALLBACK_ORDER = row.fallback_order;
      }
    }
  } catch (_e) { /* DB unavailable -> fall back to env only */ }
  return out;
}

// Flatten an Anthropic `system` (string OR array of text blocks) to plain text.
function flattenSystem(system: any): string {
  if (!system) return "";
  if (typeof system === "string") return system;
  if (Array.isArray(system)) return system.map((b: any) => (typeof b === "string" ? b : (b?.text || ""))).join("\n");
  return "";
}
// Flatten Anthropic message content (string OR array of blocks) to plain text.
function flattenContent(content: any): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((b: any) => (typeof b === "string" ? b : (b?.text || ""))).join("\n");
  return String(content);
}
// Wrap a plain text answer back into an Anthropic-shaped response object.
function asAnthropic(text: string, usage: any, provider: string, model: string) {
  return {
    content: [{ type: "text", text: text || "" }],
    stop_reason: "end_turn",
    usage: {
      input_tokens: usage?.input_tokens || 0,
      output_tokens: usage?.output_tokens || 0,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
    _fallback: { provider, model },
  };
}

async function callOpenAICompatible(base: string, key: string, model: string, p: AnthropicPayload) {
  const sys = flattenSystem(p.system);
  const msgs: any[] = [];
  if (sys) msgs.push({ role: "system", content: sys });
  for (const m of (p.messages || [])) msgs.push({ role: m.role === "assistant" ? "assistant" : "user", content: flattenContent(m.content) });
  const r = await fetch(base + "/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
    body: JSON.stringify({ model, max_tokens: p.max_tokens || 1024, messages: msgs }),
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const d = await r.json();
  const text = d?.choices?.[0]?.message?.content || "";
  return asAnthropic(text, { input_tokens: d?.usage?.prompt_tokens, output_tokens: d?.usage?.completion_tokens }, base.includes("deepseek") ? "deepseek" : "openai", model);
}

async function callGemini(key: string, model: string, p: AnthropicPayload) {
  const sys = flattenSystem(p.system);
  const contents = (p.messages || []).map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: flattenContent(m.content) }] }));
  const body: any = { contents, generationConfig: { maxOutputTokens: p.max_tokens || 1024 } };
  if (sys) body.systemInstruction = { parts: [{ text: sys }] };
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(key);
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const d = await r.json();
  const parts = d?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((x: any) => x?.text || "").join("");
  return asAnthropic(text, { input_tokens: d?.usageMetadata?.promptTokenCount, output_tokens: d?.usageMetadata?.candidatesTokenCount }, "gemini", model);
}

// Try each configured provider in order. Returns an Anthropic-shaped object or null if all fail.
export async function callFallback(payload: AnthropicPayload): Promise<any | null> {
  const db = await loadKeys();
  const get = (k: string) => db[k] || env(k);
  const order = (get("FALLBACK_ORDER") || "gemini,openai,deepseek").split(",").map((s) => s.trim()).filter(Boolean);
  for (const prov of order) {
    try {
      if (prov === "gemini" && get("GEMINI_API_KEY")) {
        return await callGemini(get("GEMINI_API_KEY"), get("FALLBACK_GEMINI_MODEL") || "gemini-3-pro", payload);
      }
      if (prov === "openai" && get("OPENAI_API_KEY")) {
        return await callOpenAICompatible("https://api.openai.com/v1", get("OPENAI_API_KEY"), get("FALLBACK_OPENAI_MODEL") || "gpt-5.5", payload);
      }
      if (prov === "deepseek" && get("DEEPSEEK_API_KEY")) {
        return await callOpenAICompatible("https://api.deepseek.com/v1", get("DEEPSEEK_API_KEY"), get("FALLBACK_DEEPSEEK_MODEL") || "deepseek-chat", payload);
      }
    } catch (_e) {
      // try the next provider
      continue;
    }
  }
  return null;
}

// True when the Anthropic response status warrants a fallback.
export function shouldFallback(status: number): boolean {
  return status === 429 || status === 529 || (status >= 500 && status <= 599);
}
