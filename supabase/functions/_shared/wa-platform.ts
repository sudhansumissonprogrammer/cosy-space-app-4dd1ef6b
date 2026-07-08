// Shared helpers for the platform WhatsApp pipeline.
// Imported by wa-platform-send, wa-cart-recovery-cron, wa-order-event, wa-campaign-runner.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Normalize to E.164 digits-only (no '+'). Bare 10-digit Indian numbers get '91' prefix.
// Reject anything that can't be coerced to a plausible international number.
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/[^\d]/g, "");
  // Strip Indian trunk prefix '0' if 11 digits like 0XXXXXXXXXX
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  // Default to India country code when caller passed a bare 10-digit mobile
  if (digits.length === 10 && /^[6-9]/.test(digits)) digits = "91" + digits;
  if (digits.length < 11 || digits.length > 15) return null;
  return digits;
}

export type PlatformWaConfig = {
  whatsapp_mode: string;
  wa_enabled: boolean;
  wa_waba_id: string | null;
  wa_phone_number_id: string | null;
  wa_access_token: string | null;
  wa_default_lang: string;
  wa_min_cart_age_minutes: number;
  wa_max_cart_age_hours: number;
  wa_daily_cap_per_phone: number;
};

export async function loadPlatformConfig(admin: any): Promise<PlatformWaConfig | null> {
  const { data, error } = await admin
    .from("platform_config")
    .select(
      "whatsapp_mode, wa_enabled, wa_waba_id, wa_phone_number_id, wa_access_token, wa_default_lang, wa_min_cart_age_minutes, wa_max_cart_age_hours, wa_daily_cap_per_phone"
    )
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const cfg = data as PlatformWaConfig;
  // Env fallback: use whichever secret name the project stores the Meta token under.
  if (!cfg.wa_access_token) {
    const envTok =
      Deno.env.get("WHATSAPP_ACCESS_TOKEN") ||
      Deno.env.get("WA_ACCESS_TOKEN") ||
      Deno.env.get("META_WHATSAPP_TOKEN") ||
      null;
    if (envTok) cfg.wa_access_token = envTok;
  }
  if (!cfg.wa_waba_id) {
    const envWaba =
      Deno.env.get("WHATSAPP_BUSINESS_ACCOUNT_ID") ||
      Deno.env.get("META_WABA_ID") ||
      null;
    if (envWaba) cfg.wa_waba_id = envWaba;
  }
  if (!cfg.wa_phone_number_id) {
    const envPn = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || null;
    if (envPn) cfg.wa_phone_number_id = envPn;
  }
  return cfg;
}

export function platformConfigUsable(cfg: PlatformWaConfig | null): boolean {
  return !!cfg && cfg.wa_enabled && !!cfg.wa_phone_number_id && !!cfg.wa_access_token;
}

let _cronSecretCache: { v: string | null; at: number } = { v: null, at: 0 };
export async function getCronSecret(admin: any): Promise<string | null> {
  // Cache 5 min to avoid extra DB lookups
  if (_cronSecretCache.v && Date.now() - _cronSecretCache.at < 5 * 60 * 1000) {
    return _cronSecretCache.v;
  }
  const fromEnv = Deno.env.get("CRON_SECRET") || null;
  const { data } = await admin.from("cron_auth").select("secret").eq("id", true).maybeSingle();
  const fromDb = (data as any)?.secret || null;
  // Prefer DB value (pg_cron uses it); env value is acceptable fallback for ops.
  _cronSecretCache = { v: fromDb || fromEnv, at: Date.now() };
  return _cronSecretCache.v;
}

export async function isValidCronHeader(admin: any, headerValue: string): Promise<boolean> {
  if (!headerValue) return false;
  const fromEnv = Deno.env.get("CRON_SECRET") || "";
  if (fromEnv && headerValue === fromEnv) return true;
  const dbSecret = await getCronSecret(admin);
  return !!dbSecret && headerValue === dbSecret;
}

// ─────────────────────────────────────────────────────────────────────────────
// Meta API circuit breaker
//
// Why: All our Meta calls (send, template-sync, health-check) share ONE System
// User token. If Meta returns errors and we keep hammering, they flag the token
// as bot/stolen activity and lock the developer account (already happened once).
//
// Rules:
//   • After 3 consecutive Meta 4xx/5xx (excluding rate-limit 4/17/32 which we
//     back off separately), open the breaker for 30 min.
//   • While open, every Meta caller short-circuits without touching the API.
//   • On the FIRST success after open, we close and reset failures to 0.
//   • We also log Meta's X-App-Usage / X-Business-Use-Case-Usage headers so we
//     can spot when we approach quota BEFORE Meta throttles us.
// ─────────────────────────────────────────────────────────────────────────────

const BREAKER_THRESHOLD = 3;
const BREAKER_OPEN_MS = 30 * 60 * 1000; // 30 min
const ACCESS_BLOCKED_OPEN_MS = 2 * 60 * 60 * 1000; // 2h security-cooldown for Meta checkpoint locks

export type MetaBreakerState = {
  failures: number;
  open_until: string | null;
  last_error: string | null;
  last_usage: any;
};

