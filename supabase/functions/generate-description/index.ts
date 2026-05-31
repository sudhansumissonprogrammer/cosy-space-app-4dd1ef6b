import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT =
  "You are an expert e-commerce copywriter. Write a 3–4 line product description based on the product name provided. Make it attractive, clear, and professional. Focus on benefits and usability. Keep it concise. Do not use emojis. Do not use markdown formatting. Return only the description text, nothing else.";

// --- Provider health tracking ---
const COOLDOWN_MS = 5 * 60 * 1000;
const failedAt: Record<string, number> = {};

function isProviderActive(name: string): boolean {
  const t = failedAt[name];
  if (!t) return true;
  if (Date.now() - t > COOLDOWN_MS) { delete failedAt[name]; return true; }
  return false;
}

function markInactive(name: string) {
  failedAt[name] = Date.now();
  console.warn(`Provider ${name} marked inactive until ${new Date(Date.now() + COOLDOWN_MS).toISOString()}`);
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

async function callNvidia(productName: string): Promise<string> {
  const apiKey = Deno.env.get("NVIDIA_API_KEY");
  if (!apiKey) throw new Error("NVIDIA_API_KEY not set");
  const res = await fetchWithTimeout("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "meta/llama-3.1-8b-instruct",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Product name: ${productName}` },
      ],
      max_tokens: 300, temperature: 0.7,
    }),
  }, 5000);
  if (!res.ok) { const t = await res.text(); console.error("NVIDIA error:", res.status, t); throw new Error(`NVIDIA ${res.status}`); }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function callLovableAI(productName: string): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not set");
  const res = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Product name: ${productName}` },
      ],
    }),
  }, 3000);
  if (!res.ok) { const t = await res.text(); console.error("Lovable error:", res.status, t); throw new Error(`Lovable ${res.status}`); }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function callGemini(productName: string): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\nProduct name: ${productName}` }] }],
        generationConfig: { maxOutputTokens: 300, temperature: 0.7 },
      }),
    }, 4000);
  if (!res.ok) { const t = await res.text(); console.error("Gemini error:", res.status, t); throw new Error(`Gemini ${res.status}`); }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

const providers: { name: string; fn: (n: string) => Promise<string> }[] = [
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
    const { data: userData, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { product_name } = await req.json();
    if (!product_name || typeof product_name !== "string" || !product_name.trim()) {
      return new Response(JSON.stringify({ error: "product_name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (product_name.length > 500) {
      return new Response(JSON.stringify({ error: "product_name too long" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const trimmedName = product_name.trim();
    let description = "";
    let provider = "";

    for (const p of providers) {
      if (!isProviderActive(p.name)) {
        console.log(`Skipping inactive provider: ${p.name}`);
        continue;
      }
      try {
        description = await p.fn(trimmedName);
        if (description) { provider = p.name; break; }
      } catch (e) {
        console.warn(`${p.name} failed:`, e);
        markInactive(p.name);
      }
    }

    if (!description) throw new Error("All AI providers failed or inactive");

    return new Response(JSON.stringify({ description, provider }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-description error:", e);
    return new Response(JSON.stringify({ error: "Failed to generate description. Try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
