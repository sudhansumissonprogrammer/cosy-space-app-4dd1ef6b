// COD order-confirmation reply handling.
//
// Customers receive `cod_order_confirm_v3/v2` ("Order Confirmation Request")
// with two quick-reply buttons:
//   Confirm My Order   → step 2: address confirmation with Confirm Address /
//                        I Want To Change Address buttons
//   Cancel My Order    → cancellation request passed to the store
// Step 2 (status "address_pending"):
//   Confirm Address          → order verified, released for packing
//   I Want To Change Address → we ask for the corrected address in the session
//
// Speed: the customer is staring at the chat after tapping a button, so the
// reply is sent DIRECTLY to Meta from the webhook (no extra function hop),
// in parallel with the order update. Logging and store notifications run in
// the background afterwards.
//
// This module is imported by whatsapp-webhook (inbound) only.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export type CodIntent = "confirm" | "edit" | "cancel" | null;

export interface CodSendCtx {
  cronSecret: string;
  /** Platform WhatsApp number + token for direct sends (fast path). */
  phoneNumberId?: string | null;
  token?: string | null;
  /** Run non-critical work after the reply (EdgeRuntime.waitUntil). */
  background?: (p: Promise<unknown>) => void;
}

/**
 * Classify a quick-reply button / free text into a COD intent.
 *
 * Short words like "ok"/"yes"/"haan" are matched as WHOLE WORDS only —
 * a substring match turned everyday chat ("I want to b-ok-", "l-ook-s good")
 * into an order confirmation.
 */
export function classifyCodReply(text: string): CodIntent {
  const t = String(text || "").toLowerCase().trim().replace(/[.!,]+$/g, "");
  if (!t) return null;
  const word = (w: string) => new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`, "i").test(t);
  // Cancellation must win over everything else.
  if (word("cancel") || word("cancle") || /rad+ ?kar|nahi chahiye|nahin chahiye|don'?t want|do not want/.test(t)) return "cancel";
  // "I Want To Change Address" must not be read as a confirmation.
  if (/change address|wrong address|galat/.test(t)) return "edit";
  if (word("confirm") || word("confirmed") || t.includes("✅") || word("yes") || word("ok") || word("okay") || word("haan") || word("ha ji") || word("thik") || word("theek") || /ship it|dispatch/.test(t)) return "confirm";
  if (word("edit") || word("address") || t.includes("✏️") || word("correct")) return "edit";
  return null;
}

function runBg(ctx: CodSendCtx, p: Promise<unknown>) {
  const safe = p.catch((e) => console.error("cod background task failed:", (e as Error)?.message));
  if (ctx.background) ctx.background(safe);
}

/** Send a session reply. Direct-to-Meta when possible, else via wa-platform-send. */
async function sendReply(
  admin: any,
  ctx: CodSendCtx,
  order: any,
  phone: string,
  bodyText: string,
  buttons?: string[],
) {
  const to = String(phone || "").replace(/\D/g, "");
  if (ctx.phoneNumberId && ctx.token) {
    const payload = buttons?.length
      ? {
        messaging_product: "whatsapp", to, type: "interactive",
        interactive: {
          type: "button",
          body: { text: bodyText.slice(0, 1024) },
          action: { buttons: buttons.slice(0, 3).map((t, i) => ({ type: "reply", reply: { id: `btn_${i}`, title: t.slice(0, 20) } })) },
        },
      }
      : { messaging_product: "whatsapp", to, type: "text", text: { body: bodyText.slice(0, 4096) } };
    let metaId: string | null = null;
    let errMsg: string | null = null;
    try {
      const r = await fetch(`https://graph.facebook.com/v21.0/${ctx.phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${ctx.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });
      const j: any = await r.json().catch(() => ({}));
      if (r.ok) metaId = j?.messages?.[0]?.id ?? null;
      else errMsg = JSON.stringify(j?.error ?? j).slice(0, 1000);
    } catch (e) {
      errMsg = (e as Error).message;
    }
    if (metaId) {
      // Log in the background: inbox history + lets the next button tap find
      // this exact order via its reply context.
      runBg(ctx, admin.from("whatsapp_messages").insert({
        store_id: order.store_id ?? null,
        message_type: "cod_confirm_reply",
        recipient_phone: to,
        message_body: bodyText.slice(0, 4096),
        meta_message_id: metaId,
        status: "sent",
        order_id: order.id,
        direction: "outgoing",
        sent_via: "platform",
      }));
      return;
    }
    console.error("cod direct reply failed, falling back:", errMsg);
  }

  // Fallback: route through wa-platform-send (slower, but full guardrails).
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/wa-platform-send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": ctx.cronSecret,
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify(buttons?.length
        ? { mode: "interactive", store_id: order.store_id, recipient_phone: phone, message_type: "cod_confirm_reply", order_id: order.id, interactive: { body_text: bodyText, buttons } }
        : { mode: "text", store_id: order.store_id, recipient_phone: phone, message_type: "cod_confirm_reply", order_id: order.id, message_body: bodyText }),
    });
  } catch (e) {
    console.error("cod session reply failed:", (e as Error).message);
  }
}

