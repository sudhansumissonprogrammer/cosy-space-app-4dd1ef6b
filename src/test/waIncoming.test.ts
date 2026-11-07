import { describe, expect, it, vi } from "vitest";
import { parseIncomingMessage, persistIncomingMessage } from "../../supabase/functions/_shared/wa-incoming";

describe("Platform incoming WhatsApp messages", () => {
  it.each(["hi", "OTP 123456", "Anything else"])("retains text %s", (body) => {
    expect(parseIncomingMessage({ type: "text", text: { body } }).body).toBe(body);
  });
  it.each(["image", "audio", "video", "document", "sticker"])("retains %s attachments", (type) => {
    const parsed = parseIncomingMessage({ type, [type]: { id: "media-1" } });
    expect(parsed.mediaId).toBe("media-1");
    expect(parsed.mediaType).toBe(type === "sticker" ? "image" : type);
  });
  it("retains location messages", () => {
    expect(parseIncomingMessage({ type: "location", location: { latitude: 20, longitude: 85 } }).body).toBe("Location: 20, 85");
  });
  it("retains contact messages", () => {
    expect(parseIncomingMessage({ type: "contacts", contacts: [{ name: { formatted_name: "Contact" }, phones: [{ phone: "+919876543210" }] }] }).body).toBe("Contact · +919876543210");
  });
  it("retains interactive replies and unsupported types", () => {
    expect(parseIncomingMessage({ type: "interactive", interactive: { button_reply: { title: "Confirm" } } }).body).toBe("Confirm");
    expect(parseIncomingMessage({ type: "unknown" }).body).toBe("[unknown]");
  });
  const client = (error: unknown) => {
    const insert = vi.fn().mockResolvedValue({ error });
    return { admin: { from: vi.fn().mockReturnValue({ insert }) }, insert };
  };
  it("stores senders with no merchant without inventing a store", async () => {
    const { admin, insert } = client(null);
    expect(await persistIncomingMessage(admin, { store_id: null, message_body: "hi" })).toBe(true);
    expect(insert).toHaveBeenCalledWith({ store_id: null, message_body: "hi" });
  });
  it("does not repeat a committed message", async () => {
    expect(await persistIncomingMessage(client({ code: "23505" }).admin, {})).toBe(false);
  });
  it("does not acknowledge transient storage failures as duplicates", async () => {
    await expect(persistIncomingMessage(client({ code: "08006" }).admin, {})).rejects.toThrow("08006");
  });
});