import { supabase } from "@/integrations/supabase/client";
import { getCapiUser } from "@/lib/metaEnrichment";

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
export function fireMetaCAPI(params: CAPIEventParams) {
  // Guard: never fire from Lovable preview/editor/dev domains.
  if (isNonProductionHost()) return;

  // Skip if store has no pixel configured (cached per store)
  const cacheKey = `meta_pixel_${params.storeId}`;
  if (sessionStorage.getItem(cacheKey) === "0") return;

  const { fbc, fbp } = getMetaCookies();

  // Auto-merge globally-registered user data (logged-in storefront customer).
  // Per-call params win over the global registry — explicit > implicit.
  const u = getCapiUser();
  const userEmail = params.userEmail ?? u.email;
  const userPhone = params.userPhone ?? u.phone;
  const externalId = params.externalId ?? u.externalId;
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

  supabase.functions
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
        return;
      }
      // Cache "no pixel" when function says meta is not configured
      if (data?.skipped && data?.reason === "meta_not_configured") {
        sessionStorage.setItem(cacheKey, "0");
      }
    })
    .catch((err) => {
      console.warn("Meta CAPI fire-and-forget error:", err);
    });
}
