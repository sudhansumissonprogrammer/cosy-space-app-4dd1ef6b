import { supabase } from "@/integrations/supabase/client";
import { getCapiUser, getOrCreateSfVid } from "@/lib/metaEnrichment";

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
  return { fbc, fbp };
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
// In-flight dedupe: if multiple events fire on a fresh visit (PageView +
// ViewContent + AddToCart, etc.) before the first response sets the
// "meta_not_configured" cache, they would ALL hit the edge function. Track
// the first probe per store so the rest short-circuit until it resolves.
const inflightProbe = new Map<string, Promise<boolean>>();

// Server-side CAPI is only meaningful for high-intent / conversion events.
// PageView, ViewContent and AddToCart already fire via the browser pixel and
// their CAPI dedupe adds ~zero attribution lift (Meta's Aggregated Event
// Measurement handles them). Restricting CAPI to the events below cuts edge
// invocations by ~95% on a busy storefront with no measurable EMQ drop.
const CAPI_EVENTS = new Set([
  "Purchase",
  "InitiateCheckout",
  "Lead",
  "CompleteRegistration",
  "Subscribe",
]);

export function fireMetaCAPI(params: CAPIEventParams) {
  // Guard: never fire from Lovable preview/editor/dev domains.
  if (isNonProductionHost()) return;

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
  const u = getCapiUser();
  const userEmail = params.userEmail ?? u.email;
  const userPhone = params.userPhone ?? u.phone;
  // Always-on external_id: explicit > registry > anon visitor cookie.
  const externalId = params.externalId ?? u.externalId ?? getOrCreateSfVid() ?? undefined;
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
      },
    })
    .then(({ data, error }) => {
      if (error) {
        console.warn("Meta CAPI warning:", error.message);
        return false;
      }
      // Cache "no CAPI configured" for 7 days so we don't re-call the edge
      // function on every visit. localStorage persists across sessions/tabs.
      if (data?.skipped && data?.reason === "meta_not_configured") {
        try {
          const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
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
