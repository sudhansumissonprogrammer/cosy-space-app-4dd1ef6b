import { describe, expect, it } from "vitest";
import { firstValidPdpPayload, readPdpRpcResult, resolvePdpPayload } from "./pdpPayload";
describe("PDP payload recovery", () => {
  it("returns a fresh product without waiting for a stalled edge request", async () => {
    const stalled = new Promise<{ product: { id: string } }>(() => {});
    const fresh = { product: { id: "fresh" } };
    expect(await firstValidPdpPayload(stalled, Promise.resolve(fresh))).toBe(fresh);
  });
  it("does not let a cached miss beat a later valid product", async () => {
    const fresh = { product: { id: "fresh" } };
    expect(await firstValidPdpPayload(Promise.resolve({ product: null }), Promise.resolve(fresh))).toBe(fresh);
  });
  it("uses the valid source when the other request fails", async () => {
    const edge = { product: { id: "edge" } };
    expect(await firstValidPdpPayload(Promise.resolve(edge), Promise.reject(new Error("Outage")))).toBe(edge);
  });
  it("preserves an outage when both requests fail", async () => {
    await expect(firstValidPdpPayload(Promise.reject(new Error("Edge")), Promise.reject(new Error("Fresh")))).rejects.toThrow();
  });
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
