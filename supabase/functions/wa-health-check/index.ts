// Every 6h: snapshot Meta phone quality / messaging tier / token validity.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, isValidCronHeader, loadPlatformConfig } from "../_shared/wa-platform.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  if (!(await isValidCronHeader(admin, req.headers.get("x-cron-secret") || ""))) {
    return j({ error: "unauthorized" }, 401);
  }

  const cfg = await loadPlatformConfig(admin);
  const phoneId = (cfg as any)?.wa_phone_number_id;
  const token = (cfg as any)?.wa_access_token;
  if (!phoneId || !token) return j({ skipped: true, reason: "no_creds" });

  const out: any = { phone_number_id: phoneId };

  // Phone quality / tier
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}?fields=quality_rating,messaging_limit_tier,name_status,verified_name`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await r.json().catch(() => ({}));
    out.phone = data;
    out.quality_rating = data?.quality_rating ?? null;
    out.messaging_limit_tier = data?.messaging_limit_tier ?? null;
    out.name_status = data?.name_status ?? null;
  } catch (e) { out.phone_error = (e as Error).message; }

  // Token validity (debug_token requires app_token; fall back to a cheap call)
  try {
    const r2 = await fetch(`https://graph.facebook.com/v21.0/me?fields=id`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    out.token_valid = r2.ok;
    if (!r2.ok) out.token_error = await r2.text();
  } catch { out.token_valid = false; }

  await admin.from("wa_health_log").insert({
    phone_number_id: phoneId,
    quality_rating: out.quality_rating,
    messaging_limit_tier: out.messaging_limit_tier,
    name_status: out.name_status,
    token_valid: !!out.token_valid,
    raw: out,
  });

  return j({ ok: true, snapshot: out });
});
function j(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
