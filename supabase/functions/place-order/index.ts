import { createClient } from "npm:@supabase/supabase-js@2";
import { firePurchaseCapi } from "../_shared/firePurchaseCapi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Max-Age": "86400",
};

type CheckoutItem = {
  productId: string;
  variantId?: string | null;
  name: string;
  price: number;
  quantity: number;
};

const FBP_RX = /^fb\.[12]\.\d{10,16}\.\d+$/;
const FBC_RX = /^fb\.[12]\.\d{10,16}\.[A-Za-z0-9_-]+$/;
const META_EVENT_ID_RX = /^[A-Za-z0-9._:-]{8,120}$/;
const sanitizeFb = (v: unknown, rx: RegExp): string | null =>
  typeof v === "string" && v.length <= 256 && rx.test(v) ? v : null;
const sanitizeMetaEventId = (v: unknown): string | null =>
  typeof v === "string" && META_EVENT_ID_RX.test(v) ? v : null;

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

function hostAllowed(host: string, store: { slug?: string | null; custom_domain?: string | null }): boolean {
  const clean = normalizeHost(host);
  const customDomain = store.custom_domain ? normalizeHost(String(store.custom_domain)) : "";
  const slugHost = store.slug ? `${String(store.slug).toLowerCase()}.shopbanao.in` : "";
  return clean === customDomain || clean.endsWith(`.${customDomain}`) || clean === slugHost || clean === "shopbanao.in";
}

