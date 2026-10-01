// Point shoppers replying to the shared number at the store's public WhatsApp contact.
// Never infer a store from an unrelated phone: quoted message IDs take precedence,
// then a recent outbound message to this exact recipient on the shared number.
import { metaFetch } from "./wa-platform.ts";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

function indianMobile(raw: string | null | undefined): string | null {
  let digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10 && /^[6-9]/.test(digits)) digits = `91${digits}`;
  return /^91[6-9]\d{9}$/.test(digits) ? digits : null;
}

export async function sendStoreSupportRedirect(
  admin: any,
  opts: {
    phone: string;
    contextId: string | null;
    platformPhoneId: string;
    platformToken: string;
    sharedDisplayPhone: string | null;
  },
): Promise<void> {
  const phone = indianMobile(opts.phone);
  if (!phone) return;
  const variants = [phone, `+${phone}`, phone.slice(2)];
  let storeId: string | null = null;

  if (opts.contextId) {
    const { data: quoted } = await admin.from("whatsapp_messages")
      .select("store_id, recipient_phone, status, direction, sent_via")
      .eq("meta_message_id", opts.contextId).maybeSingle();
    if (quoted?.store_id && quoted.direction === "outgoing" && quoted.sent_via === "platform" &&
      quoted.status !== "failed" && variants.includes(quoted.recipient_phone)) {
      storeId = quoted.store_id;
    }
    // An explicit quote of a different conversation must not silently route to
    // whichever merchant happened to message this shopper most recently.
    if (!storeId) return;
  } else {
    const { data: recent } = await admin.from("whatsapp_messages")
      .select("store_id")
      .in("recipient_phone", variants)
      .eq("direction", "outgoing").eq("sent_via", "platform")
      .in("status", ["sent", "delivered", "read"])
      .not("store_id", "is", null)
      .gte("created_at", new Date(Date.now() - THIRTY_DAYS).toISOString())
      .order("created_at", { ascending: false }).limit(1);
    storeId = recent?.[0]?.store_id || null;
  }
  if (!storeId) return;

  const { data: store } = await admin.from("stores")
    .select("name, whatsapp_number, secondary_phone, is_suspended")
    .eq("id", storeId).maybeSingle();
  if (!store || store.is_suspended) return;
  const contact = indianMobile(store.whatsapp_number) || indianMobile(store.secondary_phone);
  if (!contact || contact === phone || contact === indianMobile(opts.sharedDisplayPhone)) return;

  // One automatic redirect per shopper/store/day; the merchant's own replies
  // in the dashboard remain unaffected. Do not repeat on every inbound message.
  const { data: prior } = await admin.from("whatsapp_messages")
    .select("id").eq("store_id", storeId).eq("message_type", "support_redirect")
    .in("recipient_phone", variants)
    .eq("direction", "outgoing")
    .gte("created_at", new Date(Date.now() - ONE_DAY).toISOString()).limit(1);
  if (prior?.length) return;

  const name = String(store.name || "the store").replace(/[\r\n*]/g, " ").slice(0, 80);
  const body = `For help with ${name}, please message the store directly on WhatsApp: https://wa.me/${contact}\nStore contact: +${contact}`;
  const result = await metaFetch(admin,
    `https://graph.facebook.com/v21.0/${opts.platformPhoneId}/messages`,
    { method: "POST", headers: { Authorization: `Bearer ${opts.platformToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: phone, type: "text", text: { body, preview_url: false } }) },
    { source: "wa-support-redirect" },
  );
  const { error } = await admin.from("whatsapp_messages").insert({
    store_id: storeId, recipient_phone: phone, direction: "outgoing", sent_via: "platform",
    message_type: "support_redirect", message_body: body,
    status: result.ok ? "sent" : "failed",
    meta_message_id: result.body?.messages?.[0]?.id || null,
    error_message: result.ok ? null : JSON.stringify(result.body).slice(0, 500),
  });
  if (error) console.error("support redirect log failed", error.message);
  if (!result.ok) console.error("support redirect send failed", result.status, JSON.stringify(result.body).slice(0, 300));
}