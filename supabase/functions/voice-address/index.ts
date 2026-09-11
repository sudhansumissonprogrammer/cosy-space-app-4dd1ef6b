// Voice → structured Indian delivery address.
//
// Flow: shopper speaks (any Indian language / Hinglish) → Lovable AI
// transcription → Lovable AI extraction into strict JSON fields → the client
// fills the checkout form. The pincode is authoritative on the client side
// (existing postalpincode lookup re-derives city/state), so an LLM mishearing
// a city name self-corrects.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GATEWAY = "https://ai.gateway.lovable.dev/v1";

const MAX_BYTES = 8 * 1024 * 1024; // ~4 min of 16 kHz mono WAV
const MIN_BYTES = 4000; // header-only / silent clip

const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry",
  "Chandigarh", "Andaman and Nicobar Islands", "Dadra and Nagar Haveli and Daman and Diu",
  "Lakshadweep",
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Snap a heard state to the official spelling (handles "UP", "MP", "Odissa"…). */
function normalizeState(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  const short: Record<string, string> = {
    up: "Uttar Pradesh", mp: "Madhya Pradesh", ap: "Andhra Pradesh", hp: "Himachal Pradesh",
    tn: "Tamil Nadu", wb: "West Bengal", jk: "Jammu and Kashmir", ka: "Karnataka",
    mh: "Maharashtra", gj: "Gujarat", rj: "Rajasthan", br: "Bihar", od: "Odisha",
    or: "Odisha", pb: "Punjab", hr: "Haryana", ts: "Telangana", ch: "Chhattisgarh",
    uk: "Uttarakhand", ncr: "Delhi",
  };
  const key = v.toLowerCase().replace(/[^a-z]/g, "");
  if (short[key]) return short[key];
  const exact = STATES.find((s) => s.toLowerCase() === v.toLowerCase());
  if (exact) return exact;
  const loose = STATES.find(
    (s) => s.toLowerCase().replace(/[^a-z]/g, "").startsWith(key.slice(0, 5)) && key.length >= 4,
  );
  return loose || v;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!LOVABLE_API_KEY) return json({ error: "ai_not_configured" }, 500);

  try {
    const form = await req.formData().catch(() => null);
    const file = form?.get("audio");
    if (!(file instanceof File)) return json({ error: "audio_required" }, 400);
    if (file.size > MAX_BYTES) return json({ error: "audio_too_large" }, 413);
    if (file.size < MIN_BYTES) return json({ error: "audio_too_short" }, 400);

    // 1) Transcribe (language auto-detected — shoppers mix Hindi/English freely).
    const stt = new FormData();
    stt.append("model", "google/gemini-3.5-transcribe");
    stt.append("file", file, "address.wav");
    const sttRes = await fetch(`${GATEWAY}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: stt,
    });
    if (!sttRes.ok) {
      const detail = await sttRes.text().catch(() => "");
      console.error("[voice-address] stt failed", sttRes.status, detail);
      return json({ error: "transcription_failed", status: sttRes.status, details: detail }, sttRes.status);
    }
    const transcript = String((await sttRes.json())?.text || "").trim();
    if (!transcript) return json({ error: "no_speech" }, 422);

    // 2) Extract fields. Temperature 0 + strict schema keeps it deterministic.
    const chatRes = await fetch(`${GATEWAY}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: [
              "You extract an Indian delivery address from a spoken sentence.",
              "The speech may be Hindi, Hinglish, or any Indian language, often unpunctuated.",
              "Return ONLY the requested fields. Use an empty string for anything not clearly said — never guess.",
              "Rules:",
              "- full_name: person's name only, no honorifics (ji, shri, mr).",
              "- phone: 10 digits, drop +91/0 prefix. Spoken digit words (do, teen, panch, छह) become digits.",
              "- pincode: exactly 6 digits, spoken digit-by-digit or as pairs; empty if not 6 digits.",
              "- city: town/city/village name in English transliteration.",
              "- state: full official Indian state or union territory name in English.",
              "- street: everything else about the location — house/flat number, building, street, colony, sector, area, ward, post office, landmark ('near ...'), village/tehsil. Keep the speaker's order, Title Case, no trailing punctuation.",
              "- Do not repeat the city, state, or pincode inside street unless the speaker used it as part of a landmark.",
              "Transliterate Devanagari place and person names into readable English.",
            ].join("\n"),
          },
          { role: "user", content: transcript },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "fill_address",
              description: "Return the address fields extracted from the speech.",
              parameters: {
                type: "object",
                properties: {
                  full_name: { type: "string" },
                  phone: { type: "string" },
                  pincode: { type: "string" },
                  city: { type: "string" },
                  state: { type: "string" },
                  street: { type: "string" },
                },
                required: ["full_name", "phone", "pincode", "city", "state", "street"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "fill_address" } },
      }),
    });
    if (!chatRes.ok) {
      const detail = await chatRes.text().catch(() => "");
      console.error("[voice-address] extract failed", chatRes.status, detail);
      return json({ error: "extraction_failed", status: chatRes.status, details: detail, transcript }, chatRes.status);
    }
    const chat = await chatRes.json();
    const args = chat?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let parsed: Record<string, string> = {};
    try {
      parsed = typeof args === "string" ? JSON.parse(args) : (args || {});
    } catch {
      return json({ error: "extraction_unreadable", transcript }, 422);
    }

    const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
    const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
    let phone = digits(parsed.phone);
    if (phone.length > 10) phone = phone.slice(-10);
    if (phone.length !== 10 || !/^[6-9]/.test(phone)) phone = "";
    const pincode = digits(parsed.pincode).slice(0, 6);

    return json({
      transcript,
      address: {
        full_name: clean(parsed.full_name),
        phone,
        pincode: pincode.length === 6 ? pincode : "",
        city: clean(parsed.city),
        state: normalizeState(clean(parsed.state)),
        street: clean(parsed.street),
      },
    });
  } catch (e) {
    console.error("[voice-address] unexpected", e);
    return json({ error: "unexpected", message: String((e as Error)?.message || e) }, 500);
  }
});
