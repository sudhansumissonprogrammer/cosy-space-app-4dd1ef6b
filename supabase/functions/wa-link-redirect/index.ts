// GET /functions/v1/wa-link-redirect?s=<short_id>&u=<base64url-of-target>
// Records a click in wa_link_clicks and 302-redirects.
import { createClient } from "npm:@supabase/supabase-js@2";

function b64urlDecode(s: string): string {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  try { return atob(s); } catch { return ""; }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const shortId = url.searchParams.get("s") || "";
  const encoded = url.searchParams.get("u") || "";
  const phone = url.searchParams.get("p") || null;
  const campaign = url.searchParams.get("c") || null;
  const target = b64urlDecode(encoded);

  if (!target || !/^https?:\/\//i.test(target)) {
    return new Response("Bad link", { status: 400 });
  }

  // Best-effort logging (don't block redirect)
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
    const ipHashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
    const ipHash = Array.from(new Uint8Array(ipHashBuf)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
    // Fire-and-forget
    admin.from("wa_link_clicks").insert({
      short_id: shortId || "anon",
      target_url: target,
      recipient_phone: phone,
      campaign_id: campaign,
      user_agent: req.headers.get("user-agent")?.slice(0, 500) || null,
      ip_hash: ipHash,
    }).then(() => {});
  } catch { /* swallow */ }

  return Response.redirect(target, 302);
});
