import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an e-commerce copywriter. You will receive a store name and what the store sells. Generate JSON only with these fields:

- store_description: 2-3 short lines describing the store
- meta_title: max 60 chars, SEO-friendly
- meta_description: max 150 chars, SEO-friendly
- about_us: 5-7 short lines, friendly tone, include a few emojis

Rules:
- Keep everything concise
- Simple and clear language
- No repetition
- No extra text, no markdown, no code fences
- Return ONLY valid JSON`;

function buildUserPrompt(storeName: string, storeDesc: string): string {
  return `Store Name: ${storeName}\nStore Description: ${storeDesc}\n\nReturn JSON:\n{"store_description":"","meta_title":"","meta_description":"","about_us":""}`;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
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
      max_tokens: 400,
      temperature: 0.7,
    }),
  }, 5000);

  if (!res.ok) {
    const text = await res.text();
    console.error("NVIDIA error:", res.status, text);
    throw new Error(`NVIDIA API failed: ${res.status}`);
  }

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

  if (!res.ok) {
    const text = await res.text();
    console.error("Lovable AI error:", res.status, text);
    throw new Error(`Lovable AI failed: ${res.status}`);
  }

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
    },
    4000
  );

  if (!res.ok) {
    const text = await res.text();
    console.error("Gemini error:", res.status, text);
    throw new Error(`Gemini API failed: ${res.status}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

function parseJsonResponse(raw: string): Record<string, string> {
  let cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found in response");
  cleaned = cleaned.substring(start, end + 1);
  return JSON.parse(cleaned);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { store_name, store_description } = await req.json();

    if (!store_name || typeof store_name !== "string" || store_name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "store_name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const trimmedName = store_name.trim().substring(0, 200);
    const trimmedDesc = (store_description || "").trim().substring(0, 500);

    let rawResponse = "";
    let provider = "";

    // 1. NVIDIA (5s timeout)
    try {
      rawResponse = await callNvidia(trimmedName, trimmedDesc);
      provider = "nvidia";
    } catch (e) {
      console.warn("NVIDIA failed:", e);
    }

    // 2. Lovable AI (3s timeout)
    if (!rawResponse) {
      try {
        rawResponse = await callLovableAI(trimmedName, trimmedDesc);
        provider = "lovable";
      } catch (e) {
        console.warn("Lovable AI failed:", e);
      }
    }

    // 3. Gemini (4s timeout)
    if (!rawResponse) {
      try {
        rawResponse = await callGemini(trimmedName, trimmedDesc);
        provider = "gemini";
      } catch (e) {
        console.warn("Gemini failed:", e);
      }
    }

    if (!rawResponse) throw new Error("All AI providers failed");

    const parsed = parseJsonResponse(rawResponse);

    const result = {
      store_description: (parsed.store_description || "").substring(0, 500),
      meta_title: (parsed.meta_title || "").substring(0, 60),
      meta_description: (parsed.meta_description || "").substring(0, 150),
      about_us: (parsed.about_us || "").substring(0, 2000),
      provider,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-store-content error:", e);
    return new Response(
      JSON.stringify({ error: "Unable to generate content. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
