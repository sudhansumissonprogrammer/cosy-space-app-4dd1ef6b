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
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    const auth = req.headers.get("Authorization") || "";
    const cronHeader = req.headers.get("x-cron-secret") || "";
    let allowed = auth === `Bearer ${serviceKey}`;
    if (!allowed && cronHeader) {
      const { data: cron } = await admin.from("cron_auth").select("secret").limit(1).maybeSingle();
      allowed = !!cron?.secret && cron.secret === cronHeader;
    }
    if (!allowed) return json({ error: "unauthorized" }, 401);

    const { order_id } = await req.json().catch(() => ({}));
    if (!order_id || typeof order_id !== "string") return json({ error: "order_id required" }, 400);

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select(
        "id, store_id, order_number, status, payment_method, payment_type, payment_verified, advance_paid, balance_due, total, currency, customer_name, customer_phone, street_address, city, state, pincode, created_at",
      )
      .eq("id", order_id)
      .maybeSingle();
    if (orderErr) throw orderErr;
    if (!order) return json({ skipped: "order_not_found" });

    // Paid orders only: partially paid (advance received) or fully paid.
    const verified = (order as any).payment_verified === true;
    const status = String(order.status || "").toLowerCase();
    if (!verified) return json({ skipped: "not_paid" });
    if (status === "cancelled" || status === "refunded") return json({ skipped: status });

    const { data: cfg } = await admin
      .from("store_telegram_config")
      .select("chat_id, chat_ids, is_active")
      .eq("store_id", order.store_id)
      .maybeSingle();
    const chatIds = [
      ...new Set(
        ([...(cfg?.chat_ids || []), cfg?.chat_id] as (string | null | undefined)[])
          .map((c) => String(c || "").trim())
          .filter(Boolean),
      ),
    ];
    if (!cfg?.is_active || chatIds.length === 0) return json({ skipped: "not_configured" });

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
      ? (isPartial ? r((order as any).advance_paid) : total)
      : isPartial
        ? r((order as any).advance_paid)
        : 0;
    const due = Math.max(0, total - paidOnline);

    // Compact block — one detail per line, no blank lines.
    const lines: string[] = [];
    lines.push(esc(order.customer_name || "Guest"));
    if (order.customer_phone) lines.push(esc(order.customer_phone));
    String(order.street_address || "")
      .split(/\s*,\s*/)
      .map((p) => p.trim())
      .filter(Boolean)
      .forEach((p) => lines.push(esc(p)));
    if (order.city) lines.push(esc(String(order.city).trim()));
    if (order.state) lines.push(esc(String(order.state).trim()));
    if (order.pincode) lines.push(esc(String(order.pincode).trim()));

    if (due > 0) {
      lines.push(`<b>COD ${paidOnline > 0 ? `${total}-${paidOnline}=${due}` : due}</b>`);
    } else {
      lines.push(`<b>Fully paid ${total}</b>`);
    }

    const from = store?.owner_name || store?.name;
    if (from) lines.push(`From ${esc(from)}`);

    for (const it of list) {
      const qty = Number(it.quantity || 1);
      lines.push(`${esc(it.product_name)}${qty > 1 ? ` x ${qty}` : ""}`);
    }

    const text = lines.join("\n");

    const photos = [
      ...new Set(
        list
          .map((it) => it.image_url || it.products?.image_url)
          .filter((u: unknown): u is string => typeof u === "string" && /^https?:\/\//.test(u)),
      ),
    ].slice(0, 30);


    const call = async (method: string, payload: Record<string, unknown>, chatId: string) => {
      const res = await fetch(`${GATEWAY_URL}/${method}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": TELEGRAM_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ chat_id: chatId, ...payload }),
      });
      const bodyText = await res.text();
      let parsed: any = null;
      try { parsed = JSON.parse(bodyText); } catch { /* non-JSON */ }
      return { ok: res.ok && parsed?.ok !== false, status: res.status, bodyText };
    };

    // Telegram limits: media caption 1024 chars, album 2-10 items, message 4096 chars.
    const captionFits = text.length <= 1024;
    const textChunks: string[] = [];
    {
      let buf = "";
      for (const line of text.split("\n")) {
        if ((buf + line + "\n").length > 3800) { textChunks.push(buf); buf = ""; }
        buf += line + "\n";
      }
      if (buf.trim()) textChunks.push(buf);
    }

    // Send to every configured group/chat. A failure in one group never blocks the others.
    const results: { chat_id: string; ok: boolean; status: number }[] = [];
    for (const chatId of chatIds) {
      // Photos on top, order details as the caption of the first photo (when it fits).
      let mediaOk = false;
      let sent = { ok: false, status: 0, bodyText: "" };
      const cap = captionFits ? { caption: text, parse_mode: "HTML" } : {};
      for (let i = 0; i < photos.length; i += 10) {
        const batch = photos.slice(i, i + 10);
        const withCap = i === 0 ? cap : {};
        const r = batch.length === 1
          ? await call("sendPhoto", { photo: batch[0], ...withCap }, chatId)
          : await call("sendMediaGroup", {
              media: batch.map((p, j) => ({ type: "photo", media: p, ...(j === 0 ? withCap : {}) })),
            }, chatId);
        if (!r.ok) console.error(`telegram media failed [${r.status}] chat ${chatId}: ${r.bodyText}`);
        if (i === 0) mediaOk = r.ok;
        sent = r;
      }
      // No images, caption too long, or Telegram rejected the media — always deliver the text.
      if (!mediaOk || !captionFits) {
        for (const chunk of textChunks) {
          sent = await call("sendMessage", { text: chunk, parse_mode: "HTML", disable_web_page_preview: true }, chatId);
        }
      }
      if (!sent.ok) {
        console.error(`telegram send failed [${sent.status}] chat ${chatId}: ${sent.bodyText}`);
      }
      results.push({ chat_id: chatId, ok: sent.ok, status: sent.status });
    }

    if (!results.some((r) => r.ok)) {
      return json({ error: "telegram_failed", results }, 502);
    }

    return json({ success: true, photos: photos.length, results });
  } catch (err) {
    console.error("telegram-order-notify error:", (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});
