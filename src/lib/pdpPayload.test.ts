import { describe, expect, it } from "vitest";
import { resolvePdpPayload } from "./pdpPayload";
describe("PDP payload recovery", () => {
  it("uses fresh data after a cached missing product", async () => {
    const fresh = { product: { id: "maa-pendant" } };
    expect(await resolvePdpPayload({ product: null }, Promise.resolve(fresh))).toBe(fresh);
  });
  it("retains a positive edge result", async () => {
    const edge = { product: { id: "maa-pendant" } };
    expect(await resolvePdpPayload(edge, Promise.resolve(null))).toBe(edge);
  });
  it("keeps genuinely unavailable products unavailable", async () => {
    expect(await resolvePdpPayload(null, Promise.resolve({ product: null }))).toEqual({ product: null });
  });
});
