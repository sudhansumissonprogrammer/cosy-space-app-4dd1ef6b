// Shared helper: fires Meta CAPI reversal for a cancelled/refunded order.
//
// WHY THIS EXISTS
// ---------------
// firePurchaseCapi reports the FULL order value to match GoKwik / Shopify /
// Shiprocket behaviour (so Meta's bidder optimizes correctly). The trade-off
// is that a high cancellation rate can look like fraud to Meta ("this Pixel
// reports ₹X but nothing materializes") and triggers Systems Circumvention
// flags. Reversing cancelled purchases keeps the Pixel honest.
//
// HOW META RECONCILES
// -------------------
// Send a `Purchase` event with:
//   • the SAME event_id as the original Purchase
//   • a NEGATIVE `value`
//   • action_source = "website"
// Meta's Events Manager and Ads reporting subtract this from the earlier
// Purchase. This is the same pattern Shopify uses for order refunds via CAPI.
//
// IDEMPOTENCY
// -----------
// `orders.meta_refund_fired_at` — one reversal per order, forever. Webhook
// retries and multi-source cancels (webhook + admin dashboard on same order)
// collapse to a single reversal.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const META_GRAPH_URL = "https://graph.facebook.com/v21.0";

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const normEmail = (v: string) => v.trim().toLowerCase();
const normName = (v: string) => v.trim().toLowerCase().replace(/[^a-zà-ÿ\u0080-\uffff]/g, "");
const normCityState = (v: string) => v.trim().toLowerCase().replace(/[^a-z]/g, "");
const normZip = (v: string) => v.trim().toLowerCase().replace(/\s+/g, "");

function isPrivateIp(ip: string | null | undefined): boolean {
  if (!ip) return true;
  const v = ip.trim().toLowerCase();
  return /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd)/.test(v);
}

export interface FireRefundOpts {
  /** Source: "expire-cron" | "cancel-endpoint" | "razorpay-webhook" | "payu-webhook" — for logging. */
  source: string;
}

