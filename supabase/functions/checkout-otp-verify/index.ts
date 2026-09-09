// Verifies the checkout mobile-number OTP. No session is minted here — the
// existing create-guest-account flow still owns login; this only proves the
// shopper owns the number they typed.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { canonicalPhone, hashOtp, safeEqual } from "../_shared/otp.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PURPOSE = "checkout_verify";
const MAX_ATTEMPTS = 5;

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
    const phone = canonicalPhone(body.phone || "");
    const code = String(body.code || "").replace(/\D/g, "");

    if (!/^[0-9a-f-]{36}$/i.test(storeId)) return json({ error: "store_id required" }, 400);
    if (!phone) return json({ error: "invalid_phone", message: "Enter a valid 10-digit mobile number" }, 400);
    if (code.length !== 4) return json({ error: "invalid_code", message: "Enter the 4-digit code" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: store } = await admin
      .from("stores")
      .select("checkout_otp_enabled")
      .eq("id", storeId)
      .maybeSingle();
    if (!store) return json({ error: "store_unavailable" }, 403);
    if (!(store as any).checkout_otp_enabled) return json({ ok: true, verified: true, disabled: true });

    const { data: row } = await admin
      .from("auth_otp_codes")
      .select("id, code_hash, attempts, expires_at")
      .eq("purpose", PURPOSE)
      .eq("store_id", storeId)
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
      return json(
        {
          error: "invalid_code",
          message: `Incorrect code. ${Math.max(MAX_ATTEMPTS - attempts, 0)} attempts left.`,
        },
        400,
      );
    }

    await admin
      .from("auth_otp_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", (row as any).id);

    return json({ ok: true, verified: true, phone });
  } catch (e) {
    return json({ error: "unexpected", message: (e as Error).message }, 500);
  }
});
