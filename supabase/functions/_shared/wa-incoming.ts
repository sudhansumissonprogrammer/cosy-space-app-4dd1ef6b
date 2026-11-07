/** Keep every inbound type visible without retaining entire webhook payloads. */
export function parseIncomingMessage(msg: any) {
  const type = String(msg?.type || "text");
  const buttonText = msg?.button?.text || msg?.button?.payload ||
    msg?.interactive?.button_reply?.title || msg?.interactive?.list_reply?.title || "";
  const text = String(msg?.text?.body || buttonText || "").trim();
  const attachment = ["image", "video", "document", "audio", "sticker"].includes(type);
  const mediaId = attachment ? msg?.[type]?.id || null : null;
  const mediaType = attachment ? (type === "sticker" ? "image" : type) : null;
  let body = text || String(msg?.[type]?.caption || "").trim();
  if (!body && type === "location") {
    const location = msg?.location;
    body = [location?.name, location?.address,
      location?.latitude != null && location?.longitude != null
        ? `Location: ${location.latitude}, ${location.longitude}` : "Location"].filter(Boolean).join("\n");
  }
  if (!body && type === "contacts") {
    body = (msg?.contacts || []).map((contact: any) =>
      [contact?.name?.formatted_name, ...(contact?.phones || []).map((phone: any) => phone?.phone)]
        .filter(Boolean).join(" · ")).join("\n") || "[contacts]";
  }
  if (!body && type === "reaction") body = msg?.reaction?.emoji || "[reaction removed]";
  return { text, body: body || `[${type}]`, mediaId, mediaType };
}

/** The unique message ID is the commit marker, not a pre-insert event record. */
export async function persistIncomingMessage(admin: any, row: Record<string, unknown>): Promise<boolean> {
  const { error } = await admin.from("whatsapp_messages").insert(row);
  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(`Incoming message storage failed: ${error.code || "unknown"}`);
}