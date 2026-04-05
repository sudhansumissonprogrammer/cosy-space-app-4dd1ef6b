import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMAIL_SENDER_DOMAIN = "notify.shopbanao.in";

function getEmailFrom(storeName: string) {
  // Sanitize store name for email FROM field (remove special chars)
  const safeName = storeName.replace(/[<>"]/g, "").trim() || "Store";
  return `${safeName} <noreply@shopbanao.in>`;
}

function formatCurrency(amount: number, currency: string) {
  const sym = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency + " ";
  return `${sym}${Number(amount).toFixed(2)}`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  return `${day} ${month} ${year}, ${h}:${minutes} ${ampm}`;
}

function buildInvoiceHtml(order: any, items: any[], store: any, isOwner: boolean, customerEmail: string) {
  const storeName = store?.name || "Store";
  const currency = order.currency || store?.currency || "INR";
  const subtotal = items.reduce((sum: number, i: any) => sum + Number(i.total || 0), 0);
  const diff = Number(order.total) - subtotal;
  const logoUrl = store?.logo_url;
  const storeLocation = [store?.location, store?.city, store?.state].filter(Boolean).join(", ");

  const statusColors: Record<string, string> = {
    pending: "#f59e0b",
    confirmed: "#06b6d4",
    shipped: "#3b82f6",
    delivered: "#10b981",
    cancelled: "#ef4444",
  };
  const statusColor = statusColors[order.status] || "#6b7280";

  const itemRows = items.map((item: any, idx: number) => `
    <tr style="background:${idx % 2 === 1 ? '#f9fafb' : '#ffffff'}">
      <td style="padding:10px 12px;font-size:13px;color:#6b7280;border-bottom:1px solid #f3f4f6">${idx + 1}</td>
      <td style="padding:10px 12px;font-size:13px;font-weight:600;color:#191f2e;border-bottom:1px solid #f3f4f6">${item.product_name}</td>
      <td style="padding:10px 12px;font-size:13px;color:#6b7280;text-align:center;border-bottom:1px solid #f3f4f6">${item.quantity || 1}</td>
      <td style="padding:10px 12px;font-size:13px;color:#6b7280;text-align:right;font-variant-numeric:tabular-nums;border-bottom:1px solid #f3f4f6">${formatCurrency(Number(item.unit_price || item.total / (item.quantity || 1)), currency)}</td>
      <td style="padding:10px 12px;font-size:13px;font-weight:600;color:#191f2e;text-align:right;font-variant-numeric:tabular-nums;border-bottom:1px solid #f3f4f6">${formatCurrency(Number(item.total), currency)}</td>
    </tr>
  `).join("");

  const ownerCustomerSection = isOwner ? `
    <div style="margin-bottom:20px;padding:16px;background:#eff6ff;border-radius:8px;border-left:4px solid #3b82f6">
      <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#3b82f6;margin:0 0 8px">Customer Details</p>
      <p style="font-size:14px;font-weight:600;color:#191f2e;margin:0 0 4px">${order.customer_name || "N/A"}</p>
      <p style="font-size:13px;color:#6b7280;margin:0 0 2px">📞 ${order.customer_phone || "N/A"}</p>
      <p style="font-size:13px;color:#6b7280;margin:0 0 2px">📧 ${customerEmail || "N/A"}</p>
      ${order.street_address ? `<p style="font-size:13px;color:#6b7280;margin:0">📍 ${[order.street_address, order.city, order.state, order.pincode].filter(Boolean).join(", ")}</p>` : ""}
    </div>
  ` : "";

  const trackingSection = order.tracking_number ? `
    <div style="margin-top:16px;padding:12px 16px;background:#f0fdf4;border-radius:8px;border-left:4px solid #10b981">
      <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#10b981;margin:0 0 4px">Tracking Number</p>
      <p style="font-size:14px;font-family:'Courier New',monospace;color:#191f2e;margin:0">${order.tracking_number}</p>
      ${order.tracking_url ? `<a href="${order.tracking_url}" style="font-size:12px;color:#3b82f6;margin-top:4px;display:inline-block">Track your order →</a>` : ""}
    </div>
  ` : "";

  const deliverySection = !isOwner && order.street_address ? `
    <div style="margin-bottom:20px;padding:16px;background:#f9fafb;border-radius:8px">
      <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin:0 0 8px">Delivery Address</p>
      <p style="font-size:14px;font-weight:600;color:#191f2e;margin:0 0 4px">${order.customer_name || "Customer"}</p>
      <p style="font-size:13px;color:#6b7280;margin:0">${[order.street_address, order.city, order.state, order.pincode].filter(Boolean).join(", ")}</p>
    </div>
  ` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Inter','Segoe UI',sans-serif">
<div style="max-width:520px;margin:0 auto;padding:40px 16px">
  <!-- Card -->
  <div style="background:#ffffff;border-radius:8px;overflow:hidden">

    <!-- Header -->
    <div style="padding:28px 28px 20px;border-bottom:1px solid #e5e7eb">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle">
          ${logoUrl ? `<img src="${logoUrl}" alt="${storeName}" style="height:36px;width:auto;object-fit:contain" />` : `<span style="font-size:20px;font-weight:700;color:#1a1a1a;letter-spacing:-0.5px">${storeName}</span>`}
          ${storeLocation ? `<p style="font-size:11px;color:#9ca3af;margin:4px 0 0">${storeLocation}</p>` : ""}
        </td>
        <td style="vertical-align:middle;text-align:right">
          <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#1a1a1a;margin:0">Invoice</p>
          <p style="font-size:11px;color:#9ca3af;margin:4px 0 0">#${order.id.slice(0, 8).toUpperCase()}</p>
        </td>
      </tr></table>
    </div>

    <!-- Body -->
    <div style="padding:24px 28px">

      <!-- Title -->
      <h1 style="font-size:22px;font-weight:700;color:#191f2e;margin:0 0 8px">
        ${isOwner ? "🛍️ New Order Received!" : "Order Confirmed! 🎉"}
      </h1>
      <p style="font-size:14px;color:#6b7280;margin:0 0 20px;line-height:1.6">
        ${isOwner 
          ? `You have a new order on <strong>${storeName}</strong>.`
          : `Thank you for your order from <strong>${storeName}</strong>!`}
      </p>

      <!-- Order Meta -->
      <div style="display:flex;margin-bottom:20px">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:top">
            <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin:0 0 6px">Order Date</p>
            <p style="font-size:13px;color:#191f2e;margin:0">${formatDate(order.created_at)}</p>
          </td>
          <td style="vertical-align:top;text-align:center">
            <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin:0 0 6px">Payment</p>
            <p style="font-size:13px;font-weight:600;color:#191f2e;margin:0">${order.payment_method === "cod" ? "Cash on Delivery" : "Online"}</p>
          </td>
          <td style="vertical-align:top;text-align:right">
            <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin:0 0 6px">Status</p>
            <span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#fff;background:${statusColor}">${order.status}</span>
          </td>
        </tr></table>
      </div>

      ${ownerCustomerSection}
      ${deliverySection}

      <!-- Items Table -->
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
        <thead>
          <tr style="background:#1a1a1a">
            <th style="padding:10px 12px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#fff;text-align:left;width:30px">#</th>
            <th style="padding:10px 12px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#fff;text-align:left">Item</th>
            <th style="padding:10px 12px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#fff;text-align:center;width:50px">Qty</th>
            <th style="padding:10px 12px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#fff;text-align:right;width:80px">Price</th>
            <th style="padding:10px 12px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#fff;text-align:right;width:80px">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <!-- Totals -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">
        <tr>
          <td></td>
          <td style="width:200px">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:6px 12px;font-size:13px;color:#6b7280">Subtotal</td>
                <td style="padding:6px 12px;font-size:13px;color:#191f2e;text-align:right;font-variant-numeric:tabular-nums">${formatCurrency(subtotal, currency)}</td>
              </tr>
              ${diff !== 0 ? `
              <tr>
                <td style="padding:6px 12px;font-size:13px;color:#6b7280">${diff < 0 ? "Discount" : "Shipping/Tax"}</td>
                <td style="padding:6px 12px;font-size:13px;color:#191f2e;text-align:right;font-variant-numeric:tabular-nums">${formatCurrency(diff, currency)}</td>
              </tr>` : ""}
              <tr>
                <td style="padding:10px 12px;font-size:16px;font-weight:700;color:#191f2e;border-top:2px solid #1a1a1a">Total</td>
                <td style="padding:10px 12px;font-size:16px;font-weight:700;color:#191f2e;text-align:right;font-variant-numeric:tabular-nums;border-top:2px solid #1a1a1a">${formatCurrency(Number(order.total), currency)}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      ${trackingSection}
    </div>

    <!-- Footer -->
    <div style="padding:20px 28px;border-top:1px solid #e5e7eb;text-align:center">
      <p style="font-size:13px;font-weight:600;color:#191f2e;margin:0 0 4px">Thank you for shopping with ${storeName}!</p>
      <p style="font-size:11px;color:#9ca3af;margin:0">Computer generated invoice — no signature required</p>
    </div>

  </div>

  <!-- Sub-footer -->
  <p style="text-align:center;font-size:11px;color:#9ca3af;margin:16px 0 0">Powered by Storivo</p>
</div>
</body>
</html>`;
}

async function enqueueEmail(supabase: any, queueName: string, messageId: string, templateName: string, recipientEmail: string, subject: string, htmlBody: string, ttlMinutes: number, storeName: string) {
  const payload = {
    message_id: messageId,
    idempotency_key: messageId,
    label: templateName,
    to: recipientEmail,
    from: getEmailFrom(storeName),
    sender_domain: EMAIL_SENDER_DOMAIN,
    subject,
    html: htmlBody,
    text: subject,
    purpose: "transactional",
    queued_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.rpc("enqueue_email", {
    queue_name: queueName,
    payload: payload,
  });
  if (error) {
    console.error(`enqueue_email error for ${recipientEmail}:`, JSON.stringify(error));
    throw error;
  }
  console.log(`Email enqueued for ${recipientEmail}, msg_id: ${data}`);
  return data;
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

    // Normalize email to lowercase
    const normalizedEmail = customer_email?.trim().toLowerCase() || "";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get order with store info
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*, stores:store_id(name, owner_id, owner_email, logo_url, currency, location, city, state)")
      .eq("id", order_id)
      .single();

    if (orderErr || !order) {
      console.error("Order not found:", orderErr);
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
    const ownerEmail = storeData?.owner_email?.trim().toLowerCase() || "";
    
    console.log(`Store data: name=${storeName}, logo_url=${storeData?.logo_url || 'NONE'}, owner_email=${ownerEmail || 'NONE'}`);

    // Try queue first, fall back to direct Resend
    let queueWorked = false;

    // Send customer confirmation with invoice
    if (normalizedEmail) {
      const customerHtml = buildInvoiceHtml(order, items, storeData, false, normalizedEmail);
      const subject = `Order Confirmed - ${storeName} #${order_id.slice(0, 8).toUpperCase()}`;

      try {
        await enqueueEmail(supabase, "transactional_emails", `order-confirm-customer-${order_id}`, "order_confirmation", normalizedEmail, subject, customerHtml, 60, storeName);
        queueWorked = true;
      } catch {
        console.log("Queue unavailable for customer email, falling back to direct send");
        await sendEmailDirect(normalizedEmail, subject, customerHtml);
      }
    }

    // Send owner notification with invoice
    if (ownerEmail) {
      const ownerHtml = buildInvoiceHtml(order, items, storeData, true, normalizedEmail);
      const subject = `🛍️ New Order #${order_id.slice(0, 8).toUpperCase()} - ${storeName}`;

      try {
        await enqueueEmail(supabase, "transactional_emails", `order-confirm-owner-${order_id}`, "order_notification_owner", ownerEmail, subject, ownerHtml, 60, storeName);
      } catch {
        console.log("Queue unavailable for owner email, falling back to direct send");
        await sendEmailDirect(ownerEmail, subject, ownerHtml);
      }
    }

    console.log(`notify-order completed for ${order_id}, customer: ${normalizedEmail}, owner: ${ownerEmail}, queue: ${queueWorked}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-order error:", (err as Error).message);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Fallback: direct Resend send (legacy)
async function sendEmailDirect(to: string, subject: string, html: string) {
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
      from: getEmailFrom("Store"),
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Resend error for ${to}:`, err);
  } else {
    console.log(`Email sent directly to ${to}`);
  }
}
