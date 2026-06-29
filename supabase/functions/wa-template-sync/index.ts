// Hourly: pull template approval status from Meta and reconcile platform_wa_templates.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, isValidCronHeader, loadPlatformConfig } from "../_shared/wa-platform.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  if (!(await isValidCronHeader(admin, req.headers.get("x-cron-secret") || ""))) {
    return j({ error: "unauthorized" }, 401);
  }
  const cfg = await loadPlatformConfig(admin);
  const waba = (cfg as any)?.wa_waba_id;
  const token = (cfg as any)?.wa_access_token;
  if (!waba || !token) return j({ skipped: true, reason: "no_waba_or_token" });

  const r = await fetch(`https://graph.facebook.com/v21.0/${waba}/message_templates?limit=200&fields=name,status,language,id,quality_score,category`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) return j({ error: "meta_error", details: body }, 502);

  let updated = 0;
  for (const t of body?.data ?? []) {
    const { error } = await admin
      .from("platform_wa_templates")
      .update({
        meta_status: t.status,
        meta_template_id: t.id,
        quality_score: t?.quality_score?.score ?? null,
        language: t.language ?? undefined,
        last_synced_at: new Date().toISOString(),
      })
      .eq("name", t.name);
    if (!error) updated++;
  }
  return j({ ok: true, total: body?.data?.length ?? 0, updated });
});
function j(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
