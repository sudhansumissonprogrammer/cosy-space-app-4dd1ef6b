// Shared helper: fires Meta CAPI "Purchase" event server-to-server.
//
// Used by COD (place-order), Razorpay (razorpay-verify), and Cashfree (cashfree-webhook).
// Idempotent — uses `orders.meta_purchase_fired_at` as a DB stamp so the same order
// never reports a Purchase twice (across webhook retries, refreshes, multi-gateway).
//
// Safety:
//  - Never throws — failures are logged but don't break the order flow.
//  - Skips silently if the store has no Pixel/access token configured.
//  - Forwards the buyer's REAL IP (stored on the order row at place-order time),
//    NEVER the edge runtime IP. This is the change that protects ad accounts.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const META_GRAPH_URL = "https://graph.facebook.com/v21.0";

// Normalization helpers per Meta CAPI spec — must match the rules in meta-capi/index.ts.
// Wrong normalization = our hash ≠ Meta's hash = no match = degraded EMQ score.
const normEmail = (v: string) => v.trim().toLowerCase();
const normName = (v: string) => v.trim().toLowerCase().replace(/[^a-zà-ÿ\u0080-\uffff]/g, "");
const normCityState = (v: string) => v.trim().toLowerCase().replace(/[^a-z]/g, "");
const normZip = (v: string) => v.trim().toLowerCase().replace(/\s+/g, "");
const normCountry = (v: string) => v.trim().toLowerCase().slice(0, 2);

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface FirePurchaseOpts {
  /** Source: "cod" | "razorpay" | "cashfree" — for logging only. */
  source: string;
  /** Optional override for event_source_url if not stored on the order. */
  eventSourceUrl?: string;
}

