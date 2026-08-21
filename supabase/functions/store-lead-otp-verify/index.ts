// Verifies a storefront lead OTP and writes the verified lead in one step.
// No Supabase session is minted here — this only proves phone ownership for
// App Store lead capture (Spin the Wheel), so the coupon cannot be farmed
// with throwaway numbers.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { canonicalPhone, hashOtp, safeEqual } from "../_shared/otp.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PURPOSE = "store_lead";
const MAX_ATTEMPTS = 5;
const ALLOWED_APPS = new Set(["spin-wheel"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const storeId = String(body.store_id || "");
    const appId = String(body.app_id || "");
    const phone = canonicalPhone(body.phone || "");
    const code = String(body.code || "").replace(/\D/g, "");

    if (!storeId) return json({ error: "store_id required" }, 400);
    if (!ALLOWED_APPS.has(appId)) return json({ error: "app_not_supported" }, 400);
    if (!phone) return json({ error: "invalid_phone", message: "Enter a valid 10-digit Indian mobile number" }, 400);
    if (code.length !== 6) return json({ error: "invalid_code", message: "Enter the 6-digit code" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: appRow, error: appErr } = await admin
      .from("store_apps")
      .select("enabled")
      .eq("store_id", storeId)
      .eq("app_id", appId)
      .maybeSingle();
    if (appErr) return json({ error: "db_error" }, 500);
    if (!appRow || !appRow.enabled) return json({ error: "app_not_enabled" }, 403);

    const { data: row } = await admin
      .from("auth_otp_codes")
      .select("id, code_hash, attempts, expires_at")
      .eq("purpose", PURPOSE)
      .eq("phone", phone)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) return json({ error: "no_code", message: "No active code. Please request a new one." }, 400);
    if (new Date((row as any).expires_at).getTime() < Date.now()) {
      return json({ error: "expired", message: "Code expired. Please request a new one." }, 400);
    }
    if (((row as any).attempts ?? 0) >= MAX_ATTEMPTS) {
      return json({ error: "too_many_attempts", message: "Too many wrong attempts. Request a new code." }, 429);
    }

    const candidate = await hashOtp(code, phone);
    if (!safeEqual(candidate, String((row as any).code_hash))) {
      const attempts = ((row as any).attempts ?? 0) + 1;
      await admin.from("auth_otp_codes").update({ attempts }).eq("id", (row as any).id);
      return json({
        error: "invalid_code",
        message: `Incorrect code. ${Math.max(MAX_ATTEMPTS - attempts, 0)} attempts left.`,
      }, 400);
    }

    // Burn the code (single use) before writing anything.
    await admin
      .from("auth_otp_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", (row as any).id);

    // Dedupe: same phone within a minute is a double submit, not a new lead.
    const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
    const { count } = await admin
      .from("store_app_leads")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("phone", phone)
      .gt("created_at", oneMinAgo);

    if ((count ?? 0) === 0) {
      const ip =
        req.headers.get("cf-connecting-ip") ||
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        null;
      const { error: insErr } = await admin.from("store_app_leads").insert({
        store_id: storeId,
        app_id: appId,
        phone,
        country_code: "+91",
        marketing_opt_in: !!body.marketing_opt_in,
        coupon_code: body.coupon_code ?? null,
        segment_label: body.segment_label ?? null,
        phone_verified: true,
        metadata: { ...(body.metadata ?? {}), otp_verified: true },
        ip,
        user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
      });
      if (insErr) return json({ error: "insert_failed", detail: insErr.message }, 500);
    }

    return json({ ok: true, verified: true, phone });
  } catch (e) {
    return json({ error: "unexpected", message: (e as Error).message }, 500);
  }
});
