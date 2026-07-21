// Public storefront-facing edge function to capture app leads (Spin Wheel, etc.).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const svc = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const {
    store_id,
    app_id,
    phone,
    country_code = "+91",
    marketing_opt_in = false,
    coupon_code = null,
    segment_label = null,
    metadata = {},
  } = body ?? {};

  if (!store_id || typeof store_id !== "string") return json({ error: "store_id required" }, 400);
  if (!app_id || typeof app_id !== "string") return json({ error: "app_id required" }, 400);
  const cleanedPhone = String(phone || "").replace(/\D/g, "");
  const APPS_REQUIRING_PHONE = new Set(["spin-wheel"]);
  if (APPS_REQUIRING_PHONE.has(app_id)) {
    if (!/^[6-9]\d{9}$/.test(cleanedPhone)) return json({ error: "invalid_phone" }, 400);
  }

  const supa = svc();

  const { data: appRow, error: appErr } = await supa
    .from("store_apps")
    .select("enabled")
    .eq("store_id", store_id)
    .eq("app_id", app_id)
    .maybeSingle();
  if (appErr) return json({ error: "db_error" }, 500);
  if (!appRow || !appRow.enabled) return json({ error: "app_not_enabled" }, 403);

  if (cleanedPhone) {
    const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
    const { count } = await supa
      .from("store_app_leads")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store_id)
      .eq("phone", cleanedPhone)
      .gt("created_at", oneMinAgo);
    if ((count ?? 0) > 0) return json({ ok: true, deduped: true });
  }

  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null;
  const ua = req.headers.get("user-agent")?.slice(0, 500) ?? null;

  const { error: insErr } = await supa.from("store_app_leads").insert({
    store_id,
    app_id,
    phone: cleanedPhone || "",
    country_code,
    marketing_opt_in: !!marketing_opt_in,
    coupon_code,
    segment_label,
    metadata: metadata ?? {},
    ip,
    user_agent: ua,
  });
  if (insErr) return json({ error: "insert_failed", detail: insErr.message }, 500);

  return json({ ok: true, phone: `${country_code}${cleanedPhone}` });
});
