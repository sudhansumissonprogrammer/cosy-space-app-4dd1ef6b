import { createClient } from "npm:@supabase/supabase-js@2";

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

    const {
      store_id,
      order,
      items,
      lead,
      coupon_id,
      abandoned_cart_id,
      checkout_token,
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
    const productIds = items.map((i) => i.productId).filter(Boolean);
    if (productIds.length > 0) {
      const { data: productsData } = await supabase
        .from("products")
        .select("id, cost_price")
        .in("id", productIds);

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
