import { describe, expect, it } from "vitest";
import { KALINGA_STORE_ID, kalingaPublicEmail } from "./kalingaStore";

describe("Kalinga public contact", () => {
  it("keeps the requested public email after a store rename", () => {
    expect(kalingaPublicEmail({ id: KALINGA_STORE_ID, slug: "renamed" })).toBe("bavunisaf@gmail.com");
  });
  it("does not replace another store's contact", () => {
    expect(kalingaPublicEmail({ id: "another-store", slug: "other" })).toBeUndefined();
  });
});