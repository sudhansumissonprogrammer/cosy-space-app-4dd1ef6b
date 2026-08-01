// Shared helpers for the platform WhatsApp pipeline.
// Imported by wa-platform-send, wa-cart-recovery-cron, wa-order-event, wa-campaign-runner.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Normalize to E.164 digits-only (no '+'). Bare 10-digit Indian numbers get '91' prefix.
// Reject anything that can't be coerced to a plausible international number, and
// STRICTLY reject spam/fake patterns (all-same digits, sequential runs, invalid
// Indian mobile prefixes) so we never spend Meta credits on obvious junk.
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/[^\d]/g, "");
  // Strip Indian trunk prefix '0' if 11 digits like 0XXXXXXXXXX
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  // Default to India country code when caller passed a bare 10-digit mobile
  if (digits.length === 10 && /^[6-9]/.test(digits)) digits = "91" + digits;
  if (digits.length < 11 || digits.length > 15) return null;

  // ---- Spam / fake number guards ----
  // Extract the subscriber portion (last 10 digits) for pattern checks.
  const sub = digits.slice(-10);
  if (sub.length !== 10) return null;

  // All identical digits: 9999999999, 0000000000, 1111111111 ...
  if (/^(\d)\1{9}$/.test(sub)) return null;

  // Only 2 unique digits across the whole subscriber number (e.g. 9898989898,
  // 1212121212, 9090909090) — real numbers virtually never look like this.
  const uniq = new Set(sub.split("")).size;
  if (uniq <= 2) return null;

  // Strictly ascending / descending runs of length >= 7 anywhere in the number
  // (1234567890, 9876543210, 12345678, etc.)
  let asc = 1, desc = 1;
  for (let i = 1; i < sub.length; i++) {
    const d = sub.charCodeAt(i) - sub.charCodeAt(i - 1);
    asc = d === 1 ? asc + 1 : 1;
    desc = d === -1 ? desc + 1 : 1;
    if (asc >= 7 || desc >= 7) return null;
  }

  // Same digit repeated 6+ times in a row (e.g. 9111111234)
  if (/(\d)\1{5,}/.test(sub)) return null;

  // Indian numbers (country code 91): mobile must start with 6-9.
  if (digits.startsWith("91") && digits.length === 12) {
    if (!/^[6-9]/.test(sub)) return null;
  }

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


// ══════════════════════════════════════════════════════════════════════
// 🔁 RECOVERY DRIP SEQUENCE (abandoned cart / pending / cancelled orders)
// A lead that hasn't purchased gets EXACTLY 3 recovery messages:
//   step 1 → 30 min after the drop-off   (handled by cron min-age)
//   step 2 → 5 hours after step 1
//   step 3 → 24 hours after step 2
// After step 3 the lead is done — no more marketing until the window
// resets (72h). This intentionally overrides the flat 1-msg-per-24h
// marketing cap, which only applies to non-recovery marketing.
// ══════════════════════════════════════════════════════════════════════
export const RECOVERY_MESSAGE_TYPES = ["abandoned_cart"];
// +5min buffer on step 3 so it lands just outside the rolling 24h window.
export const DRIP_GAPS_MS = [0, 5 * 60 * 60 * 1000, 24 * 60 * 60 * 1000 + 5 * 60 * 1000];
export const DRIP_MAX_STEPS = 3;
// Absolute ceiling: max 2 messages to one number in any rolling 24h window.
export const DRIP_MAX_PER_24H = 2;
export const DRIP_WINDOW_MS = 72 * 60 * 60 * 1000;

export type DripDecision = {
  allow: boolean;
  step: number;           // 1-based step we're about to send
  reason?: string;
  lastSentAt?: string | null;
};

/**
 * Decides whether the given phone may receive the next recovery message now.
 * Counts BOTH delivered messages and in-flight queue rows so a cron re-run
 * can never double-send. Only `abandoned_cart` recovery sends count here.
 */
