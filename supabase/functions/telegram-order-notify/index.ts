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

const ONLINE_GATEWAYS = new Set([
  "cashfree", "razorpay", "payu", "phonepe", "paytm", "upi",
  "stripe", "online", "prepaid", "card", "netbanking", "wallet",
]);

function isCod(method?: string | null): boolean {
  const m = String(method || "").trim().toLowerCase();
  if (!m) return true;
  if (ONLINE_GATEWAYS.has(m)) return false;
  return /\bcod\b|cash[\s_-]*on[\s_-]*delivery|^cash$/.test(m);
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
        "id, store_id, order_number, status, payment_status, payment_method, payment_type, advance_paid, balance_due, total, currency, customer_name, customer_phone, street_address, city, state, pincode, notes, created_at",
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
        .select("product_name, quantity, unit_price, total, image_url, products(image_url)")
        .eq("order_id", order.id),
      admin.from("stores").select("name, slug, owner_name").eq("id", order.store_id).maybeSingle(),
    ]);

    const list = (items || []) as any[];
    const r = (v: unknown) => Math.round(Number(v || 0));

    // Money: COD 1750-100=1650 (advance subtracted when partly paid)
    const total = r(order.total);
    const isPartial = String((order as any).payment_type || "") === "partial";
    const paidOnline = !isCod(order.payment_method)
      ? total
      : isPartial
        ? r((order as any).advance_paid)
        : 0;
    const due = Math.max(0, total - paidOnline);

    const lines: string[] = [];
    lines.push(esc(order.customer_name || "Guest"));
    lines.push("");
    if (order.customer_phone) {
      lines.push(esc(order.customer_phone));
      lines.push("");
    }
    String(order.street_address || "")
      .split(/\s*,\s*/)
      .map((p) => p.trim())
      .filter(Boolean)
      .forEach((p) => lines.push(esc(p)));
    if (order.city) lines.push(esc(String(order.city).trim()));
    if (order.state) lines.push(esc(String(order.state).trim()));
    if (order.pincode) lines.push(esc(String(order.pincode).trim()));

    lines.push("");
    if (due > 0) {
      lines.push(`<b>COD ${paidOnline > 0 ? `${total}-${paidOnline}=${due}` : due}</b>`);
    } else {
      lines.push(`<b>COD 0 — fully prepaid (${total} paid)</b>`);
    }

    const from = store?.owner_name || store?.name;
    if (from) {
      lines.push("");
      lines.push(`From ${esc(from)}`);
    }

    if (list.length) {
      lines.push("");
      for (const it of list) {
        const qty = Number(it.quantity || 1);
        lines.push(`${esc(it.product_name)}${qty > 1 ? ` × ${qty}` : ""}`);
      }
    }

    const text = lines.join("\n");
    const photos = list
      .map((it) => it.image_url || it.products?.image_url)
      .filter((u: unknown): u is string => typeof u === "string" && /^https?:\/\//.test(u))
      .slice(0, 10);

    const call = async (method: string, payload: Record<string, unknown>) => {
      const res = await fetch(`${GATEWAY_URL}/${method}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": TELEGRAM_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ chat_id: cfg.chat_id, ...payload }),
      });
      const bodyText = await res.text();
      let parsed: any = null;
      try { parsed = JSON.parse(bodyText); } catch { /* non-JSON */ }
      return { ok: res.ok && parsed?.ok !== false, status: res.status, bodyText };
    };

    // Photos on top, order details as the caption of the first photo.
    let sent = { ok: false, status: 0, bodyText: "" };
    if (photos.length === 1) {
      sent = await call("sendPhoto", { photo: photos[0], caption: text, parse_mode: "HTML" });
    } else if (photos.length > 1) {
      sent = await call("sendMediaGroup", {
        media: photos.map((p, i) => ({
          type: "photo",
          media: p,
          ...(i === 0 ? { caption: text, parse_mode: "HTML" } : {}),
        })),
      });
    }
    // No images, or Telegram rejected the media — always deliver the text.
    if (!sent.ok) {
      if (photos.length) console.error(`telegram media failed [${sent.status}]: ${sent.bodyText}`);
      sent = await call("sendMessage", { text, parse_mode: "HTML", disable_web_page_preview: true });
    }

    if (!sent.ok) {
      console.error(`telegram send failed [${sent.status}]: ${sent.bodyText}`);
      return json({ error: "telegram_failed", status: sent.status, details: sent.bodyText }, 502);
    }

    return json({ success: true, photos: photos.length });
  } catch (err) {
    console.error("telegram-order-notify error:", (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});
