import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT =
  "You are an expert e-commerce copywriter. Write a 3–4 line product description based on the product name provided. Make it attractive, clear, and professional. Focus on benefits and usability. Keep it concise. Do not use emojis. Do not use markdown formatting. Return only the description text, nothing else.";

async function callNvidia(productName: string): Promise<string> {
  const apiKey = Deno.env.get("NVIDIA_API_KEY");
  if (!apiKey) throw new Error("NVIDIA_API_KEY not set");

  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "meta/llama-3.1-8b-instruct",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Product name: ${productName}` },
      ],
      max_tokens: 300,
      temperature: 0.7,
    }),
  });

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

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Product name: ${productName}` },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Lovable AI error:", res.status, text);
    throw new Error(`Lovable AI failed: ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
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
    let usedFallback = false;

    // Primary: NVIDIA
    try {
      description = await callNvidia(trimmedName);
    } catch (e) {
      console.warn("NVIDIA failed, falling back to Lovable AI:", e);
      usedFallback = true;
      // Fallback: Lovable AI
      description = await callLovableAI(trimmedName);
    }

    if (!description) throw new Error("Empty response from AI");

    return new Response(
      JSON.stringify({ description, fallback: usedFallback }),
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
