// Verifies a WhatsApp OTP and returns a real Supabase session.
//
// purpose "signup": confirms the freshly-created merchant account (marks the
//   email confirmed server-side, stores the verified mobile on the profile).
// purpose "login": signs an existing merchant in by mobile number.
//
// Sessions are minted with the admin generateLink → anon verifyOtp technique
// (same as phone-login) so other devices keep their refresh tokens.

import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCors } from "../_shared/security.ts";
import { canonicalPhone, hashOtp, safeEqual } from "../_shared/otp.ts";
import { mintUserSession } from "../_shared/auth-session-mint.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const MAX_ATTEMPTS = 5;

Deno.serve(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const body = await req.json().catch(() => ({}));
    const purpose: string = body.purpose === "login" ? "login" : "signup";
    const phone = canonicalPhone(body.phone || "");
    const code = String(body.code || "").replace(/\D/g, "");
    const email = String(body.email || "").trim().toLowerCase();

    if (!phone) return json({ error: "Enter a valid 10-digit Indian mobile number" }, 400);
    if (code.length !== 6) return json({ error: "Enter the 6-digit code" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Latest live code for this phone
    const { data: row } = await admin
      .from("auth_otp_codes")
      .select("id, code_hash, attempts, expires_at, consumed_at")
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
      await admin
        .from("auth_otp_codes")
        .update({ attempts: ((row as any).attempts ?? 0) + 1 })
        .eq("id", (row as any).id);
      const left = MAX_ATTEMPTS - (((row as any).attempts ?? 0) + 1);
      return json({ error: "invalid_code", message: `Incorrect code. ${Math.max(left, 0)} attempts left.` }, 400);
    }

    // Resolve the account
    let userId: string | null = null;
    let userEmail: string | null = null;

    if (purpose === "login") {
      const { data: uid } = await admin.rpc("get_user_id_by_phone", { _phone: phone });
      if (uid && typeof uid === "string") userId = uid;
      if (!userId) return json({ error: "no_account", message: "No account found for this mobile number." }, 404);
      const { data: u } = await admin.auth.admin.getUserById(userId);
      userEmail = u?.user?.email ?? null;
    } else {
      if (!email) return json({ error: "email_required" }, 400);
      const { data: uid } = await admin.rpc("get_auth_user_id_by_email", { _email: email });
      if (uid && typeof uid === "string") userId = uid;
      if (!userId) return json({ error: "no_account", message: "Account not found. Please sign up again." }, 404);
      userEmail = email;
    }
    if (!userEmail) return json({ error: "account_incomplete" }, 500);

    // Burn the code (single use) before minting anything.
    await admin
      .from("auth_otp_codes")
      .update({ consumed_at: new Date().toISOString(), user_id: userId })
      .eq("id", (row as any).id);

    // Confirm the account + persist the verified mobile.
    if (purpose === "signup") {
      await admin.auth.admin.updateUserById(userId, { email_confirm: true });
    }

    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    // profiles.phone is unique — surface a clash instead of silently ending up
    // with an account that has no stored/verified mobile.
    const profileWrite = existingProfile
      ? await admin.from("profiles").update({ phone, phone_verified: true }).eq("user_id", userId)
      : await admin.from("profiles").insert({ user_id: userId, phone, phone_verified: true });

    if (profileWrite.error) {
      const dup = /duplicate key|unique/i.test(profileWrite.error.message);
      return json(
        {
          error: dup ? "phone_taken" : "profile_write_failed",
          message: dup
            ? "This mobile number is already linked to another account. Please use a different number or log in."
            : "Could not save your mobile number. Please try again.",
        },
        dup ? 409 : 500,
      );
    }

    const session = await mintUserSession(admin, anon, userId, userEmail, "merchant-otp-verify");
    if (!session) {
      return json(
        { verified: true, session: null, error: "session_unavailable", message: "Verified, but sign-in could not finish. Please try again." },
        503,
      );
    }

    return json({
      verified: true,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      },
    });
  } catch (e) {
    return json({ error: "unexpected", message: (e as Error).message }, 500);
  }
});
