import { describe, expect, it } from "vitest";
import { discoveryAvailability, discoverySalePrice, hasRequiredFeedFacts } from "../../supabase/functions/_shared/productDiscoveryFacts";
import { readFileSync } from "node:fs";

describe("accurate public feed facts", () => {
  it.each([null, undefined, "", "invalid", NaN, Infinity, true])("does not invent availability for %s", stock => {
    expect(discoveryAvailability(stock)).toBeUndefined();
  });
  it.each([[0, "out of stock"], [-1, "out of stock"], [1, "in stock"], [999999, "in stock"]])("maps known stock %s", (stock, expected) => {
    expect(discoveryAvailability(stock)).toBe(expected);
  });
  it("preserves the actual discounted price even below five percent of list price", () => {
    expect(discoverySalePrice(1000, 20)).toBe(20);
  });
  it.each([0, -1, 1000, 2000, Infinity])("rejects invalid sale %s", sale => {
    expect(discoverySalePrice(1000, sale)).toBeUndefined();
  });
  it("requires a known stock, positive price and HTTPS image", () => {
    const p = { name: "Watch", price: 100, stock_quantity: 0 };
    expect(hasRequiredFeedFacts(p, ["https://cdn.example/watch.webp"])).toBe(true);
    expect(hasRequiredFeedFacts({ ...p, stock_quantity: null }, ["https://cdn.example/watch.webp"])).toBe(false);
    expect(hasRequiredFeedFacts({ ...p, price: Infinity }, ["https://cdn.example/watch.webp"])).toBe(false);
    expect(hasRequiredFeedFacts(p, ["http://cdn.example/watch.webp"])).toBe(false);
  });
  it.each(["meta-product-feed", "seo-page"])("scopes %s catalogue to visible products and resolved tenant", name => {
    const source = readFileSync(`supabase/functions/${name}/index.ts`, "utf8");
    expect(source).toContain('.eq("store_id", store.id)');
    expect(source).toContain('.eq("hidden_by_category", false)');
    expect(source).toContain('.eq("is_active", true)');
    expect(source).not.toContain('.limit(5000)');
  });
});