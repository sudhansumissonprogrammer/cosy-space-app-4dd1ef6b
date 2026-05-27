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
  name: string;
  price: number;
  quantity: number;
};

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
        payment_method: "cod" | "razorpay";
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
      .select("id, is_suspended, default_profit_margin")
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
    if (productIds.length !== items.length || productIds.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid cart items" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: dbProducts, error: prodErr } = await supabase
      .from("products")
      .select("id, price, sale_price, is_active, store_id")
      .in("id", productIds);
    if (prodErr || !dbProducts || dbProducts.length !== productIds.length) {
      return new Response(JSON.stringify({ error: "One or more products not found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const canonicalPrice = new Map<string, number>();
    for (const p of dbProducts) {
      if (p.store_id !== store_id || !p.is_active) {
        return new Response(JSON.stringify({ error: "Product unavailable" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const cp = p.sale_price != null ? Number(p.sale_price) : Number(p.price);
      if (!(cp >= 0)) {
        return new Response(JSON.stringify({ error: "Invalid product price" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      canonicalPrice.set(p.id, cp);
    }
    // Override every line-item price with the DB canonical price.
    let serverSubtotal = 0;
    for (const item of items) {
      const cp = canonicalPrice.get(item.productId)!;
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

    const serverTotal = Math.max(0, Math.round((serverSubtotal - serverDiscount + serverShipping) * 100) / 100);
    // Replace client-supplied total + coupon_id with server-verified values.
    order.total = serverTotal;
    coupon_id = validCouponId;

    // Hardcode initial order status. Never trust the client.
    const safeStatus = order.payment_method === "cod" ? "confirmed" : "pending";
    order.status = safeStatus;
    // ────────────────────────────────────────────────────────────────

    // Server-side partial payment calculation (store-level)
    const isPartial = order.payment_type === "partial";
    let advancePaid = 0;
    let balanceDue = 0;

    if (isPartial) {
      // Read partial payment config from store
      const { data: storeData } = await supabase
        .from("stores")
        .select("partial_payment_enabled, partial_payment_type, partial_payment_value")
        .eq("id", store_id)
        .single();

      if (storeData?.partial_payment_enabled && storeData?.partial_payment_value) {
        let totalAdvance = 0;
        for (const item of items) {
          const itemPrice = Number(item.price);
          let itemAdv: number;
          if (storeData.partial_payment_type === "percentage") {
            itemAdv = Math.round(itemPrice * (Number(storeData.partial_payment_value) / 100));
          } else {
            itemAdv = Math.min(Number(storeData.partial_payment_value), itemPrice);
          }
          itemAdv = Math.max(itemAdv, 50);
          totalAdvance += itemAdv * Number(item.quantity);
        }
        advancePaid = Math.max(50, Math.round(totalAdvance));
        balanceDue = Math.max(0, Number(order.total) - advancePaid);
      }
    }

    // Capture real buyer signals for Meta CAPI (forwarded by Cloudflare/Vercel/SB edge).
    // We store these on the order row so the Purchase event sent to Meta carries the
    // visitor's real IP + UA — never the edge runtime's datacenter IP.
    const buyerIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      null;
    const buyerUa = req.headers.get("user-agent") || null;

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
        buyer_fbc: meta?.fbc || null,
        buyer_fbp: meta?.fbp || null,
        meta_event_id: meta?.event_id || null,
        meta_event_source_url: meta?.event_source_url || null,
        visitor_id: visitor_id || null,
        session_id: session_id || null,
      })
      .select("id")
      .single();

    if (orderErr || !createdOrder) {
      throw orderErr ?? new Error("Failed to create order");
    }


    const orderItems = items.map((item) => ({
      order_id: createdOrder.id,
      product_id: item.productId,
      product_name: item.name,
      quantity: Number(item.quantity),
      unit_price: Number(item.price),
      total: Number(item.price) * Number(item.quantity),
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

    if (coupon_id) {
      postInsertOps.push(
        supabase
          .from("coupons")
          .select("used_count")
          .eq("id", coupon_id)
          .maybeSingle()
          .then(({ data: coupon }) => {
            if (coupon) {
              return supabase
                .from("coupons")
                .update({ used_count: (coupon.used_count || 0) + 1 })
                .eq("id", coupon_id);
            }
          })
      );
    }

    if (abandoned_cart_id) {
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
    const isStorefrontOrder = !!(meta?.fbp || meta?.fbc || meta?.event_id);
    if (order.payment_method === "cod" && isStorefrontOrder) {
      void firePurchaseCapi(supabase, createdOrder.id, {
        source: "cod",
        eventSourceUrl: meta?.event_source_url,
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
