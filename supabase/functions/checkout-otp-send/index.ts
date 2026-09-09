// Storefront checkout mobile-number verification — sends a 4-digit WhatsApp OTP.
//
// STRICTLY opt-in: only runs when the store has `checkout_otp_enabled = true`.
// Every other store (Serdiya included) gets `disabled: true` and the checkout
// continues exactly as before — no OTP, no behaviour change.
//
// Codes are hashed (SHA-256 + service-key pepper), 5 min TTL, single use,
// 30s resend cooldown, 3 sends / 15 min per phone, 12 sends / hour per IP.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { canonicalPhone, hashOtp } from "../_shared/otp.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PURPOSE = "checkout_verify";
const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30_000;
const MAX_PER_PHONE_15MIN = 3;
const MAX_PER_IP_HOUR = 12;
const TEMPLATE_NAME = "merchant_otp_v1";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const storeId = String(body.store_id || "");
    const phone = canonicalPhone(body.phone || "");

    if (!/^[0-9a-f-]{36}$/i.test(storeId)) return json({ error: "store_id required" }, 400);
    if (!phone) {
      return json({ error: "invalid_phone", message: "Enter a valid 10-digit Indian mobile number" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Hard gate — the store toggle is the only way OTP ever happens.
    const { data: store, error: storeErr } = await admin
      .from("stores")
      .select("checkout_otp_enabled, is_suspended")
      .eq("id", storeId)
      .maybeSingle();
    if (storeErr) return json({ error: "db_error" }, 500);
    if (!store || (store as any).is_suspended) return json({ error: "store_unavailable" }, 403);
    if (!(store as any).checkout_otp_enabled) return json({ ok: true, disabled: true });

    const ip = clientIp(req);
    const now = Date.now();

    const { data: recent } = await admin
      .from("auth_otp_codes")
      .select("created_at")
      .eq("purpose", PURPOSE)
      .eq("phone", phone)
      .gte("created_at", new Date(now - 15 * 60_000).toISOString())
      .order("created_at", { ascending: false });

    const rows = (recent as Array<{ created_at: string }>) || [];
    if (rows.length && now - new Date(rows[0].created_at).getTime() < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - (now - new Date(rows[0].created_at).getTime())) / 1000);
      return json(
        { error: "cooldown", message: `Please wait ${wait}s before requesting a new code.`, retry_after: wait },
        429,
      );
    }
    if (rows.length >= MAX_PER_PHONE_15MIN) {
      return json({ error: "rate_limited", message: "Too many codes requested. Try again in a few minutes." }, 429);
    }

    if (ip !== "unknown") {
      const { count: ipCount } = await admin
        .from("auth_otp_codes")
        .select("id", { count: "exact", head: true })
        .eq("purpose", PURPOSE)
        .eq("ip", ip)
        .gte("created_at", new Date(now - 60 * 60_000).toISOString());
      if ((ipCount ?? 0) >= MAX_PER_IP_HOUR) {
        return json({ error: "rate_limited", message: "Too many verification attempts from this device." }, 429);
      }
    }

    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 10_000).padStart(4, "0");
    const codeHash = await hashOtp(code, phone);

    await admin
      .from("auth_otp_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("purpose", PURPOSE)
      .eq("phone", phone)
      .is("consumed_at", null);

    const { error: insErr } = await admin.from("auth_otp_codes").insert({
      phone,
      purpose: PURPOSE,
      store_id: storeId,
      code_hash: codeHash,
      ip,
      expires_at: new Date(now + OTP_TTL_MS).toISOString(),
    });
    if (insErr) return json({ error: "otp_store_failed", message: insErr.message }, 500);

    const { data: cronRow } = await admin.from("cron_auth").select("secret").eq("id", true).maybeSingle();
    const cronSecret = (cronRow as any)?.secret || Deno.env.get("CRON_SECRET") || "";

    const res = await fetch(`${SUPABASE_URL}/functions/v1/wa-platform-send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": cronSecret,
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify({
        recipient_phone: phone,
        template_name: TEMPLATE_NAME,
        template_params: [code],
        message_type: "auth_otp",
      }),
    });
    const sendBody = await res.json().catch(() => ({}));

    if (!res.ok || sendBody?.error || sendBody?.skipped) {
      console.error("checkout otp send failed", res.status, JSON.stringify(sendBody));
      // Free the slot so the shopper can retry immediately.
      await admin
        .from("auth_otp_codes")
        .update({ consumed_at: new Date().toISOString() })
        .eq("purpose", PURPOSE)
        .eq("phone", phone)
        .is("consumed_at", null);
      return json(
        { error: "whatsapp_unavailable", message: "Could not send the WhatsApp code right now. Please try again." },
        502,
      );
    }

    return json({
      ok: true,
      sent: true,
      expires_in: OTP_TTL_MS / 1000,
      resend_after: RESEND_COOLDOWN_MS / 1000,
    });
  } catch (e) {
    return json({ error: "unexpected", message: (e as Error).message }, 500);
  }
});
