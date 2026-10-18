import { describe, expect, it } from "vitest";
import { readPdpRpcResult, resolvePdpPayload } from "./pdpPayload";
describe("PDP payload recovery", () => {
  it("does not classify a service failure as a missing product", () => {
    const error = new Error("Temporary outage");
    expect(() => readPdpRpcResult({ data: null, error })).toThrow(error);
  });
  it("accepts a successful missing-product response", () => {
    expect(readPdpRpcResult({ data: { product: null }, error: null })).toEqual({ product: null });
  });
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