function sanitizeMetaSourceUrl(raw: unknown, store: { slug?: string | null; custom_domain?: string | null }): string | null {
  if (typeof raw !== "string" || raw.length > 2048) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    if (!hostAllowed(u.hostname, store)) return null;
    return `${u.origin}${u.pathname}`;
  } catch {
    return null;
  }
}
function isPrivateIp(ip: string | null | undefined): boolean {
  if (!ip) return true;
  const v = ip.trim().toLowerCase();
  return /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd)/.test(v);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting: max 5 orders per IP per 10 minutes
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") || "unknown";
    const rateLimitKey = `order_rl:${clientIp}`;
    const now = Date.now();

    // Use in-memory rate limiting (resets per cold start, lightweight)
    if (!globalThis.__orderRateLimit) globalThis.__orderRateLimit = new Map();
    const rlMap = globalThis.__orderRateLimit as Map<string, number[]>;
    const timestamps = rlMap.get(rateLimitKey) || [];
    const windowStart = now - 10 * 60 * 1000;
    const recentTimestamps = timestamps.filter((t: number) => t > windowStart);

    if (recentTimestamps.length >= 5) {
      return new Response(JSON.stringify({ error: "Too many orders. Please try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    recentTimestamps.push(now);
    rlMap.set(rateLimitKey, recentTimestamps);

    // Prune old entries periodically
    if (rlMap.size > 1000) {
      for (const [key, vals] of rlMap) {
        if (vals.every((t: number) => t < windowStart)) rlMap.delete(key);
      }
    }

    let {
      store_id,
      order,
      items,
      lead,
      coupon_id,
      abandoned_cart_id,
      checkout_token,
      meta,
      visitor_id,
      session_id,
      attribution,
    }: {
      store_id: string;
      order: {
        total: number;
        currency: string;
        status: string;
        customer_name: string;
        customer_phone: string;
        street_address: string;
        city: string;
        state: string;
        pincode: string;
        payment_method: "cod" | "razorpay" | "cashfree" | "payu";
        notes?: string;
        storefront_customer_id?: string | null;
        payment_type?: "full" | "partial";
      };
      items: CheckoutItem[];
      lead?: {
        name: string;
        phone: string;
        product_name: string;
        product_id: string | null;
        source: string;
      };
      coupon_id?: string | null;
      abandoned_cart_id?: string | null;
      checkout_token?: string | null;
      // Meta tracking signals captured from the browser. Used for safe CAPI Purchase reporting.
      meta?: {
        event_id?: string;
        fbc?: string;
        fbp?: string;
        event_source_url?: string;
      };
      // Strict analytics: link this order back to the visitor session that
      // produced it so conversion rate = orders / unique sessions is accurate.
      visitor_id?: string | null;
      session_id?: string | null;
      // Attribution snapshot: last-touch UTM + ad-click IDs (fbclid/gclid/...)
      // sent by the browser so we can tie revenue back to campaigns and ads.
      attribution?: Record<string, string | null> | null;
    } = await req.json();



    if (!store_id || !order || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: store, error: storeErr } = await supabase
      .from("stores")
      .select("id, is_suspended, default_profit_margin, slug, custom_domain")
      .eq("id", store_id)
      .single();

    if (storeErr || !store || store.is_suspended) {
      return new Response(JSON.stringify({ error: "Store is not accepting orders" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency: if checkout_token already exists, return the existing order
    if (checkout_token) {
      const { data: existingOrder } = await supabase
        .from("orders")
        .select("id, order_number")
        .eq("store_id", store_id)
        .eq("checkout_token", checkout_token)
        .maybeSingle();

      if (existingOrder) {
        const orderNumber = existingOrder.order_number
          ? `#${1000 + existingOrder.order_number}`
          : `#${existingOrder.id.slice(0, 8).toUpperCase()}`;
        return new Response(JSON.stringify({ success: true, order_id: existingOrder.id, order_number: orderNumber, profit: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let storefrontCustomerId: string | null = null;
    if (order.storefront_customer_id) {
      const { data: customer } = await supabase
        .from("storefront_customers")
        .select("id")
        .eq("id", order.storefront_customer_id)
        .eq("store_id", store_id)
        .maybeSingle();

      if (customer?.id) storefrontCustomerId = customer.id;
    }

    // ────────────────────────────────────────────────────────────────
    // SECURITY: server-side price + total recomputation.
    // Never trust client-supplied prices, totals, discounts, or status.
    // Attackers can otherwise place a ₹10,000 order at ₹1.
    // ────────────────────────────────────────────────────────────────
    const productIds = [...new Set(items.map((i) => i.productId).filter(Boolean))];
    if (productIds.length === 0 || items.some((i) => !i.productId)) {
      return new Response(JSON.stringify({ error: "Invalid cart items" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: dbProducts, error: prodErr } = await supabase
      .from("products")
      .select("id, price, sale_price, is_active, store_id, image_url")
      .in("id", productIds);
    if (prodErr || !dbProducts || dbProducts.length !== productIds.length) {
      return new Response(JSON.stringify({ error: "One or more products not found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const productById = new Map<string, any>();
    const canonicalPrice = new Map<string, number>();
    const canonicalImage = new Map<string, string | null>();
    for (const p of dbProducts) {
      if (p.store_id !== store_id || !p.is_active) {
        return new Response(JSON.stringify({ error: "Product unavailable" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      productById.set(p.id, p);
      const cp = p.sale_price != null ? Number(p.sale_price) : Number(p.price);
      if (!(cp >= 0)) {
        return new Response(JSON.stringify({ error: "Invalid product price" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      canonicalPrice.set(p.id, cp);
      canonicalImage.set(p.id, (p as any).image_url ?? null);
    }
    const variantIds = [...new Set(items.map((i) => i.variantId).filter(Boolean))] as string[];
    const variantById = new Map<string, any>();
    if (variantIds.length > 0) {
      const { data: dbVariants, error: variantErr } = await supabase
        .from("product_variants")
        .select("id, product_id, name, price, is_active")
        .in("id", variantIds);
      if (variantErr || !dbVariants || dbVariants.length !== variantIds.length) {
        return new Response(JSON.stringify({ error: "One or more variants not found" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      for (const v of dbVariants) {
        if (!v.is_active || !productById.has(v.product_id)) {
          return new Response(JSON.stringify({ error: "Variant unavailable" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        variantById.set(v.id, v);
      }
    }
    // Override every line-item price with the DB canonical price.
    let serverSubtotal = 0;
    for (const item of items) {
      const variant = item.variantId ? variantById.get(item.variantId) : null;
      if (variant && variant.product_id !== item.productId) {
        return new Response(JSON.stringify({ error: "Variant/product mismatch" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const variantPrice = variant?.price != null ? Number(variant.price) : null;
      const cp = variantPrice != null && variantPrice >= 0 ? variantPrice : canonicalPrice.get(item.productId)!;
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 0));
      item.price = cp;
      item.quantity = qty;
      serverSubtotal += cp * qty;
    }

    // Validate coupon server-side.
    let serverDiscount = 0;
    let validCouponId: string | null = null;
    if (coupon_id) {
      const { data: c } = await supabase
        .from("coupons")
        .select("id, store_id, discount_type, discount_value, min_order_amount, max_uses, used_count, is_active, starts_at, expires_at")
        .eq("id", coupon_id)
        .maybeSingle();
      const nowD = new Date();
      const ok = c
        && c.store_id === store_id
        && c.is_active
        && (!c.starts_at || new Date(c.starts_at) <= nowD)
        && (!c.expires_at || new Date(c.expires_at) > nowD)
        && (c.max_uses == null || (c.used_count ?? 0) < c.max_uses)
        && serverSubtotal >= Number(c.min_order_amount || 0);
      if (ok && c) {
        if (c.discount_type === "percentage") {
          serverDiscount = serverSubtotal * (Number(c.discount_value) / 100);
        } else {
          serverDiscount = Number(c.discount_value);
        }
        serverDiscount = Math.max(0, Math.min(serverDiscount, serverSubtotal));
        validCouponId = c.id;
      }
    }

    // Validate shipping server-side.
    let serverShipping = 0;
    const { data: shipConf } = await supabase
      .from("store_shipping_config")
      .select("flat_rate, free_shipping_above, is_active")
      .eq("store_id", store_id)
      .maybeSingle();
    if (shipConf?.is_active) {
      const subtotalAfterDiscount = serverSubtotal - serverDiscount;
      if (!shipConf.free_shipping_above || subtotalAfterDiscount < Number(shipConf.free_shipping_above)) {
        serverShipping = Math.max(0, Number(shipConf.flat_rate) || 0);
      }
    }

    // Validate tax server-side; mirrors CheckoutV2. Inclusive tax is already in
    // item prices, while exclusive tax is added to the payable amount.
    let serverTax = 0;
    const { data: taxConf } = await supabase
      .from("store_tax_config")
      .select("tax_rate, is_active, is_inclusive")
      .eq("store_id", store_id)
      .maybeSingle();
    if (taxConf?.is_active && Number(taxConf.tax_rate) > 0) {
      const rate = Number(taxConf.tax_rate);
      serverTax = taxConf.is_inclusive
        ? serverSubtotal - (serverSubtotal / (1 + rate / 100))
        : (serverSubtotal * rate) / 100;
    }
    const serverTaxToAdd = taxConf?.is_inclusive ? 0 : serverTax;

    // C5: Atomically claim the coupon BEFORE inserting the order.
    // Prevents two concurrent checkouts from both consuming the last allowed use.
    if (validCouponId) {
      const { data: claimed, error: claimErr } = await supabase
        .rpc("claim_coupon", { _coupon_id: validCouponId, _store_id: store_id });
      if (claimErr || claimed !== true) {
        return new Response(
          JSON.stringify({ error: "Coupon no longer available. Please remove it and try again." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Prepaid discount (store-configured) — applies ONLY on full online payment.
    // Never on COD, never on partial. Recomputed server-side so client cannot
    // trick the total by pretending to pay online. Stored in `notes` line so
    // owners see why the collected amount differs from the item subtotal.
    let prepaidDiscount = 0;
    const isFullOnline =
      order.payment_type !== "partial" &&
      order.payment_method !== "cod";
    if (isFullOnline) {
      const { data: payCfg } = await supabase
        .from("store_payment_config")
        .select("prepaid_discount_enabled, prepaid_discount_type, prepaid_discount_value")
        .eq("store_id", store_id)
        .maybeSingle();
      if (payCfg?.prepaid_discount_enabled) {
        const v = Number(payCfg.prepaid_discount_value || 0);
        const base = Math.max(0, serverSubtotal - serverDiscount + serverShipping + serverTaxToAdd);
        // Skip prepaid discount on sub-₹100 carts so a ₹5 item doesn't
        // collapse to ₹0 when a fixed ₹100 discount is configured.
        if (base >= 100) {
          let d = payCfg.prepaid_discount_type === "percentage"
            ? (base * v) / 100
            : v;
          prepaidDiscount = Math.max(0, Math.min(d, base));
        }
      }

    }

    const serverTotal = Math.max(
      0,
      Math.round((serverSubtotal - serverDiscount + serverShipping + serverTaxToAdd - prepaidDiscount) * 100) / 100,
    );
    // Replace client-supplied total + coupon_id with server-verified values.
    order.total = serverTotal;
    coupon_id = validCouponId;
    if (prepaidDiscount > 0) {
      const note = `Prepaid discount: -${prepaidDiscount.toFixed(2)}`;
      order.notes = order.notes ? `${order.notes}\n${note}` : note;
    }

    // ────────────────────────────────────────────────────────────────
    // Server-side partial payment calculation (store-level).
    // Must be the SINGLE source of truth — UI value is advisory only.
    // Formula mirrors CheckoutV2Page: sum per-item advance, add full shipping
    // + proportional tax/discount adjustment, single ₹50 floor,
    // cap at order total. Never applies a per-line-item ₹50 floor.
    // ────────────────────────────────────────────────────────────────
    let isPartial = order.payment_type === "partial";
    let advancePaid = 0;
    let balanceDue = 0;

    if (isPartial) {
      // Partial requires an online gateway — reject partial+cod combo.
      if (order.payment_method === "cod") {
        return new Response(
          JSON.stringify({ error: "Partial payment requires an online payment method." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: storeData } = await supabase
        .from("stores")
        .select("partial_payment_enabled, partial_payment_type, partial_payment_value")
        .eq("id", store_id)
        .single();

      const partialValue = Number(storeData?.partial_payment_value || 0);
      if (storeData?.partial_payment_enabled && partialValue > 0) {
        let itemsAdvance = 0;
        for (const item of items) {
          const itemPrice = Number(item.price);
          const itemAdv = storeData.partial_payment_type === "percentage"
            ? Math.round(itemPrice * (partialValue / 100))
            : Math.min(partialValue, itemPrice);
          itemsAdvance += itemAdv * Number(item.quantity);
        }
        // Advance = configured up-front amount (per-item) + full shipping,
        // capped at order total. Coupons reduce the BALANCE (paid on
        // delivery), never the advance — otherwise a ₹100 coupon on a
        // ₹100 advance would drop it to ~₹69. Tax adjusts proportionally.
        const ratio = serverSubtotal > 0 ? itemsAdvance / serverSubtotal : 1;
        const raw = itemsAdvance + (serverTaxToAdd * ratio) + serverShipping;
        advancePaid = Math.max(50, Math.min(Number(order.total), Math.round(raw)));
        balanceDue = Math.max(0, Number(order.total) - advancePaid);
      } else {
        // Store doesn't actually offer partial — downgrade to full instead of
        // silently stamping payment_type=partial with advance_paid=0.
        isPartial = false;
        order.payment_type = "full";
      }
    }

    // Hardcode initial order status. Never trust the client.
    // COD → confirmed. Online (full or partial) → pending until verify upgrades it.
    const safeStatus = order.payment_method === "cod" ? "confirmed" : "pending";
    order.status = safeStatus;

    // Capture real buyer signals for Meta CAPI (forwarded by Cloudflare/Vercel/SB edge).
    // We store these on the order row so the Purchase event sent to Meta carries the
    // visitor's real IP + UA — never the edge runtime's datacenter IP.
    const rawBuyerIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      null;
    const buyerIp = isPrivateIp(rawBuyerIp) ? null : rawBuyerIp;
    const buyerUa = req.headers.get("user-agent") || null;
    const buyerFbc = sanitizeFb(meta?.fbc, FBC_RX);
    const buyerFbp = sanitizeFb(meta?.fbp, FBP_RX);
    const metaEventId = sanitizeMetaEventId(meta?.event_id);
    const metaEventSourceUrl = sanitizeMetaSourceUrl(meta?.event_source_url, store);

    // Compute new-vs-repeat: count prior PAID orders in this store for the
    // same storefront customer id (preferred) or the same normalized phone.
    // Used by the dashboard for LTV / repeat-rate slicing.
    let priorOrderCount = 0;
    try {
      const PAID = ["paid", "confirmed", "partially_paid", "delivered", "completed", "shipped"];
      const normPhone = String(order.customer_phone || "").replace(/\D/g, "");
      let q = supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("store_id", store_id)
        .in("status", PAID);
      if (storefrontCustomerId) {
        q = q.eq("storefront_customer_id", storefrontCustomerId);
      } else if (normPhone) {
        q = q.eq("customer_phone", order.customer_phone);
      } else {
        q = q.eq("id", "00000000-0000-0000-0000-000000000000");
      }
      const { count } = await q;
      priorOrderCount = count || 0;
    } catch { /* non-fatal */ }

    // Sanitize attribution snapshot — only keep known keys, cap length.
    const ATTR_KEYS = new Set([
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "fbclid", "gclid", "ttclid", "wbraid", "gbraid", "msclkid",
      "referrer", "landing_path",
    ]);
    let attributionClean: Record<string, string> | null = null;
    if (attribution && typeof attribution === "object") {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(attribution)) {
        if (ATTR_KEYS.has(k) && typeof v === "string" && v) {
          out[k] = v.slice(0, 200);
        }
      }
      if (Object.keys(out).length) attributionClean = out;
    }

    const { data: createdOrder, error: orderErr } = await supabase
      .from("orders")
      .insert({
        store_id,
        total: Number(order.total),
        currency: order.currency,
        status: order.status,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        street_address: order.street_address,
        city: order.city,
        state: order.state,
        pincode: order.pincode,
        payment_method: order.payment_method,
        notes: order.notes,
        storefront_customer_id: storefrontCustomerId,
        payment_type: isPartial ? "partial" : "full",
        advance_paid: advancePaid,
        balance_due: balanceDue,
        checkout_token: checkout_token || null,
        buyer_ip: buyerIp,
        buyer_user_agent: buyerUa,
        buyer_fbc: buyerFbc,
        buyer_fbp: buyerFbp,
        meta_event_id: metaEventId,
        meta_event_source_url: metaEventSourceUrl,
        visitor_id: visitor_id || null,
        session_id: session_id || null,
        customer_order_index: priorOrderCount + 1,
        is_repeat_customer: priorOrderCount > 0,
        attribution: attributionClean,
      })
      .select("id")
      .single();


    if (orderErr || !createdOrder) {
      // Idempotency race: shopper double-tapped Place Order (or the browser
      // retried a slow response) — both requests passed the earlier
      // checkout_token SELECT, one won the INSERT, the other hit the unique
      // index (store_id, checkout_token). Return the winning order instead
      // of a 500 so the shopper doesn't see "order failed" for an order
      // that is actually in the merchant's dashboard.
      if ((orderErr as any)?.code === "23505" && checkout_token) {
        const { data: raced } = await supabase
          .from("orders")
          .select("id, order_number")
          .eq("store_id", store_id)
          .eq("checkout_token", checkout_token)
          .maybeSingle();
        if (raced) {
          const racedNumber = raced.order_number
            ? `#${1000 + raced.order_number}`
            : `#${raced.id.slice(0, 8).toUpperCase()}`;
          return new Response(
            JSON.stringify({ success: true, order_id: raced.id, order_number: racedNumber, profit: null }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
      throw orderErr ?? new Error("Failed to create order");
    }


    const orderItems = items.map((item) => ({
      order_id: createdOrder.id,
      product_id: item.productId,
      product_name: item.name,
      quantity: Number(item.quantity),
      unit_price: Number(item.price),
      total: Number(item.price) * Number(item.quantity),
      image_url: canonicalImage.get(item.productId) ?? (item as any).image ?? null,
    }));

    const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
    if (itemsErr) throw itemsErr;

    // Calculate profit margin for Meta CAPI optimization
    let totalProfit: number | null = null;
    const defaultMargin = store.default_profit_margin ?? 30;
    const profitProductIds = items.map((i) => i.productId).filter(Boolean);
    if (profitProductIds.length > 0) {
      const { data: productsData } = await supabase
        .from("products")
        .select("id, cost_price")
        .in("id", profitProductIds);

      totalProfit = 0;
      for (const item of items) {
        const prod = productsData?.find((p: any) => p.id === item.productId);
        if (prod?.cost_price !== null && prod?.cost_price !== undefined) {
          // Use actual cost price
          totalProfit += (Number(item.price) - Number(prod.cost_price)) * Number(item.quantity);
        } else {
          // Fallback: use store's default profit margin %
          totalProfit += Number(item.price) * (defaultMargin / 100) * Number(item.quantity);
        }
      }
    } else {
      // No product IDs — use default margin on total
      totalProfit = Number(order.total) * (defaultMargin / 100);
    }

    // Parallelize independent post-insert operations
    const postInsertOps: Promise<any>[] = [];

    if (lead) {
      postInsertOps.push(
        supabase.from("customer_leads").insert({
          store_id,
          name: lead.name,
          phone: lead.phone,
          product_name: lead.product_name,
          product_id: lead.product_id,
          source: lead.source,
        })
      );
    }

    // Coupon usage was already atomically incremented above via claim_coupon RPC.


    // Only mark the cart as recovered when the order is ACTUALLY placed
    // (COD → status="confirmed"). For online payments the order starts as
    // "pending" and only becomes confirmed after the payment-verify webhook.
    // If we mark recovered here for online orders, a failed/cancelled payment
    // leaves the cart flagged as recovered forever and the recovery cron
    // skips it — customer never gets their abandoned-cart WhatsApp.
    if (abandoned_cart_id && order.status === "confirmed") {
      postInsertOps.push(
        supabase
          .from("abandoned_carts")
          .update({ recovered: true })
          .eq("id", abandoned_cart_id)
      );
    }

    // Fetch order_number in parallel with other ops
    const orderNumberPromise = supabase
      .from("orders")
      .select("order_number")
      .eq("id", createdOrder.id)
      .single();

    postInsertOps.push(orderNumberPromise);

    const results = await Promise.all(postInsertOps);

    // Extract order_number from the last result
    const orderNumberResult = results[results.length - 1];
    const orderRow = orderNumberResult?.data;
    const orderNumber = orderRow?.order_number
      ? `#${1000 + orderRow.order_number}`
      : `#${createdOrder.id.slice(0, 8).toUpperCase()}`;

    // For COD orders the order is "complete" the moment it's placed — fire Purchase CAPI
    // server-to-server now (matches Shopify default behaviour). Razorpay/Cashfree orders
    // get their Purchase fired from the verify/webhook step instead.
    // ⚠️ Skip Meta CAPI for manual / admin-created orders (no browser session signals).
    // Sending those tanks Event Match Quality and adds noise without attribution value.
    const isStorefrontOrder = !!buyerUa && !!(buyerFbp || buyerFbc || metaEventId);
    if (order.payment_method === "cod" && isStorefrontOrder) {
      await firePurchaseCapi(supabase, createdOrder.id, {
        source: "cod",
        eventSourceUrl: metaEventSourceUrl || undefined,
      });
    }

    return new Response(JSON.stringify({ success: true, order_id: createdOrder.id, order_number: orderNumber, profit: totalProfit }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("place-order error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Failed to place order" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
