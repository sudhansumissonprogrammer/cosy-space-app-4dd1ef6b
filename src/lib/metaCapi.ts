import { supabase } from "@/integrations/supabase/client";
import { getCapiUser, getOrCreateSfVid, isRealEmail, readFbcWithFallback, seedCapiUserFromStorage } from "@/lib/metaEnrichment";

/**
 * Returns true on Lovable preview/editor/dev hosts.
 * Must mirror the guard in useFacebookPixel.ts so that browser Pixel and
 * server-side CAPI are silenced together — never one without the other,
 * which would produce un-deduplicated events Meta flags as suspicious.
 */
function isNonProductionHost(): boolean {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".lovableproject.com") ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovable.dev") ||
    host.endsWith(".sandbox.lovable.dev")
  );
}

/**
 * Get Meta cookie values (fbc, fbp) for deduplication.
 * Exported so the checkout flow can forward them to the place-order edge function,
 * which stores them on the order row and uses them for server-side CAPI Purchase.
 */
export function getMetaCookies() {
  const cookies = document.cookie.split("; ");
  let fbc = "";
  let fbp = "";
  for (const cookie of cookies) {
    if (cookie.startsWith("_fbc=")) fbc = cookie.split("=")[1];
    if (cookie.startsWith("_fbp=")) fbp = cookie.split("=")[1];
  }
  // Also check URL for fbclid
  if (!fbc) {
    const params = new URLSearchParams(window.location.search);
    const fbclid = params.get("fbclid");
    if (fbclid) {
      fbc = `fb.1.${Date.now()}.${fbclid}`;
    }
  }
  // Final fallback: sessionStorage backup (ITP / in-app WebView eviction).
  if (!fbc) fbc = readFbcWithFallback();
  return { fbc, fbp };
}

/**
 * Client IP is NO LONGER fetched in the browser.
 *
 * The old scheme called api.ipify.org and posted the result as
 * `declared_client_ip`. Every storefront ships a strict CSP whose
 * `connect-src` does not (and should not) include ipify, so in production
 * that fetch was blocked 100% of the time — the console filled with CSP
 * violations and Meta never received an IP at all.
 *
 * Browser → CAPI calls hit the edge function directly, so the function's own
 * `cf-connecting-ip` header IS the shopper's real IP. The server now derives
 * it there (browser-originated requests only). Nothing to do client-side.
 */
export function getDeclaredClientIp(): string {
  return "";
}


interface CAPIEventParams {
  storeId: string;
  eventName: string;
  eventId?: string; // For pixel↔CAPI deduplication
  userEmail?: string;
  userPhone?: string;
  externalId?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  customData?: {
    content_ids?: string[];
    content_name?: string;
    content_type?: string;
    contents?: { id: string; quantity: number; item_price?: number }[];
    currency?: string;
    value?: number;
    num_items?: number;
    order_id?: string;
  };
}

/**
 * Fire a server-side Meta Conversions API event.
 * This runs alongside the client-side pixel for deduplication.
 * Non-blocking — errors are silently logged.
 */
// v8.72.0 BATCHING: Meta recommends batching events into a single request
// rather than one POST per event. Events fired within BATCH_WINDOW_MS for the
// same store are grouped into one call to the edge function, which forwards
// them as one Graph API request. Fewer requests = less throttling, fewer 4xx
// against the token, and a much smaller "noisy sender" footprint.
const BATCH_WINDOW_MS = 400;
const MAX_BATCH = 20;
type PendingBatch = { events: any[]; timer: ReturnType<typeof setTimeout> | null; cacheKey: string };
const batches = new Map<string, PendingBatch>();

function flushBatch(storeId: string) {
  const batch = batches.get(storeId);
  if (!batch) return;
  batches.delete(storeId);
  if (batch.timer) clearTimeout(batch.timer);
  if (!batch.events.length) return;

  supabase.functions
    .invoke("meta-capi", {
      body: {
        store_id: storeId,
        user_agent: navigator.userAgent,
        declared_client_ip: getDeclaredClientIp() || undefined,
        events: batch.events,
      },
    })
    .then(({ data, error }) => {
      if (error) {
        console.warn("Meta CAPI warning:", error.message);
        return;
      }
      // Cache "no CAPI configured" for 6 hours so we don't re-call the edge
      // function on every visit. Deliberately SHORT: a long cache meant that
      // the moment a merchant finally pasted a Meta access token, returning
      // visitors kept skipping CAPI — silently blocking the fix.
      if (data?.skipped && data?.reason === "meta_not_configured") {
        try {
          localStorage.setItem(batch.cacheKey, String(Date.now() + 6 * 60 * 60 * 1000));
        } catch { /* localStorage unavailable — best effort */ }
      }
    })
    .catch((err) => {
      console.warn("Meta CAPI fire-and-forget error:", err);
    });
}

