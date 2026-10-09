// Sends a 6-digit WhatsApp OTP for merchant signup verification / mobile login.
//
// Security:
//  - codes are hashed (SHA-256 + service-key pepper) before storage
//  - 5 min expiry, single use, max 5 wrong attempts (enforced in verify)
//  - 30s resend cooldown, 3 sends / 15 min per phone, 12 sends / hour per IP
//  - sends via wa-platform-send with message_type "auth_otp" (exempt from all
//    marketing gates, but still fully logged)

import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCors } from "../_shared/security.ts";
import { canonicalPhone, hashOtp } from "../_shared/otp.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30_000;
const MAX_PER_PHONE_15MIN = 3;
const MAX_PER_IP_HOUR = 12;
const TEMPLATE_NAME = "merchant_otp_v1";


function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

Deno.serve(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const body = await req.json().catch(() => ({}));
    const purpose: string = body.purpose === "login" ? "login" : "signup";
    const phone = canonicalPhone(body.phone || "");

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Duplicate pre-check for the signup form. The underlying RPCs are
    // service-role only, so the browser cannot run them directly.
    if (body.action === "check") {
      const email = String(body.email || "").trim().toLowerCase();
      const [phoneRes, emailRes] = await Promise.all([
        phone
          ? admin.rpc("get_user_id_by_phone", { _phone: phone })
          : Promise.resolve({ data: null } as any),
        email
          ? admin.rpc("get_auth_user_id_by_email", { _email: email })
          : Promise.resolve({ data: null } as any),
      ]);
      return json({
        phone_taken: !!(phoneRes as any)?.data,
        email_taken: !!(emailRes as any)?.data,
      });
    }

    if (!phone) return json({ error: "Enter a valid 10-digit Indian mobile number" }, 400);

    // Signup must not mint a code for a number that already has an account —
    // profiles.phone is unique, so the verify step could never store it.
    if (purpose === "signup") {
      const { data: existingUid } = await admin.rpc("get_user_id_by_phone", { _phone: phone });
      if (existingUid) {
        return json(
          { error: "phone_taken", message: "This mobile number already exists — please log in instead." },
          409,
        );
      }
    }

    // Login requires an existing verified merchant account on this number.
    if (purpose === "login") {
      const { data: uid } = await admin.rpc("get_user_id_by_phone", { _phone: phone });
      if (!uid) return json({ error: "no_account", message: "No account found for this mobile number." }, 404);
    }

    const ip = clientIp(req);
    const now = Date.now();

    // Rate limits
    const { data: recent } = await admin
      .from("auth_otp_codes")
      .select("created_at")
      .eq("phone", phone)
      .gte("created_at", new Date(now - 15 * 60_000).toISOString())
      .order("created_at", { ascending: false });

    const rows = (recent as Array<{ created_at: string }>) || [];
    if (rows.length && now - new Date(rows[0].created_at).getTime() < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - (now - new Date(rows[0].created_at).getTime())) / 1000);
      return json({ error: "cooldown", message: `Please wait ${wait}s before requesting a new code.`, retry_after: wait }, 429);
    }
    if (rows.length >= MAX_PER_PHONE_15MIN) {
      return json({ error: "rate_limited", message: "Too many codes requested. Try again in a few minutes." }, 429);
    }

    if (ip !== "unknown") {
      const { count: ipCount } = await admin
        .from("auth_otp_codes")
        .select("id", { count: "exact", head: true })
        .eq("ip", ip)
        .gte("created_at", new Date(now - 60 * 60_000).toISOString());
      if ((ipCount ?? 0) >= MAX_PER_IP_HOUR) {
        return json({ error: "rate_limited", message: "Too many verification attempts from this device." }, 429);
      }
    }

    // Generate + persist
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
    const codeHash = await hashOtp(code, phone);

    // Invalidate any live codes for this phone/purpose.
    await admin
      .from("auth_otp_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("phone", phone)
      .is("consumed_at", null);

    const { error: insErr } = await admin.from("auth_otp_codes").insert({
      phone,
      purpose,
      code_hash: codeHash,
      ip,
      expires_at: new Date(now + OTP_TTL_MS).toISOString(),
    });
    if (insErr) return json({ error: "otp_store_failed", message: insErr.message }, 500);

    // Send over WhatsApp (internal call — cron secret from DB)
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
      console.error("otp send failed", res.status, JSON.stringify(sendBody));
      return json({
        error: "whatsapp_unavailable",
        message: "Could not send the WhatsApp code right now.",
        details: sendBody?.error || sendBody?.reason || null,
        fallback: "email",
      }, 502);
    }

    return json({ ok: true, sent: true, expires_in: OTP_TTL_MS / 1000 });
  } catch (e) {
    return json({ error: "unexpected", message: (e as Error).message }, 500);
  }
});
