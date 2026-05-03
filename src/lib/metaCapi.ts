import { supabase } from "@/integrations/supabase/client";

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
  // Skip if store has no pixel configured (cached per store)
  const cacheKey = `meta_pixel_${params.storeId}`;
  if (sessionStorage.getItem(cacheKey) === "0") return;

  const { fbc, fbp } = getMetaCookies();

  // Fire and forget — don't block the UI
  supabase.functions
    .invoke("meta-capi", {
      body: {
        store_id: params.storeId,
        event_name: params.eventName,
        event_id: params.eventId || undefined,
        event_source_url: window.location.href,
        user_email: params.userEmail || undefined,
        user_phone: params.userPhone || undefined,
        user_agent: navigator.userAgent,
        fbc: fbc || undefined,
        fbp: fbp || undefined,
        external_id: params.externalId || undefined,
        first_name: params.firstName || undefined,
        last_name: params.lastName || undefined,
        city: params.city || undefined,
        state: params.state || undefined,
        zip_code: params.zipCode || undefined,
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
