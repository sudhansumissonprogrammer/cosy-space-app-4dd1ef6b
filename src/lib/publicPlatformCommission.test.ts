import { describe, expect, it } from "vitest";
import { calculatePublicPlatformCommission } from "./publicPlatformCommission";

describe("public platform commission", () => {
  it("calculates 2% of the order subtotal", () => {
    expect(calculatePublicPlatformCommission(1000)).toBe(20);
    expect(calculatePublicPlatformCommission(500 * 1200)).toBe(12000);
  });
});