function enqueueCapiEvent(storeId: string, cacheKey: string, event: any) {
  let batch = batches.get(storeId);
  if (!batch) {
    batch = { events: [], timer: null, cacheKey };
    batches.set(storeId, batch);
  }
  batch.events.push(event);
  if (batch.events.length >= MAX_BATCH) {
    flushBatch(storeId);
    return;
  }
  if (!batch.timer) {
    batch.timer = setTimeout(() => flushBatch(storeId), BATCH_WINDOW_MS);
  }
}

// Never lose a queued event when the shopper navigates away (checkout →
// payment gateway is the critical case).
if (typeof window !== "undefined") {
  const flushAll = () => {
    for (const storeId of [...batches.keys()]) flushBatch(storeId);
  };
  window.addEventListener("pagehide", flushAll);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAll();
  });
}


// Server-side CAPI is only meaningful for high-intent / conversion events.
// PageView, Search, ViewCart etc. already fire via the browser pixel and CAPI
// dedupe adds ~zero attribution lift for them. Restricting CAPI to the funnel
// events below cuts edge invocations by ~90% on a busy storefront while
// keeping every signal Meta's optimization actually needs.
//
// ViewContent is included because Meta Events Manager flags it as missing CAPI
// coverage (degrades EMQ + iOS attribution). It only fires when the store has
// CAPI configured (__SF_META_CAPI_ENABLED__ === true) — unconfigured stores
// still short-circuit before any edge call.
// PageView + Lead are mirrored to CAPI so Meta's "browser ⇄ server event
// coverage" diagnostic stops flagging us. Both fire with shared event_ids so
// the server event deduplicates against the pixel one — no double-counting.
// Purchase is intentionally excluded from this public browser path; confirmed
// orders fire Purchase only from payment/order edge functions after verification.
const CAPI_EVENTS = new Set([
  "PageView",
  "ViewContent",
  "AddToCart",
  "InitiateCheckout",
  "AddPaymentInfo",
  "Lead",
]);


