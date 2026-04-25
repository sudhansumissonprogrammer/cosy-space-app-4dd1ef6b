import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an e-commerce copywriter. You will receive a store name and what the store sells. Generate JSON only with these fields:

- store_description: 2-3 short lines describing the store
- meta_title: max 60 chars, SEO-friendly
- meta_description: max 150 chars, SEO-friendly
- about_us: 3-4 lines welcome paragraph about the store. Friendly tone, mention what makes them special. Include 1-2 emojis. This is ONLY a short welcome intro, NOT the full about page.

Rules:
- Keep everything concise
- Simple and clear language
- No repetition
- No extra text, no markdown, no code fences
- Return ONLY valid JSON`;

function buildUserPrompt(storeName: string, storeDesc: string): string {
  return `Store Name: ${storeName}\nStore Description: ${storeDesc}\n\nReturn JSON:\n{"store_description":"","meta_title":"","meta_description":"","about_us":""}`;
}

// --- Provider health tracking ---
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const failedAt: Record<string, number> = {};

function isProviderActive(name: string): boolean {
  const t = failedAt[name];
  if (!t) return true;
  if (Date.now() - t > COOLDOWN_MS) {
    delete failedAt[name];
    return true;
  }
  return false;
}

function markInactive(name: string) {
  failedAt[name] = Date.now();
  console.warn(`Provider ${name} marked inactive until ${new Date(Date.now() + COOLDOWN_MS).toISOString()}`);
}

// --- Fetch with timeout ---
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callNvidia(storeName: string, storeDesc: string): Promise<string> {
  const apiKey = Deno.env.get("NVIDIA_API_KEY");
  if (!apiKey) throw new Error("NVIDIA_API_KEY not set");
  const res = await fetchWithTimeout("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "meta/llama-3.1-8b-instruct",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(storeName, storeDesc) },
      ],
      max_tokens: 400, temperature: 0.7,
    }),
  }, 5000);
  if (!res.ok) { const t = await res.text(); console.error("NVIDIA error:", res.status, t); throw new Error(`NVIDIA ${res.status}`); }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function callLovableAI(storeName: string, storeDesc: string): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not set");
  const res = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(storeName, storeDesc) },
      ],
    }),
  }, 3000);
  if (!res.ok) { const t = await res.text(); console.error("Lovable error:", res.status, t); throw new Error(`Lovable ${res.status}`); }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function callGemini(storeName: string, storeDesc: string): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${buildUserPrompt(storeName, storeDesc)}` }] }],
        generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
      }),
    }, 4000);
  if (!res.ok) { const t = await res.text(); console.error("Gemini error:", res.status, t); throw new Error(`Gemini ${res.status}`); }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

function parseJsonResponse(raw: string): Record<string, string> {
  let cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found");
  return JSON.parse(cleaned.substring(start, end + 1));
}

// Ordered provider list
const providers: { name: string; fn: (n: string, d: string) => Promise<string> }[] = [
  { name: "nvidia", fn: callNvidia },
  { name: "lovable", fn: callLovableAI },
  { name: "gemini", fn: callGemini },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check - prevent anonymous AI credit drain
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: authErr } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (authErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { store_name, store_description } = await req.json();
    if (!store_name || typeof store_name !== "string" || !store_name.trim()) {
      return new Response(JSON.stringify({ error: "store_name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const trimmedName = store_name.trim().substring(0, 200);
    const trimmedDesc = (store_description || "").trim().substring(0, 500);

    let rawResponse = "";
    let provider = "";

    for (const p of providers) {
      if (!isProviderActive(p.name)) {
        console.log(`Skipping inactive provider: ${p.name}`);
        continue;
      }
      try {
        rawResponse = await p.fn(trimmedName, trimmedDesc);
        if (rawResponse) { provider = p.name; break; }
      } catch (e) {
        console.warn(`${p.name} failed:`, e);
        markInactive(p.name);
      }
    }

    if (!rawResponse) throw new Error("All AI providers failed or inactive");

    const parsed = parseJsonResponse(rawResponse);
    const result = {
      store_description: (parsed.store_description || "").substring(0, 500),
      meta_title: (parsed.meta_title || "").substring(0, 60),
      meta_description: (parsed.meta_description || "").substring(0, 150),
      about_us: (parsed.about_us || "").substring(0, 4000),
      provider,
    };

    return new Response(JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-store-content error:", e);
    return new Response(JSON.stringify({ error: "Unable to generate content. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
