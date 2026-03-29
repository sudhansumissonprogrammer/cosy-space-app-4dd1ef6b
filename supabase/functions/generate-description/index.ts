import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT =
  "You are an expert e-commerce copywriter. Write a 3–4 line product description based on the product name provided. Make it attractive, clear, and professional. Focus on benefits and usability. Keep it concise. Do not use emojis. Do not use markdown formatting. Return only the description text, nothing else.";

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
      max_tokens: 300,
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

  if (!res.ok) {
    const text = await res.text();
    console.error("Lovable AI error:", res.status, text);
    throw new Error(`Lovable AI failed: ${res.status}`);
  }

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { product_name } = await req.json();

    if (!product_name || typeof product_name !== "string" || product_name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "product_name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (product_name.length > 500) {
      return new Response(
        JSON.stringify({ error: "product_name too long" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const trimmedName = product_name.trim();
    let description = "";
    let provider = "";

    // 1. NVIDIA (5s timeout)
    try {
      description = await callNvidia(trimmedName);
      provider = "nvidia";
    } catch (e) {
      console.warn("NVIDIA failed:", e);
    }

    // 2. Lovable AI (3s timeout)
    if (!description) {
      try {
        description = await callLovableAI(trimmedName);
        provider = "lovable";
      } catch (e) {
        console.warn("Lovable AI failed:", e);
      }
    }

    // 3. Gemini (4s timeout)
    if (!description) {
      try {
        description = await callGemini(trimmedName);
        provider = "gemini";
      } catch (e) {
        console.warn("Gemini failed:", e);
      }
    }

    if (!description) throw new Error("All AI providers failed");

    return new Response(
      JSON.stringify({ description, provider }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-description error:", e);
    return new Response(
      JSON.stringify({ error: "Failed to generate description. Try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
