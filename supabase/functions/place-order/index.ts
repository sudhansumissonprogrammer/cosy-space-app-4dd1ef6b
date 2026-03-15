import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    const {
      store_id,
      order,
      items,
      lead,
      coupon_id,
      abandoned_cart_id,
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
      .select("id, is_suspended")
      .eq("id", store_id)
      .single();

    if (storeErr || !store || store.is_suspended) {
      return new Response(JSON.stringify({ error: "Store is not accepting orders" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    if (lead) {
      await supabase.from("customer_leads").insert({
        store_id,
        name: lead.name,
        phone: lead.phone,
        product_name: lead.product_name,
        product_id: lead.product_id,
        source: lead.source,
      });
    }

    if (coupon_id) {
      const { data: coupon } = await supabase
        .from("coupons")
        .select("used_count")
        .eq("id", coupon_id)
        .maybeSingle();

      if (coupon) {
        await supabase
          .from("coupons")
          .update({ used_count: (coupon.used_count || 0) + 1 })
          .eq("id", coupon_id);
      }
    }

    if (abandoned_cart_id) {
      await supabase
        .from("abandoned_carts")
        .update({ recovered: true })
        .eq("id", abandoned_cart_id);
    }

    // Fetch the auto-generated order_number
    const { data: orderRow } = await supabase
      .from("orders")
      .select("order_number")
      .eq("id", createdOrder.id)
      .single();

    const orderNumber = orderRow?.order_number
      ? `#${1000 + orderRow.order_number}`
      : `#${createdOrder.id.slice(0, 8).toUpperCase()}`;

    return new Response(JSON.stringify({ success: true, order_id: createdOrder.id, order_number: orderNumber }), {
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
