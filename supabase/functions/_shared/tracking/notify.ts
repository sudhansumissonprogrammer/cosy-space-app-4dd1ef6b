// Notification dispatcher for shipment status changes.
// Duplicate-safe: the caller only invokes this for statuses NOT already in
// order_shipments.notified_statuses, and wa_send_queue has a unique index on
// (order_id, message_type) for order_shipped.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Statuses worth interrupting a customer for. */
export const NOTIFY_STATUSES = ["shipped", "out_for_delivery", "delivered", "exception"];

const WA_EVENT_BY_STATUS: Record<string, string> = {
  shipped: "order_shipped",
  delivered: "order_delivered",
};

export async function dispatchShipmentNotification(opts: {
  admin: any;
  orderId: string;
  storeId: string;
  status: string;
  courierName?: string | null;
  awb?: string | null;
  location?: string | null;
}) {
  const { admin, orderId, storeId, status } = opts;
  const results: Record<string, string> = {};

  // 1. WhatsApp — reuse the existing platform pipeline (templates + queue).
  const waEvent = WA_EVENT_BY_STATUS[status];
  if (waEvent) {
    try {
      const { data: secretRow } = await admin
        .from("cron_auth").select("secret").eq("id", true).maybeSingle();
      const r = await fetch(`${SUPABASE_URL}/functions/v1/wa-order-event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": secretRow?.secret ?? "",
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ event: waEvent, order_id: orderId }),
      });
      results.whatsapp = r.ok ? "queued" : `http_${r.status}`;
    } catch (e) {
      results.whatsapp = `error:${(e as Error).message}`;
    }
  }

  // 2. Merchant push (owner app) — best effort.
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-owner-push`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({
        store_id: storeId,
        title: `Shipment ${status.replace(/_/g, " ")}`,
        body: `${opts.courierName ?? "Courier"} ${opts.awb ?? ""} — ${opts.location ?? status}`,
        url: `/dashboard`,
      }),
    });
    results.push = "sent";
  } catch { results.push = "skipped"; }

  // 3. Email + SMS: no transactional shipment templates / SMS provider are
  // wired yet. Left as explicit no-ops so adding one later is a single call.
  results.email = "not_configured";
  results.sms = "not_configured";

  return results;
}
