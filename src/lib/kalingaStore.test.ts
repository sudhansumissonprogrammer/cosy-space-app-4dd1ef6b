import { describe, expect, it } from "vitest";
import { KALINGA_STORE_ID, isKalingaStore, kalingaPublicEmail, kalingaPublicAddress, resolveKalingaPublicStore } from "./kalingaStore";

describe("Kalinga public contact", () => {
  it("resolves the confirmed public phone without changing authentication", () => {
    const stale = { id: KALINGA_STORE_ID, whatsapp_number: "9348625925", login_email: "unchanged", secondary_phone: "9692282485" };
    const resolved = resolveKalingaPublicStore(stale);
    expect(resolved.whatsapp_number).toBe("9692282485");
    expect(resolved.secondary_phone).toBeNull();
    expect(resolved.login_email).toBe("unchanged");
    expect(stale.whatsapp_number).toBe("9348625925");
  });
  it("leaves other stores untouched", () => {
    const other = { id: "other", slug: "other", whatsapp_number: "9348625925" };
    expect(resolveKalingaPublicStore(other)).toBe(other);
  });
  it("keeps the requested public email after a store rename", () => {
    expect(kalingaPublicEmail({ id: KALINGA_STORE_ID, slug: "renamed" })).toBe("bavunisaf@gmail.com");
  });
  it("does not replace another store's contact", () => {
    expect(kalingaPublicEmail({ id: "another-store", slug: "other" })).toBeUndefined();
  });
  it("uses the confirmed address even when the store is renamed", () => {
    expect(kalingaPublicAddress({ id: KALINGA_STORE_ID, slug: "renamed" })).toBe("Patasanipur, Ghiakhala, Khorda, Odisha, 752030, India");
    expect(kalingaPublicAddress({ id: "another-store", slug: "other" })).toBeUndefined();
  });
  it("retains store-specific features after the Imitation World rename", () => {
    expect(isKalingaStore({ id: KALINGA_STORE_ID, slug: "kalingajewels" })).toBe(true);
    expect(isKalingaStore({ id: KALINGA_STORE_ID, slug: "future-name" })).toBe(true);
    expect(isKalingaStore({ id: "other", slug: "other" })).toBe(false);
  });
});