export async function firePurchaseCapi(
  supabase: SupabaseClient,
  orderId: string,
  opts: FirePurchaseOpts,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    // 1. Idempotency check + load order with all buyer fields.
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select(
        "id, store_id, status, total, currency, customer_phone, customer_name, city, state, pincode, " +
        "storefront_customer_id, buyer_ip, buyer_user_agent, buyer_fbc, buyer_fbp, " +
        "meta_event_id, meta_event_source_url, meta_purchase_fired_at",
      )
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr || !order) {
      console.warn(`[capi:${opts.source}] order not found`, orderId, orderErr);
      return { ok: false, reason: "order_not_found" };
    }

    // 🚫 Never report Purchase for orders that aren't actually paid/confirmed.
    // pending / cancelled / refunded / failed → Meta would count phantom revenue and
    // flag the account for inflated conversion data. Only fire on real conversions.
    const status = String(order.status || "").toLowerCase();
    const PAID_STATUSES = new Set([
      "paid", "confirmed", "partially_paid", "processing", "shipped", "delivered", "completed",
    ]);
    if (!PAID_STATUSES.has(status)) {
      console.log(`[capi:${opts.source}] skip — status=${status}`, orderId);
      return { ok: true, reason: `skipped_status_${status}` };
    }

    if (order.meta_purchase_fired_at) {
      // Already fired — idempotent no-op.
      return { ok: true, reason: "already_fired" };
    }

    // 🚫 Skip MANUAL / admin-created orders (Shopify-style behaviour).
    // A real storefront purchase always carries at least one browser signal:
    //   buyer_user_agent, buyer_fbp, buyer_fbc, or meta_event_id.
    // Manual orders entered from the admin dashboard have none of these →
    // sending them tanks Event Match Quality, gives no attribution, and risks
    // double-counting if the same buyer also placed online.
    const hasBrowserSignals =
      !!order.buyer_user_agent || !!order.buyer_fbp || !!order.buyer_fbc || !!order.meta_event_id;
    if (!hasBrowserSignals) {
      // Stamp so we don't re-evaluate on every status change.
      await supabase
        .from("orders")
        .update({ meta_purchase_fired_at: new Date().toISOString() })
        .eq("id", orderId)
        .is("meta_purchase_fired_at", null);
      console.log(`[capi:${opts.source}] skip — manual order (no browser signals)`, orderId);
      return { ok: true, reason: "manual_order" };
    }

    // 2. Load store pixel config.
    const { data: store } = await supabase
      .from("stores")
      .select("facebook_pixel_id, meta_access_token, slug, custom_domain")
      .eq("id", order.store_id)
      .single();

    if (!store?.facebook_pixel_id || !store?.meta_access_token) {
      // No Pixel configured — stamp anyway so we don't keep retrying.
      await supabase
        .from("orders")
        .update({ meta_purchase_fired_at: new Date().toISOString() })
        .eq("id", orderId)
        .is("meta_purchase_fired_at", null);
      return { ok: true, reason: "meta_not_configured" };
    }

    // 3. Load order items for content_ids / contents.
    const { data: items } = await supabase
      .from("order_items")
      .select("product_id, product_name, quantity, unit_price")
      .eq("order_id", orderId);

    // 4. Load customer email if storefront customer.
    let customerEmail: string | null = null;
    if (order.storefront_customer_id) {
      const { data: cust } = await supabase
        .from("storefront_customers")
        .select("email")
        .eq("id", order.storefront_customer_id)
        .maybeSingle();
      customerEmail = cust?.email ?? null;
    }

    // 5. Build user_data with hashed PII.
    const userData: Record<string, unknown> = {
      client_user_agent: order.buyer_user_agent || undefined,
      fbc: order.buyer_fbc || undefined,
      fbp: order.buyer_fbp || undefined,
    };

    // CRITICAL: only send IP if we have the real buyer IP. Never the edge IP.
    if (order.buyer_ip) {
      userData.client_ip_address = order.buyer_ip;
    }

    if (customerEmail) userData.em = [await sha256Hex(normEmail(customerEmail))];
    if (order.customer_phone) {
      const cleaned = String(order.customer_phone).replace(/\D/g, "");
      if (cleaned) userData.ph = [await sha256Hex(cleaned)];
    }
    // external_id: prefer storefront customer id, fall back to order id.
    userData.external_id = [
      await sha256Hex(normEmail(order.storefront_customer_id || order.id)),
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
    // Country only when we have a real address signal.
    if (order.city || order.state || order.pincode) {
      userData.country = [await sha256Hex(normCountry("in"))];
    }

    // 6. Build event.
    const contentIds = (items || []).map((i) => i.product_id).filter(Boolean) as string[];
    const eventSourceUrl =
      opts.eventSourceUrl ||
      (store.custom_domain
        ? `https://${store.custom_domain}/checkout`
        : `https://${store.slug}.shopbanao.in/checkout`);

    const event = {
      event_name: "Purchase",
      event_time: Math.floor(Date.now() / 1000),
      event_id: order.meta_event_id || order.id, // dedupe vs browser Pixel
      event_source_url: eventSourceUrl,
      action_source: "website",
      user_data: userData,
      custom_data: {
        currency: order.currency || "INR",
        value: Number(order.total) || 0,
        content_type: "product",
        content_ids: contentIds,
        contents: (items || []).map((i) => ({
          id: i.product_id,
          quantity: Number(i.quantity) || 1,
          item_price: Number(i.unit_price) || 0,
        })),
        num_items: (items || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0),
        order_id: order.id,
      },
    };

    // 7. Send to Meta — with 1 retry on 5xx (transient Meta blip).
    const sendOnce = () => fetch(
      `${META_GRAPH_URL}/${store.facebook_pixel_id}/events?access_token=${store.meta_access_token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: [event] }),
      },
    );
    let resp = await sendOnce();
    if (resp.status >= 500 && resp.status < 600) {
      await new Promise((r) => setTimeout(r, 500));
      resp = await sendOnce();
    }

    const result = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      console.error(`[capi:${opts.source}] meta error`, JSON.stringify(result));
      // Don't stamp on hard failure — let next gateway/retry try again.
      // But avoid infinite retries for 4xx (config errors).
      if (resp.status >= 400 && resp.status < 500) {
        await supabase
          .from("orders")
          .update({ meta_purchase_fired_at: new Date().toISOString() })
          .eq("id", orderId)
          .is("meta_purchase_fired_at", null);
      }
      return { ok: false, reason: `meta_${resp.status}` };
    }

    // 8. Success — stamp the order. Conditional update so concurrent fires don't double-stamp.
    await supabase
      .from("orders")
      .update({ meta_purchase_fired_at: new Date().toISOString() })
      .eq("id", orderId)
      .is("meta_purchase_fired_at", null);

    console.log(`[capi:${opts.source}] purchase fired`, orderId, result.events_received);
    return { ok: true };
  } catch (err) {
    console.error(`[capi:${opts.source}] unexpected error`, err);
    return { ok: false, reason: "exception" };
  }
}
