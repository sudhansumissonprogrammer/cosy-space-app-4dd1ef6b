import { describe, expect, it } from "vitest";
import { KALINGA_STORE_ID, isKalingaStore, kalingaPublicEmail, kalingaPublicAddress } from "./kalingaStore";

describe("Kalinga public contact", () => {
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