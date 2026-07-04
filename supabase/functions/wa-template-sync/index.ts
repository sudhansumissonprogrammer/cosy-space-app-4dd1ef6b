// Pulls template approval status from Meta and reconciles platform_wa_templates.
//
// Two auth modes:
//   1. pg_cron → x-cron-secret header (runs hourly)
//   2. Admin user in dashboard → Supabase user JWT with app_role=admin
//      (used by the "Sync now" button so merchants don't wait for the hourly job)
//
// Also follows Meta's `paging.next` cursor so WABAs with >200 templates get
// fully reconciled instead of silently truncating at the first page.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, isValidCronHeader, loadPlatformConfig, platformConfigUsable } from "../_shared/wa-platform.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Accept EITHER the cron secret OR an authenticated admin user JWT.
  let authed = false;
  const cronOk = await isValidCronHeader(admin, req.headers.get("x-cron-secret") || "");
  if (cronOk) authed = true;
  else {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (token) {
      const { data: userData } = await admin.auth.getUser(token);
      const uid = userData?.user?.id;
      if (uid) {
        const { data: roleRow } = await admin
          .from("user_roles")
          .select("role")
          .eq("user_id", uid)
          .eq("role", "admin")
          .maybeSingle();
        if (roleRow) authed = true;
      }
    }
  }
  if (!authed) return j({ error: "unauthorized" }, 401);

  const cfg = await loadPlatformConfig(admin);
  if (!platformConfigUsable(cfg)) return j({ skipped: true, reason: "wa_disabled" });
  const waba = (cfg as any)?.wa_waba_id;
  const token = (cfg as any)?.wa_access_token;
  if (!waba || !token) return j({ skipped: true, reason: "no_waba_or_token" });

  // Paginate through Meta's paging.next cursor — WABAs with lots of templates
  // (or many language variants of the same template) can exceed one page.
  let url: string | null =
    `https://graph.facebook.com/v21.0/${waba}/message_templates?limit=200&fields=name,status,language,id,quality_score,category`;
  let total = 0;
  let updated = 0;
  const seen: string[] = [];
  const MAX_PAGES = 10; // safety ceiling

  for (let page = 0; page < MAX_PAGES && url; page++) {
    const r: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const body: any = await r.json().catch(() => ({}));
    if (!r.ok) return j({ error: "meta_error", details: body, page }, 502);

    for (const t of body?.data ?? []) {
      total++;
      seen.push(t.name);
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
    url = body?.paging?.next ?? null;
  }

  return j({ ok: true, total, updated, sample: seen.slice(0, 5) });
});
function j(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
