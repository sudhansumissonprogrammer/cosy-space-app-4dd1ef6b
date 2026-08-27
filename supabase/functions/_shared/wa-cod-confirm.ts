// COD order-confirmation reply handling.
//
// Customers receive `cod_order_confirm_v1` (and, after 4h of silence,
// `cod_confirm_followup_v1`) with two quick-reply buttons:
//   ✅ Confirm Order   → order is tagged verified and released for dispatch
//   ✏️ Edit Address    → we ask for the corrected address in the 24h session
//
// This module is imported by whatsapp-webhook (inbound) only.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export type CodIntent = "confirm" | "edit" | null;

/** Classify a quick-reply button / free text into a COD intent. */
export function classifyCodReply(text: string): CodIntent {
  const t = String(text || "").toLowerCase().trim();
  if (!t) return null;
  if (/confirm|✅|haan|yes|ok|okay|ship it|dispatch|ha ji|thik/.test(t)) return "confirm";
  if (/edit|address|✏️|change address|correct|galat|wrong address/.test(t)) return "edit";
  return null;
}

async function sendSessionText(
  admin: any,
  cronSecret: string,
  storeId: string | null,
  phone: string,
  message: string,
) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/wa-platform-send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": cronSecret,
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify({
        mode: "text",
        store_id: storeId,
        recipient_phone: phone,
        message_type: "cod_confirm_reply",
        message_body: message,
      }),
    });
  } catch (e) {
    console.error("cod session reply failed:", (e as Error).message);
  }
}

/**
 * Resolve which order an inbound reply belongs to.
 * 1) Meta reply context → the exact template message we sent.
 * 2) Fallback: newest order for this phone still awaiting confirmation.
 */
async function resolveOrder(admin: any, phone: string, contextId: string | null) {
  if (contextId) {
    const { data: q } = await admin
      .from("wa_send_queue")
      .select("order_id")
      .eq("sent_message_id", contextId)
      .in("message_type", ["cod_confirmation", "cod_confirm_followup"])
      .maybeSingle();
    const oid = (q as any)?.order_id;
    if (oid) {
      const { data: o } = await admin
        .from("orders")
        .select("id, store_id, order_number, cod_confirm_status, status")
        .eq("id", oid)
        .maybeSingle();
      if (o) return o as any;
    }
  }

  const last10 = String(phone || "").replace(/\D/g, "").slice(-10);
  if (last10.length !== 10) return null;
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows } = await admin
    .from("orders")
    .select("id, store_id, order_number, cod_confirm_status, status")
    .ilike("customer_phone", `%${last10}`)
    .in("cod_confirm_status", ["awaiting", "edit_requested"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);
  return ((rows as any[]) || [])[0] || null;
}

/**
 * Handle one inbound message that may be a COD confirmation reply.
 * Returns true when the message was consumed as a COD action.
 */
export async function handleCodReply(
  admin: any,
  cronSecret: string,
  opts: { phone: string; text: string; contextId: string | null },
): Promise<boolean> {
  const order = await resolveOrder(admin, opts.phone, opts.contextId);
  if (!order) return false;

  const intent = classifyCodReply(opts.text);

  // Free-text sent right after "Edit Address" = the corrected address.
  if (!intent) {
    if (order.cod_confirm_status !== "edit_requested") return false;
    const addr = String(opts.text || "").trim().slice(0, 500);
    if (addr.length < 6) return false;
    await admin.from("orders").update({
      cod_confirm_reply: addr,
    } as any).eq("id", order.id);
    await admin.from("store_notifications").insert({
      store_id: order.store_id,
      type: "cod_address_update",
      message: `Address correction for order ${order.order_number || order.id}: ${addr}`,
    } as any).then(() => {}, () => {});
    await sendSessionText(
      admin, cronSecret, order.store_id, opts.phone,
      "Thank you 🙏 We have noted the corrected address and our team will verify it before dispatch.",
    );
    return true;
  }

  if (intent === "confirm") {
    await admin.from("orders").update({
      cod_confirm_status: "confirmed",
      cod_confirmed_at: new Date().toISOString(),
      cod_confirm_reply: opts.text.slice(0, 500),
    } as any).eq("id", order.id);
    await sendSessionText(
      admin, cronSecret, order.store_id, opts.phone,
      `✅ Thank you! Your order ${order.order_number || ""} is confirmed and moves to packing today. We'll share tracking as soon as it ships.`.replace("  ", " "),
    );
    return true;
  }

  // intent === "edit"
  await admin.from("orders").update({
    cod_confirm_status: "edit_requested",
    cod_confirm_reply: opts.text.slice(0, 500),
  } as any).eq("id", order.id);
  await admin.from("store_notifications").insert({
    store_id: order.store_id,
    type: "cod_address_edit",
    message: `Customer asked to edit the address / cancel order ${order.order_number || order.id}.`,
  } as any).then(() => {}, () => {});
  await sendSessionText(
    admin, cronSecret, order.store_id, opts.phone,
    "No problem ✏️ Please reply with your correct address — house/flat number, landmark, city and pincode. We'll hold the parcel until then. If you'd like to cancel instead, just reply CANCEL.",
  );
  return true;
}
