/**
 * Referral cookie + tracking utility.
 *
 * Captures `?ref=SBP1023` query params anywhere on the site, stores the partner
 * code in a cookie for 90 days, and posts a click event to the
 * `track-referral-click` edge function.
 */
import { supabase } from "@/integrations/supabase/client";

const COOKIE_NAME = "sb_ref";
const COOKIE_DAYS = 90;
const COOKIE_AT_KEY = "sb_ref_at"; // localStorage timestamp (ms)
const STALE_HOURS = 24; // drop cookie if older than this on auth events

export function getReferralCode(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setReferralCookie(code: string) {
  const days = COOKIE_DAYS;
  const expires = new Date(Date.now() + days * 86400 * 1000).toUTCString();
  // Cookie scoped to root domain so it survives subdomain navigation
  let domainPart = "";
  try {
    const host = window.location.hostname;
    if (host.endsWith("shopbanao.in")) domainPart = "; Domain=.shopbanao.in";
  } catch {}
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(code)}; Path=/; Expires=${expires}; SameSite=Lax${domainPart}`;
  try {
    localStorage.setItem(COOKIE_AT_KEY, String(Date.now()));
  } catch {}
}

/** Call from any landing route — reads ?ref=, persists, fires click. Idempotent. */
export async function captureReferralFromURL(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (!ref) return;
    const cleaned = ref.trim().toUpperCase();
    if (!/^SBP\d{2,}$/.test(cleaned)) return;

    setReferralCookie(cleaned);

    // Don't double-track on every navigation — only fire once per code per session
    const sessionKey = `sb_ref_clicked_${cleaned}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, "1");

    await supabase.functions.invoke("track-referral-click", {
      body: {
        ref: cleaned,
        landing_path: window.location.pathname + window.location.search,
        referrer: document.referrer || null,
      },
    }).catch(() => {});
  } catch {
    // tracking is best-effort
  }
}

export function clearReferralCookie() {
  if (typeof document === "undefined") return;
  let domainPart = "";
  try {
    const host = window.location.hostname;
    if (host.endsWith("shopbanao.in")) domainPart = "; Domain=.shopbanao.in";
  } catch {}
  document.cookie = `${COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${domainPart}`;
  try {
    localStorage.removeItem(COOKIE_AT_KEY);
  } catch {}
}

/**
 * Drop the referral cookie if it's stale (>24h) or if the currently signed-in
 * user is themselves a partner. Call on every auth state change so a stale
 * cookie can't credit a brand-new signup on a shared/public browser.
 */
export async function maybeClearStaleReferralCookie(userId: string | null): Promise<void> {
  if (typeof window === "undefined") return;
  const code = getReferralCode();
  if (!code) return;

  // Stale cookie → drop
  try {
    const at = Number(localStorage.getItem(COOKIE_AT_KEY) || 0);
    if (at && Date.now() - at > STALE_HOURS * 60 * 60 * 1000) {
      clearReferralCookie();
      return;
    }
  } catch {}

  // Logged-in user is a partner → never let them earn from their own browser
  if (userId) {
    try {
      const { data } = await supabase
        .from("partners")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) clearReferralCookie();
    } catch {}
  }
}

/** Called after a successful signup to attach the new user to the referring partner. */
export async function attachReferralAfterSignup(): Promise<void> {
  if (typeof window === "undefined") return;
  const code = getReferralCode();
  if (!code) return;
  // Only run if we actually have a session — otherwise the edge function
  // returns 401 and we waste calls (and pollute logs) on every sign-in form
  // submit / Google redirect.
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  try {
    const { data: res, error } = await supabase.functions.invoke("attach-referral", {
      body: { ref: code },
    });
    const payload = res as { ok?: boolean; reason?: string } | null;
    // Clear cookie on a definitive outcome so a second user on the same
    // browser doesn't inherit the previous user's referral.
    if (!error && payload && (payload.ok === true || payload.reason === "already_attached" || payload.reason === "self_referral")) {
      clearReferralCookie();
    }
  } catch {
    // best-effort
  }
}

export function buildReferralLink(partnerCode: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://shopbanao.in";
  return `${origin}/signup?ref=${partnerCode}`;
}