export async function getMetaBreaker(admin: any): Promise<MetaBreakerState> {
  const { data } = await admin
    .from("platform_config")
    .select("wa_meta_breaker")
    .limit(1)
    .maybeSingle();
  return (data?.wa_meta_breaker as MetaBreakerState) ?? {
    failures: 0, open_until: null, last_error: null, last_usage: null,
  };
}

export function isMetaBreakerOpen(state: MetaBreakerState): boolean {
  if (!state.open_until) return false;
  return new Date(state.open_until).getTime() > Date.now();
}

async function saveMetaBreaker(admin: any, state: MetaBreakerState) {
  await admin.from("platform_config").update({ wa_meta_breaker: state as any }).neq("id", "00000000-0000-0000-0000-000000000000");
}

async function logHealth(admin: any, payload: Record<string, unknown>) {
  try {
    await admin.from("wa_health_log").insert({
      checked_at: new Date().toISOString(),
      raw: payload as any,
    });
  } catch { /* logging best-effort */ }
}

/**
 * Wrapper around `fetch(https://graph.facebook.com/...)` that honors the
 * circuit breaker and records X-App-Usage. Use this INSTEAD of raw fetch()
 * for every Meta Graph call.
 *
 * Returns `{ ok, status, body, breakerOpen }`. When `breakerOpen` is true,
 * no HTTP request was made — callers should skip gracefully.
 */
export async function metaFetch(
  admin: any,
  url: string,
  init: RequestInit,
  opts: { source: string } = { source: "unknown" },
): Promise<{ ok: boolean; status: number; body: any; breakerOpen: boolean }> {
  const state = await getMetaBreaker(admin);
  if (isMetaBreakerOpen(state)) {
    return { ok: false, status: 0, body: { error: "breaker_open", open_until: state.open_until, last_error: state.last_error }, breakerOpen: true };
  }

  let r: Response;
  try {
    r = await fetch(url, init);
  } catch (e) {
    const next = { ...state, failures: state.failures + 1, last_error: `network:${(e as Error).message}` };
    if (next.failures >= BREAKER_THRESHOLD) next.open_until = new Date(Date.now() + BREAKER_OPEN_MS).toISOString();
    await saveMetaBreaker(admin, next);
    await logHealth(admin, { event: "meta_network_error", source: opts.source, error: (e as Error).message });
    return { ok: false, status: 0, body: { error: "network_error" }, breakerOpen: false };
  }

  const appUsage = r.headers.get("x-app-usage");
  const bizUsage = r.headers.get("x-business-use-case-usage");
  const body: any = await r.json().catch(() => ({}));

  if (r.ok) {
    // Reset breaker on any successful call. Only log usage when we're
    // approaching quota (>=80% on any dimension) to keep the log lean.
    if (state.failures > 0 || state.open_until) {
      await saveMetaBreaker(admin, { failures: 0, open_until: null, last_error: null, last_usage: appUsage });
    }
    if (appUsage) {
      try {
        const u = JSON.parse(appUsage);
        const high = Math.max(u.call_count ?? 0, u.total_cputime ?? 0, u.total_time ?? 0);
        if (high >= 80) await logHealth(admin, { event: "meta_usage_high", source: opts.source, app_usage: u, biz_usage: bizUsage });
      } catch { /* ignore */ }
    }
    return { ok: true, status: r.status, body, breakerOpen: false };
  }

  // Failure path — count non-rate-limit errors toward breaker
  const metaCode = body?.error?.code;
  const metaMessage = String(body?.error?.message ?? "");
  const isRateLimit = metaCode === 4 || metaCode === 17 || metaCode === 32 || metaCode === 613 || r.status === 429;
  const isAccessBlocked = metaCode === 200 && /access blocked/i.test(metaMessage);
  const next = {
    ...state,
    failures: isAccessBlocked ? BREAKER_THRESHOLD : state.failures + 1,
    last_error: `${r.status}:${metaCode ?? "-"}:${metaMessage}`.slice(0, 500),
    last_usage: appUsage,
  };
  if (!isRateLimit && (isAccessBlocked || next.failures >= BREAKER_THRESHOLD)) {
    next.open_until = new Date(Date.now() + (isAccessBlocked ? ACCESS_BLOCKED_OPEN_MS : BREAKER_OPEN_MS)).toISOString();
    await logHealth(admin, { event: "meta_breaker_opened", source: opts.source, code: metaCode, message: body?.error?.message, until: next.open_until });
  }
  await saveMetaBreaker(admin, next);
  return { ok: false, status: r.status, body, breakerOpen: false };
}

/**
 * Returns true when at least one platform_wa_templates row is APPROVED.
 * Crons use this to bail before doing any Meta work — no approved template
 * means we can't send anyway, so hammering the API would look suspicious.
 */
export async function hasApprovedTemplates(admin: any): Promise<boolean> {
  // NOTE: `head:true` returns null count under service role in some setups —
  // use a plain select+limit(1) instead so we get a reliable existence check.
  const { data } = await admin
    .from("platform_wa_templates")
    .select("name")
    .eq("meta_status", "APPROVED")
    .limit(1);
  return Array.isArray(data) && data.length > 0;
}

