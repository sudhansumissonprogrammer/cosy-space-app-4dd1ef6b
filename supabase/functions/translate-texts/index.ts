import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const Body = z.object({
  lang: z.enum(["hi", "hinglish"]),
  texts: z.array(z.string().min(1).max(2000)).min(1).max(80),
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sha(t: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const RULES = (lang: string) => `You translate short pieces of an Indian online shop's website from English into ${
  lang === "hi"
    ? "natural, simple, correct Hindi written in Devanagari script (as used by Indian shoppers; common shopping words like Cart, COD, UPI, OTP may stay in English)"
    : "natural Hinglish: everyday Hindi written ONLY in English/Latin letters, mixing common English shopping words (e.g. 'Cart mein add karein', 'Abhi kharidein', 'Free delivery milegi')"
}.
Strict rules:
- Keep ALL numbers, digits, prices, ₹ amounts, percentages, phone numbers, pincodes, order IDs, dates, sizes exactly as written (Western digits 0-9, never Devanagari digits).
- Keep brand names, model names, product names, store names, coupon codes, emails, URLs and emojis unchanged.
- Keep leading/trailing spaces and punctuation style. Do not add explanations or quotes.
- If a piece is already not English or should not change, return it unchanged.
Return one translation per input, same order, same count.`;

async function translate(lang: string, texts: string[]): Promise<string[]> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("missing key");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      reasoning_effort: "low",
      stream: true,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "translations",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["items"],
            properties: { items: { type: "array", items: { type: "string" } } },
          },
        },
      },
      messages: [
        { role: "system", content: RULES(lang) },
        { role: "user", content: JSON.stringify({ items: texts }) },
      ],
    }),
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    const e = new Error(`gateway ${res.status}: ${t.slice(0, 300)}`) as Error & { status?: number };
    e.status = res.status;
    throw e;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const l of lines) {
      const s = l.trim();
      if (!s.startsWith("data:")) continue;
      const p = s.slice(5).trim();
      if (p === "[DONE]") continue;
      try { out += JSON.parse(p).choices?.[0]?.delta?.content || ""; } catch { /* partial */ }
    }
  }
  const items = JSON.parse(out).items as string[];
  if (!Array.isArray(items) || items.length !== texts.length) throw new Error("count mismatch");
  return items;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let parsed;
  try { parsed = Body.safeParse(await req.json()); } catch { return json({ error: "bad json" }, 400); }
  if (!parsed.success) return json({ error: "invalid" }, 400);
  const { lang } = parsed.data;
  const texts = [...new Set(parsed.data.texts)];

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const hashes = await Promise.all(texts.map(sha));
  const result: Record<string, string> = {};
  const { data: cached } = await db.from("ui_translations").select("src_hash, translated").eq("lang", lang).in("src_hash", hashes);
  const byHash = new Map((cached || []).map((r) => [r.src_hash, r.translated]));
  const missing: string[] = [];
  texts.forEach((t, i) => {
    const hit = byHash.get(hashes[i]);
    if (hit != null) result[t] = hit; else missing.push(t);
  });

  if (missing.length) {
    try {
      const translated = await translate(lang, missing);
      const rows = await Promise.all(missing.map(async (t, i) => ({ lang, src_hash: await sha(t), src_text: t, translated: translated[i] })));
      rows.forEach((r) => (result[r.src_text] = r.translated));
      await db.from("ui_translations").upsert(rows, { onConflict: "lang,src_hash", ignoreDuplicates: true });
    } catch (e) {
      const status = (e as { status?: number }).status;
      console.error("translate failed", String(e));
      return json({ translations: result, partial: true }, status && [402, 403, 429].includes(status) ? status : 200);
    }
  }
  return json({ translations: result });
});