export function fireMetaCAPI(params: CAPIEventParams) {
  // Guard: never fire from Lovable preview/editor/dev domains.
  if (isNonProductionHost()) return;

  // Anti-ban hardening: per-store hard isolation.
  // StorefrontShell sets `__SF_STORE_ID__` to the store the page is rendering.
  // If a stale callback (e.g. from a different tab's cart context, or a
  // mis-wired upsell card) tries to fire CAPI for a DIFFERENT store, drop the
  // event. This guarantees one storefront can never push events into another
  // merchant's pixel — keeps Meta's cross-store correlation clean.
  if (typeof window !== "undefined") {
    const expectedStoreId = (window as any).__SF_STORE_ID__;
    if (expectedStoreId && params.storeId && expectedStoreId !== params.storeId) {
      console.warn("[meta-capi] store mismatch — dropping event", {
        event: params.eventName,
        expected: expectedStoreId,
        got: params.storeId,
      });
      return;
    }
  }

  // Cost-cut: storefront shell sets this flag to false when the merchant has
  // NOT configured a Meta access token. In that case the edge function would
  // just return {skipped:true} on every probe — skip the round-trip entirely.
  // Only `false` skips; `undefined` (flag not hydrated yet) falls through to
  // the legacy probe + localStorage cache so we never break existing setups.
  if (typeof window !== "undefined" && (window as any).__SF_META_CAPI_ENABLED__ === false) {
    return;
  }

  // Cost-cut: drop low-value events server-side; pixel still tracks them client-side.
  if (!CAPI_EVENTS.has(params.eventName)) return;

  // Skip if we've already learned this store has no CAPI access token configured.
  const cacheKey = `meta_capi_skip_${params.storeId}`;

  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const expiresAt = parseInt(cached, 10);
      if (Number.isFinite(expiresAt) && Date.now() < expiresAt) return;
      // expired — fall through to re-check
      localStorage.removeItem(cacheKey);
    }
  } catch {
    // localStorage unavailable (private mode etc.) — proceed with call
  }

  // If a probe is already in flight for this store, wait for it. If it
  // resolves to "skipped", drop this event without a second network call.
  const existing = inflightProbe.get(params.storeId);
  if (existing) {
    existing.then((skipped) => {
      if (skipped) return;
      // Probe came back configured — fire this event normally (recursive,
      // but cache/inflight will prevent loops).
      fireMetaCAPI(params);
    });
    return;
  }

  const { fbc, fbp } = getMetaCookies();
  // Per-call params win over the global registry — explicit > implicit.
  // The PageView CAPI mirror fires from useFacebookPixel on a setTimeout(0),
  // which can beat StorefrontShell's seedCapiUserFromStorage() to the punch —
  // that PageView then went out with no phone/name while its browser twin
  // (initialised inline in index.html) had them. Seed on demand when the
  // registry is still empty so both halves of the pair carry identical keys.
  let u = getCapiUser();
  if (!u.phone && !u.email) {
    try {
      seedCapiUserFromStorage((window as any).__SF_STORE_ID__ || params.storeId);
      u = getCapiUser();
    } catch { /* noop */ }
  }

  const rawEmail = params.userEmail ?? u.email;
  const userEmail = isRealEmail(rawEmail) ? rawEmail : undefined;
  const userPhone = params.userPhone ?? u.phone;
  // Always-on external_id, pinned to the persistent first-party visitor ID so
  // one shopper is never split into several Meta identities mid-funnel.
  const externalId = getOrCreateSfVid() || u.externalId || params.externalId || undefined;
  const firstName = params.firstName ?? u.firstName;
  const lastName = params.lastName ?? u.lastName;
  const city = params.city ?? u.city;
  const state = params.state ?? u.state;
  const zipCode = params.zipCode ?? u.zipCode;

  // Fire and forget — don't block the UI
  // Sanitize event_source_url — strip ALL query params and fragments.
  // URL params can contain PII (?email=, ?phone=, ?coupon=) or junk (?fbclid, utm_*)
  // which Meta's URL hygiene rules forbid in event_source_url and use as a fraud signal.
  // Sending only origin+pathname is the safe canonical form Meta recommends.
  let safeUrl = "";
  try {
    const u2 = new URL(window.location.href);
    safeUrl = `${u2.origin}${u2.pathname}`;
  } catch {
    safeUrl = window.location.origin;
  }

  const probe = supabase.functions
    .invoke("meta-capi", {
      body: {
        store_id: params.storeId,
        event_name: params.eventName,
        event_id: params.eventId || undefined,
        event_source_url: safeUrl,
        user_email: userEmail || undefined,
        user_phone: userPhone || undefined,
        user_agent: navigator.userAgent,
        fbc: fbc || undefined,
        fbp: fbp || undefined,
        external_id: externalId || undefined,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        city: city || undefined,
        state: state || undefined,
        zip_code: zipCode || undefined,
        custom_data: params.customData || undefined,
        declared_client_ip: getDeclaredClientIp() || undefined,
      },
    })
    .then(({ data, error }) => {
      if (error) {
        console.warn("Meta CAPI warning:", error.message);
        return false;
      }
      // Cache "no CAPI configured" for 6 hours so we don't re-call the edge
      // function on every visit. Deliberately SHORT: a 7-day cache meant that
      // the moment a merchant finally pasted a Meta access token, returning
      // visitors kept skipping CAPI for a whole week — silently blocking the
      // fix. 6h keeps the cost saving but lets a new token go live same-day.
      if (data?.skipped && data?.reason === "meta_not_configured") {
        try {
          const expiresAt = Date.now() + 6 * 60 * 60 * 1000;
          localStorage.setItem(cacheKey, String(expiresAt));
        } catch {
          // localStorage unavailable — best effort
        }
        return true;
      }
      return false;
    })
    .catch((err) => {
      console.warn("Meta CAPI fire-and-forget error:", err);
      return false;
    })
    .finally(() => {
      inflightProbe.delete(params.storeId);
    }) as Promise<boolean>;

  inflightProbe.set(params.storeId, probe);
}