export async function fireRefundCapi(
  supabase: SupabaseClient,
  orderId: string,
  opts: FireRefundOpts,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    // 1. Load order + guard: refund only makes sense if Purchase actually fired.
    const { data: order } = await supabase
      .from("orders")
      .select(
        "id, store_id, status, total, currency, customer_phone, customer_name, city, state, pincode, " +
        "storefront_customer_id, buyer_ip, buyer_user_agent, buyer_fbc, buyer_fbp, " +
        "meta_event_id, meta_event_source_url, meta_purchase_fired_at, meta_refund_fired_at",
      )
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return { ok: false, reason: "order_not_found" };
    if (!order.meta_purchase_fired_at) {
      // Nothing to reverse — Purchase never went out (either deferred/settle
      // window still open, or manual order, or no pixel). Stamp so we never
      // re-evaluate for this order.
      await supabase
        .from("orders")
        .update({ meta_refund_fired_at: new Date().toISOString() })
        .eq("id", orderId)
        .is("meta_refund_fired_at", null);
      return { ok: true, reason: "purchase_never_fired" };
    }
    if (order.meta_refund_fired_at) return { ok: true, reason: "already_refunded" };

    // 2. Store pixel config.
    const { data: store } = await supabase
      .from("stores")
      .select("facebook_pixel_id, meta_access_token, slug, custom_domain, capi_disabled")
      .eq("id", order.store_id)
      .single();

    if (!store?.facebook_pixel_id || !store?.meta_access_token || (store as any).capi_disabled) {
      await supabase
        .from("orders")
        .update({ meta_refund_fired_at: new Date().toISOString() })
        .eq("id", orderId)
        .is("meta_refund_fired_at", null);
      return { ok: true, reason: "meta_not_configured" };
    }

    // 3. Order items.
    const { data: items } = await supabase
      .from("order_items")
      .select("product_id, quantity, unit_price")
      .eq("order_id", orderId);

    // 4. Rebuild user_data with the SAME hashes as the original Purchase so
    //    Meta matches the reversal to the right person for LTV / audiences.
    let customerEmail: string | null = null;
    if (order.storefront_customer_id) {
      const { data: cust } = await supabase
        .from("storefront_customers")
        .select("email")
        .eq("id", order.storefront_customer_id)
        .maybeSingle();
      customerEmail = cust?.email ?? null;
    }

    const userData: Record<string, unknown> = {
      client_user_agent: order.buyer_user_agent || undefined,
      fbc: order.buyer_fbc || undefined,
      fbp: order.buyer_fbp || undefined,
    };
    if (order.buyer_ip && !isPrivateIp(order.buyer_ip)) {
      userData.client_ip_address = order.buyer_ip;
    }
    if (customerEmail) userData.em = [await sha256Hex(normEmail(customerEmail))];
    if (order.customer_phone) {
      const cleaned = String(order.customer_phone).replace(/\D/g, "");
      const e164 = cleaned.length === 10 ? `91${cleaned}` : cleaned;
      if (e164) userData.ph = [await sha256Hex(e164)];
    }
    userData.external_id = [
      await sha256Hex(String(order.storefront_customer_id || order.id).trim()),
    ];
    if (order.customer_name) {
      const parts = String(order.customer_name).trim().split(/\s+/);
      const fn = parts[0] ? normName(parts[0]) : "";
      const ln = parts.length > 1 ? normName(parts.slice(1).join(" ")) : "";
      if (fn) userData.fn = [await sha256Hex(fn)];
      if (ln) userData.ln = [await sha256Hex(ln)];
    }
    if (order.city) {
      const v = normCityState(String(order.city));
      if (v) userData.ct = [await sha256Hex(v)];
    }
    if (order.state) {
      const v = normCityState(String(order.state));
      if (v) userData.st = [await sha256Hex(v)];
    }
    if (order.pincode) {
      const v = normZip(String(order.pincode));
      if (v) userData.zp = [await sha256Hex(v)];
    }

    const contentIds = (items || []).map((i) => i.product_id).filter(Boolean) as string[];
    const eventSourceUrl =
      (order as any).meta_event_source_url ||
      (store.custom_domain
        ? `https://${store.custom_domain}/checkout`
        : `https://${store.slug}.shopbanao.in/checkout`);

    // 5. Negative-value Purchase = Meta's canonical reversal pattern.
    //    A DIFFERENT event_id (suffix `-refund`) — same event_id would be
    //    treated as a duplicate Purchase and dropped, not a reversal.
    const event = {
      event_name: "Purchase",
      event_time: Math.floor(Date.now() / 1000),
      event_id: `${order.meta_event_id || order.id}-refund`,
      event_source_url: eventSourceUrl,
      action_source: "website",
      user_data: userData,
      custom_data: {
        currency: order.currency || "INR",
        value: -(Number(order.total) || 0), // NEGATIVE
        content_type: "product",
        content_ids: contentIds,
        contents: (items || []).map((i) => ({
          id: i.product_id,
          quantity: Number(i.quantity) || 1,
          item_price: -(Number(i.unit_price) || 0),
        })),
        num_items: (items || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0),
        order_id: order.id,
        refund_reason: order.status, // "cancelled" | "refunded"
      },
    };

    // Atomic claim BEFORE sending.
    const { data: claimed } = await supabase
      .from("orders")
      .update({ meta_refund_fired_at: new Date().toISOString() })
      .eq("id", orderId)
      .is("meta_refund_fired_at", null)
      .select("id");
    if (!claimed || claimed.length === 0) return { ok: true, reason: "already_refunded" };

    const resp = await fetch(
      `${META_GRAPH_URL}/${store.facebook_pixel_id}/events`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${store.meta_access_token}`,
        },
        body: JSON.stringify({ data: [event] }),
      },
    );
    const result = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      console.error(`[capi-refund:${opts.source}] meta error`, JSON.stringify(result));
      // 4xx = config error, keep the stamp so we don't retry forever.
      // 5xx = release stamp so cron/next event can retry.
      if (resp.status >= 500) {
        await supabase
          .from("orders")
          .update({ meta_refund_fired_at: null })
          .eq("id", orderId);
      }
      return { ok: false, reason: `meta_${resp.status}` };
    }

    console.log(`[capi-refund:${opts.source}] reversal fired`, orderId, result.events_received);
    return { ok: true };
  } catch (err) {
    console.error(`[capi-refund:${opts.source}] unexpected`, err);
    return { ok: false, reason: "exception" };
  }
}
