import { describe, expect, it } from "vitest";
import { usesWideMobileCards } from "./wideMobileCards";

describe("usesWideMobileCards", () => {
  it("applies to Kalinga Jewels", () => {
    expect(usesWideMobileCards({ id: "c3c5dff2-173a-4f4d-90e4-8b1c88c305d9" })).toBe(true);
  });
  it("applies to serdiyajewellers.shop", () => {
    expect(usesWideMobileCards({ id: "771a3012-393c-421a-b1c9-2ca918e6917f" })).toBe(true);
  });
  it("applies to Shakshi Imitation", () => {
    expect(usesWideMobileCards({ id: "5fb2aa02-79dc-4f14-9dcf-ab410730b394" })).toBe(true);
  });
  it("applies to Sanvariya Imitation", () => {
    expect(usesWideMobileCards({ id: "e62eade0-acc0-4dfd-891d-3580d7d9e5f4" })).toBe(true);
  });
  it("does not apply to other Serdiya stores or unknown stores", () => {
    expect(usesWideMobileCards({ id: "04010cad-1cbe-40ac-b818-07d9a79c1bf7" })).toBe(false);
    expect(usesWideMobileCards({ id: "96dd4090-c3c8-431b-be1e-ab700dd3b30a" })).toBe(false);
    expect(usesWideMobileCards(null)).toBe(false);
  });
});