const ORDER_COLS = "id, store_id, order_number, cod_confirm_status, status, customer_name, street_address, city, state, pincode, stores:store_id(name)";

/**
 * Resolve which order an inbound reply belongs to.
 * 1) Meta reply context → the exact message we sent (inbox log, then queue).
 * 2) Fallback: newest order for this phone still awaiting confirmation.
 */
async function resolveOrder(admin: any, phone: string, contextId: string | null) {
  if (contextId) {
    const { data: m } = await admin
      .from("whatsapp_messages")
      .select("order_id")
      .eq("meta_message_id", contextId)
      .not("order_id", "is", null)
      .maybeSingle();
    let oid = (m as any)?.order_id;
    if (!oid) {
      const { data: q } = await admin
        .from("wa_send_queue")
        .select("order_id")
        .eq("sent_message_id", contextId)
        .in("message_type", ["cod_confirmation", "cod_confirm_followup"])
        .maybeSingle();
      oid = (q as any)?.order_id;
    }
    if (oid) {
      const { data: o } = await admin.from("orders").select(ORDER_COLS).eq("id", oid).maybeSingle();
      if (o && (o as any).cod_confirm_status) return o as any;
    }
  }

  const last10 = String(phone || "").replace(/\D/g, "").slice(-10);
  if (last10.length !== 10) return null;
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows } = await admin
    .from("orders")
    .select(ORDER_COLS)
    .ilike("customer_phone", `%${last10}`)
    .in("cod_confirm_status", ["awaiting", "address_pending", "edit_requested"])
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
  ctx: CodSendCtx,
  opts: { phone: string; text: string; contextId: string | null },
): Promise<boolean> {
  const order = await resolveOrder(admin, opts.phone, opts.contextId);
  if (!order) return false;

  const intent = classifyCodReply(opts.text);
  const orderNum = order.order_number || "";
  const firstName = String(order.customer_name || "there").trim().split(/\s+/)[0] || "there";
  const updateOrder = (patch: Record<string, unknown>) =>
    admin.from("orders").update(patch as any).eq("id", order.id).then((r: any) => {
      if (r?.error) console.error("cod order update failed:", r.error.message);
    });

  // Free-text sent right after "Change Address" = the corrected address.
  if (!intent) {
    if (order.cod_confirm_status !== "edit_requested") return false;
    const addr = String(opts.text || "").trim().slice(0, 500);
    if (addr.length < 6) return false;
    const pinMatch = addr.match(/(?<!\d)([1-9]\d{5})(?!\d)/);
    const pincode = pinMatch ? pinMatch[1] : null;
    const street = pincode ? addr.replace(pinMatch![0], "").replace(/\s{2,}/g, " ").replace(/[\s,;-]+$/, "").trim() : addr;
    await Promise.all([
      updateOrder({
        street_address: street || addr,
        ...(pincode ? { pincode } : {}),
        cod_confirm_status: "address_pending",
        cod_confirm_reply: addr,
      }),
      sendReply(admin, ctx, order, opts.phone,
        `Thanks ${firstName} 🙏\n\nWe have updated your delivery address for order (ID: ${orderNum}):\n\n*New Delivery Address:*\n${addr}\n\nPlease confirm if this address is now correct.`,
        ["Confirm Address", "I Want To Change Address"]),
    ]);
    runBg(ctx, notifyStore(admin, order, "Address correction received", `Customer sent a corrected address for order ${orderNum || order.id}: ${addr}`));
    return true;
  }

  if (intent === "cancel") {
    // Record the request and alert the store — never change orders.status here.
    await Promise.all([
      updateOrder({ cod_confirm_status: "cancelled", cod_confirm_reply: opts.text.slice(0, 500) }),
      sendReply(admin, ctx, order, opts.phone,
        "Got it 🙏 We have passed your cancellation request to the store team. They will confirm shortly."),
    ]);
    runBg(ctx, notifyStore(admin, order, "Customer asked to cancel COD order",
      `Customer replied CANCEL on order ${orderNum || order.id}. Review and cancel it in Orders if you agree.`));
    return true;
  }

  if (intent === "confirm") {
    const storeName = (order.stores as any)?.name || "our store";

    // Step 2: order already confirmed — this tap confirms the delivery address.
    if (order.cod_confirm_status === "address_pending" || order.cod_confirm_status === "confirmed") {
      await Promise.all([
        order.cod_confirm_status === "confirmed" ? Promise.resolve() : updateOrder({
          cod_confirm_status: "confirmed",
          cod_confirmed_at: new Date().toISOString(),
          cod_confirm_reply: opts.text.slice(0, 500),
        }),
        sendReply(admin, ctx, order, opts.phone,
          `Thanks ${firstName}\nYour shipping address has been confirmed successfully! ✅\n\nYour order (ID: ${orderNum}) is now moving to the packing stage.\nWe'll update you once it is shipped!`),
      ]);
      return true;
    }

    // Step 1 → 2: order confirmed, now ask to verify the delivery address.
    const address = [order.street_address, order.city, order.state, order.pincode]
      .map((p: any) => String(p || "").trim())
      .filter(Boolean)
      .join(", ") || "As provided at checkout";
    await Promise.all([
      updateOrder({ cod_confirm_status: "address_pending", cod_confirm_reply: opts.text.slice(0, 500) }),
      sendReply(admin, ctx, order, opts.phone,
        `Hello ${firstName},\n\nYour order (ID: ${orderNum}) with ${storeName} has been confirmed. ✅\n\nBefore dispatch, please review your delivery address to avoid delays.\n\n*Delivery Address:*\n${address}\n\nPlease confirm if the above address is correct.`,
        ["Confirm Address", "I Want To Change Address"]),
    ]);
    return true;
  }

  // intent === "edit"
  await Promise.all([
    updateOrder({ cod_confirm_status: "edit_requested", cod_confirm_reply: opts.text.slice(0, 500) }),
    sendReply(admin, ctx, order, opts.phone,
      "No problem ✏️ Please reply with your correct address — house/flat number, landmark, city and pincode. We'll hold the parcel until then. If you'd like to cancel instead, just reply CANCEL."),
  ]);
  runBg(ctx, notifyStore(admin, order, "COD order needs address edit", `Customer tapped "Change Address" on order ${orderNum || order.id}.`));
  return true;
}

async function notifyStore(admin: any, order: any, title: string, body: string) {
  try {
    await admin.from("store_notifications").insert({
      store_id: order.store_id,
      title,
      body,
      link_url: `/dashboard/orders/${order.id}`,
    } as any);
  } catch { /* notifications are best-effort */ }
}
