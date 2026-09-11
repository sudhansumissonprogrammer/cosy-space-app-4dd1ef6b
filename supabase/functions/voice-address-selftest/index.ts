// Temporary self-test: synthesizes a spoken address and runs it through
// the voice-address function end to end. Safe to delete.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const key = Deno.env.get("LOVABLE_API_KEY")!;
  const text = (await req.json().catch(() => ({})))?.text ||
    "My name is Rahul Sharma, phone nine eight seven six five four three two one zero, house number 12 B, Krishna Nagar, near Shiv Mandir, Lucknow, Uttar Pradesh, pincode two two six zero one zero";
  const tts = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "openai/gpt-4o-mini-tts", input: text, voice: "alloy", response_format: "mp3", stream_format: "audio" }),
  });
  if (!tts.ok) return new Response(JSON.stringify({ step: "tts", status: tts.status, body: await tts.text() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const audio = new Uint8Array(await tts.arrayBuffer());
  const form = new FormData();
  form.append("audio", new File([audio], "address.mp3", { type: "audio/mpeg" }));
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/voice-address`, { method: "POST", body: form });
  return new Response(JSON.stringify({ status: res.status, result: await res.json().catch(() => null) }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
