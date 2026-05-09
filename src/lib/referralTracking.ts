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

    // Mark unused to silence lints
    void existing;
  } catch {
    // tracking is best-effort
  }
}

/** Called after a successful signup to attach the new user to the referring partner. */
export async function attachReferralAfterSignup(): Promise<void> {
  if (typeof window === "undefined") return;
  const code = getReferralCode();
  if (!code) return;
  try {
    await supabase.functions.invoke("attach-referral", {
      body: { ref: code },
    });
  } catch {
    // best-effort
  }
}

export function buildReferralLink(partnerCode: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://shopbanao.in";
  return `${origin}/signup?ref=${partnerCode}`;
}
