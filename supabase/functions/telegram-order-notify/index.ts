// Sends a new-order alert to a store's Telegram group/chat.
// Internal-only: called from place-order with the service-role key.
// Per-store opt-in via public.store_telegram_config (chat_id + is_active).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function money(v: unknown, cur = "₹"): string {
  return `${cur}${Math.round(Number(v || 0))}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("Authorization") || "";
    if (auth !== `Bearer ${serviceKey}`) return json({ error: "unauthorized" }, 401);

    const { order_id } = await req.json().catch(() => ({}));
    if (!order_id || typeof order_id !== "string") return json({ error: "order_id required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select(
        "id, store_id, order_number, status, payment_status, payment_method, total, currency, customer_name, customer_phone, street_address, city, state, pincode, notes, created_at",
      )
      .eq("id", order_id)
      .maybeSingle();
    if (orderErr) throw orderErr;
    if (!order) return json({ skipped: "order_not_found" });

    const { data: cfg } = await admin
      .from("store_telegram_config")
      .select("chat_id, is_active")
      .eq("store_id", order.store_id)
      .maybeSingle();
    if (!cfg?.is_active || !cfg?.chat_id) return json({ skipped: "not_configured" });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
    if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY) return json({ error: "telegram_not_connected" }, 500);

    const [{ data: items }, { data: store }] = await Promise.all([
      admin
        .from("order_items")
        .select("product_name, quantity, unit_price, total")
        .eq("order_id", order.id),
      admin.from("stores").select("name, slug").eq("id", order.store_id).maybeSingle(),
    ]);

    const cur = order.currency === "INR" || !order.currency ? "₹" : `${order.currency} `;
    const num = order.order_number
      ? `#${1000 + Number(order.order_number)}`
      : `#${String(order.id).slice(0, 8).toUpperCase()}`;

    const lines: string[] = [];
    lines.push(`🛍️ <b>New order ${esc(num)}</b> — ${esc(store?.name || "Store")}`);
    lines.push("");
    for (const it of items || []) {
      lines.push(
        `• ${esc(it.product_name)} × ${Number(it.quantity || 1)} — ${money(it.total ?? Number(it.unit_price || 0) * Number(it.quantity || 1), cur)}`,
      );
    }
    lines.push("");
    lines.push(`💰 <b>Total: ${money(order.total, cur)}</b>`);
    const pay = String(order.payment_method || "").toUpperCase() || "—";
    lines.push(`💳 Payment: ${esc(pay)} (${esc(order.payment_status || order.status || "pending")})`);
    lines.push("");
    lines.push(`👤 ${esc(order.customer_name || "Guest")}`);
    if (order.customer_phone) lines.push(`📞 ${esc(order.customer_phone)}`);
    const address = [order.street_address, order.city, order.state, order.pincode]
      .filter(Boolean)
      .join(", ");
    if (address) lines.push(`📍 ${esc(address)}`);
    if (order.notes) lines.push(`📝 ${esc(order.notes)}`);

    const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TELEGRAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: cfg.chat_id,
        text: lines.join("\n"),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const bodyText = await res.text();
    if (!res.ok) {
      console.error(`telegram sendMessage failed [${res.status}]: ${bodyText}`);
      return json({ error: "telegram_failed", status: res.status, details: bodyText }, res.status);
    }
    const parsed = JSON.parse(bodyText);
    if (parsed?.ok === false) {
      console.error("telegram sendMessage error:", bodyText);
      return json({ error: "telegram_failed", details: parsed }, 502);
    }

    return json({ success: true });
  } catch (err) {
    console.error("telegram-order-notify error:", (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});
