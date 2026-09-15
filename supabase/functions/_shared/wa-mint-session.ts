// Shared session-mint helper used by wa-r (pre-mint) and wa-autologin.
// Mints a storefront supabase session for a canonical 10-digit phone using
// the `<digits>@phone.guest` email convention (same as phone-login).
//
// Two admin API hops: generateLink (magiclink) → verifyOtp. Auto-creates the
// auth user when the phone has never touched the platform. Returns access +
// refresh tokens on success, `null` on any failure (caller must handle
// gracefully — this is a best-effort speed optimisation).

import { createClient } from "npm:@supabase/supabase-js@2";
import { canonicalPhone } from "./wa-autologin-token.ts";
import { mintUserSession } from "./auth-session-mint.ts";

export type MintedSession = {
  access_token: string;
  refresh_token: string;
  phone: string;
  user_id: string;
};

export async function mintSessionForPhone(
  rawPhone: string,
  supabaseUrl: string,
  serviceRoleKey: string,
  anonKey: string,
): Promise<MintedSession | null> {
  try {
    const phone = canonicalPhone(rawPhone);
    if (!phone) return null;
    const phoneEmail = `${phone}@phone.guest`;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const anon = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Look up existing auth user.
    let userId: string | null = null;
    try {
      const { data } = await admin.rpc("get_auth_user_id_by_email", { _email: phoneEmail });
      if (data && typeof data === "string") userId = data;
    } catch { /* ignore */ }

    if (!userId) {
      const oneTime = crypto.randomUUID().slice(0, 16) + "Aa1!";
      const { data: newUser } = await admin.auth.admin.createUser({
        email: phoneEmail,
        password: oneTime,
        email_confirm: true,
        user_metadata: { phone, user_type: "customer" },
      });
      userId = newUser?.user?.id ?? null;
      // Concurrent signup for the same phone → unique violation surfaced as a
      // generic DB error. Re-look-up instead of failing the login.
      for (let attempt = 0; attempt < 3 && !userId; attempt++) {
        await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
        try {
          const { data } = await admin.rpc("get_auth_user_id_by_email", { _email: phoneEmail });
          if (data && typeof data === "string") userId = data;
        } catch { /* ignore */ }
      }
    }

    if (!userId) return null;

    const session = await mintUserSession(admin, anon, userId, phoneEmail, "wa-mint-session");
    if (!session) return null;

    return {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      phone,
      user_id: userId,
    };
  } catch {
    return null;
  }
}
