import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sendEmail(to: string, subject: string, html: string) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY not configured");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Orders <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Resend error for ${to}:`, err);
  } else {
    console.log(`Email sent to ${to}`);
  }
}

function formatCurrency(amount: number, currency: string) {
  return `${currency} ${Number(amount).toFixed(2)}`;
}

function buildCustomerEmailHtml(order: any, items: any[], storeName: string) {
  const itemRows = items
    .map(
      (i: any) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #eee">${i.product_name}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(i.total, order.currency)}</td></tr>`
    )
    .join("");

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#fff;padding:24px">
      <h2 style="color:#333;margin-bottom:4px">Order Confirmation</h2>
      <p style="color:#666;margin-top:0">Thank you for your order from <strong>${storeName}</strong>!</p>
      <p style="color:#666">Order ID: <strong>${order.id.slice(0, 8).toUpperCase()}</strong></p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <thead><tr style="background:#f5f5f5"><th style="padding:8px;text-align:left">Product</th><th style="padding:8px;text-align:center">Qty</th><th style="padding:8px;text-align:right">Total</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <p style="font-size:18px;font-weight:bold;text-align:right;color:#333">Total: ${formatCurrency(order.total, order.currency)}</p>
      <p style="color:#666">Payment: ${order.payment_method === "cod" ? "Cash on Delivery" : "Online Payment"}</p>
      ${order.street_address ? `<p style="color:#666">Delivery: ${[order.street_address, order.city, order.state, order.pincode].filter(Boolean).join(", ")}</p>` : ""}
      <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>
      <p style="color:#999;font-size:12px">This email was sent by ${storeName}.</p>
    </div>`;
}

function buildOwnerEmailHtml(order: any, items: any[], storeName: string, customerEmail: string) {
  const itemRows = items
    .map(
      (i: any) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #eee">${i.product_name}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(i.total, order.currency)}</td></tr>`
    )
    .join("");

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#fff;padding:24px">
      <h2 style="color:#333;margin-bottom:4px">🛍️ New Order Received!</h2>
      <p style="color:#666;margin-top:0">You have a new order on <strong>${storeName}</strong>.</p>
      <p style="color:#666">Order ID: <strong>${order.id.slice(0, 8).toUpperCase()}</strong></p>
      <h3 style="color:#333;margin-bottom:8px">Customer Details</h3>
      <p style="color:#666;margin:4px 0">Name: ${order.customer_name || "N/A"}</p>
      <p style="color:#666;margin:4px 0">Phone: ${order.customer_phone || "N/A"}</p>
      <p style="color:#666;margin:4px 0">Email: ${customerEmail || "N/A"}</p>
      ${order.street_address ? `<p style="color:#666;margin:4px 0">Address: ${[order.street_address, order.city, order.state, order.pincode].filter(Boolean).join(", ")}</p>` : ""}
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <thead><tr style="background:#f5f5f5"><th style="padding:8px;text-align:left">Product</th><th style="padding:8px;text-align:center">Qty</th><th style="padding:8px;text-align:right">Total</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <p style="font-size:18px;font-weight:bold;text-align:right;color:#333">Total: ${formatCurrency(order.total, order.currency)}</p>
      <p style="color:#666">Payment: ${order.payment_method === "cod" ? "Cash on Delivery" : "Online Payment"}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>
      <p style="color:#999;font-size:12px">This is an automated notification from your store.</p>
    </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id, customer_email } = await req.json();
    if (!order_id) {
      return new Response(JSON.stringify({ error: "order_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get order details with store info
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*, stores:store_id(name, owner_id, owner_email)")
      .eq("id", order_id)
      .single();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get order items
    const { data: orderItems } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", order_id);

    const items = orderItems || [];
    const storeData = (order as any).stores;
    const storeName = storeData?.name || "Store";
    const ownerEmail = storeData?.owner_email;

    // Send customer confirmation email
    if (customer_email) {
      await sendEmail(
        customer_email,
        `Order Confirmed - ${storeName}`,
        buildCustomerEmailHtml(order, items, storeName)
      );
    }

    // Send owner notification email
    if (ownerEmail) {
      await sendEmail(
        ownerEmail,
        `🛍️ New Order #${order_id.slice(0, 8).toUpperCase()} - ${storeName}`,
        buildOwnerEmailHtml(order, items, storeName, customer_email || "")
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
