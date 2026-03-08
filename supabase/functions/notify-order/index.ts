import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id } = await req.json();
    if (!order_id) {
      return new Response(JSON.stringify({ error: "order_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get order details
    const { data: order, error: orderErr } = await supabase
      .from("whatsapp_orders")
      .select("*, stores:store_id(name, owner_id)")
      .eq("id", order_id)
      .single();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get store owner's email
    const { data: userData } = await supabase.auth.admin.getUserById(
      (order as any).stores.owner_id
    );

    if (userData?.user?.email) {
      // Log the notification (we can't send actual emails without a provider,
      // but we store the notification for the dashboard)
      console.log(
        `[ORDER NOTIFICATION] New order for store "${(order as any).stores.name}":`,
        `Product: ${order.product_name}, Price: $${order.product_price},`,
        `Customer: ${order.customer_name || "Unknown"}, Phone: ${order.customer_phone || "N/A"},`,
        `Owner email: ${userData.user.email}`
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