export async function recoveryDripDecision(admin: any, phone: string, opts: { ignoreInFlight?: boolean } = {}): Promise<DripDecision> {
  const sinceIso = new Date(Date.now() - DRIP_WINDOW_MS).toISOString();

  const [{ data: sentRows }, { data: failedRows }, { data: queueRows }] = await Promise.all([
    admin.from("whatsapp_messages")
      .select("created_at")
      .eq("recipient_phone", phone).eq("sent_via", "platform").eq("direction", "outgoing")
      .in("status", ["sent", "delivered", "read"])
      .in("message_type", RECOVERY_MESSAGE_TYPES)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(10),
    // ❌ Messages Meta accepted but never delivered (billing block 131042,
    // undeliverable 131026, ecosystem throttle 131049…). These must NOT burn a
    // drip step — the shopper never saw anything.
    admin.from("whatsapp_messages")
      .select("created_at")
      .eq("recipient_phone", phone).eq("sent_via", "platform").eq("direction", "outgoing")
      .eq("status", "failed")
      .in("message_type", RECOVERY_MESSAGE_TYPES)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(20),
    admin.from("wa_send_queue")
      .select("created_at, status")
      .eq("recipient_phone", phone)
      .in("message_type", RECOVERY_MESSAGE_TYPES)
      .in("status", ["pending", "sending", "sent"])
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  // Anything still waiting to go out means the previous step hasn't landed.
  // The sender itself runs while its own row is `sending`, so it opts out of
  // the in-flight guard — otherwise it would block its own message.
  if (!opts.ignoreInFlight) {
    const inFlight = ((queueRows as any[]) ?? []).some((r) => r.status === "pending" || r.status === "sending");
    if (inFlight) return { allow: false, step: 0, reason: "drip_in_flight" };
  }

  // A queue row marked `sent` may not yet have its whatsapp_messages twin —
  // union both sources by timestamp bucket (1 min) so we never double count.
  const stamps = new Set<number>();
  for (const r of ([...(sentRows as any[] ?? []), ...((queueRows as any[]) ?? []).filter((q) => q.status === "sent")])) {
    const t = new Date(r.created_at).getTime();
    if (Number.isFinite(t)) stamps.add(Math.round(t / 60000));
  }
  // Drop buckets whose delivery ultimately failed (queue said "sent", Meta
  // rejected it). Match within ±2 minutes of the failed webhook timestamp.
  for (const r of ((failedRows as any[]) ?? [])) {
    const t = new Date(r.created_at).getTime();
    if (!Number.isFinite(t)) continue;
    const b = Math.round(t / 60000);
    for (const d of [-2, -1, 0, 1, 2]) stamps.delete(b + d);
  }

  const times = Array.from(stamps).map((m) => m * 60000).sort((a, b) => b - a);
  const done = times.length;
  if (done >= DRIP_MAX_STEPS) return { allow: false, step: done, reason: "drip_complete" };

  // 🚫 HARD RULE: never more than 2 messages to the same number in any rolling
  // 24h window. The drip schedule (0h → +5h → +29h) already respects this, but
  // this guard is absolute — retries, re-runs or schedule edits can't break it.
  const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
  let last24h = times.filter((t) => t >= cutoff24h).length;
  if (!opts.ignoreInFlight) {
    last24h += ((queueRows as any[]) ?? []).filter(
      (q) => (q.status === "pending" || q.status === "sending") &&
        new Date(q.created_at).getTime() >= cutoff24h,
    ).length;
  }
  if (last24h >= DRIP_MAX_PER_24H) {
    return { allow: false, step: done + 1, reason: "drip_24h_cap", lastSentAt: times[0] ? new Date(times[0]).toISOString() : null };
  }


  const step = done + 1;
  if (done === 0) return { allow: true, step, lastSentAt: null };

  const gap = DRIP_GAPS_MS[done] ?? DRIP_GAPS_MS[DRIP_GAPS_MS.length - 1];
  const elapsed = Date.now() - times[0];
  if (elapsed < gap) {
    return { allow: false, step, reason: "drip_too_soon", lastSentAt: new Date(times[0]).toISOString() };
  }
  return { allow: true, step, lastSentAt: new Date(times[0]).toISOString() };
}
