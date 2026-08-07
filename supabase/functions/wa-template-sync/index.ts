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
import { corsHeaders, isValidCronHeader, loadPlatformConfig, metaFetch, getMetaBreaker, isMetaBreakerOpen } from "../_shared/wa-platform.ts";

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

  // Circuit breaker: if Meta has been failing recently, skip entirely rather
  // than hammer the API (that's what got the account locked before).
  const breaker = await getMetaBreaker(admin);
  if (isMetaBreakerOpen(breaker)) {
    return j({ skipped: true, reason: "meta_breaker_open", open_until: breaker.open_until, last_error: breaker.last_error });
  }

  const cfg = await loadPlatformConfig(admin);
  if (!cfg?.wa_enabled) return j({ skipped: true, reason: "wa_disabled" });
  const waba = (cfg as any)?.wa_waba_id;
  const token = (cfg as any)?.wa_access_token;
  if (!waba || !token) return j({ skipped: true, reason: "no_waba_or_token" });

  // Paginate through Meta's paging.next cursor.
  let url: string | null =
    `https://graph.facebook.com/v21.0/${waba}/message_templates?limit=200&fields=name,status,language,id,quality_score,category`;
  let total = 0;
  let updated = 0;
  const seen: string[] = [];
  const MAX_PAGES = 10;

  for (let page = 0; page < MAX_PAGES && url; page++) {
    const res = await metaFetch(admin, url, { headers: { Authorization: `Bearer ${token}` } }, { source: "wa-template-sync" });
    if (res.breakerOpen) return j({ skipped: true, reason: "meta_breaker_open_midflight" });
    if (!res.ok) {
      const body = res.body;
      const metaMsg = body?.error?.message || "";
      const metaCode = body?.error?.code;
      const hint = metaCode === 200 || /access blocked/i.test(metaMsg)
        ? "WA_ACCESS_TOKEN is missing the 'whatsapp_business_management' permission, OR the System User is not assigned to this WABA in Meta Business Suite → Business Settings → System Users → Assigned Assets."
        : metaCode === 190
        ? "WA_ACCESS_TOKEN is expired or invalid. Regenerate it in Meta Business Suite."
        : "Meta rejected the templates request.";
      return j({ error: "meta_error", hint, details: body, page }, 502);
    }
    const body: any = res.body;
    for (const t of body?.data ?? []) {
      total++;
      seen.push(t.name);
      const patch = {
        meta_status: t.status,
        meta_template_id: t.id,
        quality_score: t?.quality_score?.score ?? null,
        language: t.language ?? "en",
        category: t.category ?? null,
        last_synced_at: new Date().toISOString(),
      } as any;
      // UPDATE-first: a blind upsert fails on existing rows because PostgREST
      // sends the row through the INSERT path first and NOT-NULL columns like
      // `purpose` are absent → 23502 and statuses never refreshed.
      const { data: existing } = await admin
        .from("platform_wa_templates")
        .select("name")
        .eq("name", t.name)
        .maybeSingle();
      const { error } = existing
        ? await admin.from("platform_wa_templates").update(patch).eq("name", t.name)
        : await admin.from("platform_wa_templates").insert({
            name: t.name,
            purpose: "transactional",
            is_active: false,
            paused: true,
            ...patch,
          } as any);
      if (error) console.warn("template sync failed", t.name, error.message);
      else updated++;
    }

    url = body?.paging?.next ?? null;
  }

  return j({ ok: true, total, updated, sample: seen.slice(0, 5) });
});
function j(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
