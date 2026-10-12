import { describe, expect, it } from "vitest";
import { calculatePublicPlatformCommission } from "./publicPlatformCommission";

describe("public platform commission", () => {
  it("calculates 3% of the order subtotal", () => {
    expect(calculatePublicPlatformCommission(1000)).toBe(30);
    expect(calculatePublicPlatformCommission(500 * 1200)).toBe(18000);
  });
});
