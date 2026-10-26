import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { productSearchDescription, productSearchPrice } from "../../supabase/functions/_shared/productSeo";
import { buildStorefrontH1 } from "../lib/storefrontSeoH1";

const worker = readFileSync("docs/cloudflare-worker-current.js", "utf8").replace("export default {", "const workerExport = {");
function renderer() {
  const context = vm.createContext({ Request, Response, Headers, URL, URLSearchParams, TextEncoder, TextDecoder, console, setTimeout, clearTimeout, caches: { default: {} } });
  vm.runInContext(worker + "\nglobalThis.renderers = { head: _buildPdpCategorySeoHead, social: buildOgHtml, home: _buildSeoBodyBlock };", context);
  return context.renderers as { head: (...args: any[]) => string; social: (...args: any[]) => string; home: (...args: any[]) => string };
}
function schemas(html: string) {
  return Array.from(html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g), m => JSON.parse(m[1]));
}
const store = { name: "Utkal Watches", custom_domain: "utkalwatch.in", currency: "INR" };

describe("product search representation consistency", () => {
  it.each([null, undefined, "", "invalid"])("omits Worker stock claims for unknown quantity %s", stock_quantity => {
    const product = { id: "id", name: "Watch", price: 100, stock_quantity };
    const html = renderer().head(store, "utkalwatches", "utkalwatch.in", "/product/id", { kind: "product", json: JSON.stringify({ product }) });
    expect(schemas(html)[0].offers.availability).toBeUndefined();
    expect(html).not.toContain('property="product:availability"');
    expect(html).not.toContain('name="twitter:data2"');
  });
  it.each([null, 80, 100, 120, 0])("matches the existing PDP price for sale %s", sale_price => {
    const product = { id: "id", slug: "watch", name: "Watch", price: 100, sale_price, stock_quantity: 1 };
    const html = renderer().head(store, "utkalwatches", "utkalwatch.in", "/product/watch", { kind: "product", json: JSON.stringify({ product }) });
    expect(Number(schemas(html)[0].offers.price)).toBe(sale_price === 80 ? 80 : 100);
    expect(productSearchPrice(product)).toBe(sale_price === 80 ? 80 : 100);
  });
  it.each(["/product/watch", "/products/watch", "/product/id"])("uses resolved product identity for %s", path => {
    const html = renderer().head(store, "utkalwatches", "utkalwatch.in", path, { kind: "product", json: JSON.stringify({ product: { id: "id", slug: "watch", name: "Watch", price: 100 } }) });
    const data = schemas(html);
    expect(data[0].url).toBe("https://utkalwatch.in/product/watch");
    expect(data[0].offers.url).toBe("https://utkalwatch.in/product/watch");
    expect(data[1].itemListElement.at(-1).item).toBe("https://utkalwatch.in/product/watch");
    expect(html).toContain('rel="canonical" href="https://utkalwatch.in/product/watch"');
    expect(html).toContain('property="og:url" content="https://utkalwatch.in/product/watch"');
  });
  it.each([null, "", "  "])("keeps missing facts absent for description %s", description => {
    const product = { id: "id", name: "Watch & Chain", price: 100, description, meta_description: " " };
    expect(productSearchDescription(product, store.name)).toBe("View Watch & Chain at Utkal Watches.");
    const html = renderer().head(store, "utkalwatches", "utkalwatch.in", "/product/id", { kind: "product", json: JSON.stringify({ product }) });
    expect(schemas(html)[0].description).toBeUndefined();
  });
  it("prefers approved metadata without turning it into product facts", () => {
    const product = { id: "id", name: "Watch", price: 100, meta_description: "Approved search text", description: "Steel & glass" };
    expect(productSearchDescription(product, store.name)).toBe("Approved search text");
    const html = renderer().head(store, "utkalwatches", "utkalwatch.in", "/product/id", { kind: "product", json: JSON.stringify({ product }) });
    expect(schemas(html)[0].description).toBe("Steel & glass");
  });
  it.each(["in stock", "out of stock", undefined])("preserves social stock certainty %s", availability => {
    const html = renderer().social({ name: "Watch", title: "Watch — ₹80", description: "View Watch", price: 80, currency: "INR", availability, canonical: "https://utkalwatch.in/product/watch" }, "https://utkalwatch.in/products/watch");
    const data = schemas(html)[0];
    expect(data.name).toBe("Watch");
    expect(data.offers.url).toBe("https://utkalwatch.in/product/watch");
    expect(data.offers.availability).toBe(availability === "in stock" ? "https://schema.org/InStock" : availability === "out of stock" ? "https://schema.org/OutOfStock" : undefined);
    expect(data.description).toBeUndefined();
  });
  it("mirrors the app's nonduplicated homepage identity", () => {
    const fixture = { ...store, description: "Utkal Watches — wrist watches for men and women" };
    expect(renderer().home(fixture, [], [])).toContain(`<h1>${buildStorefrontH1(fixture)}</h1>`);
    expect(renderer().home(store, [], [])).toContain("<h1>Utkal Watches — Online Store</h1>");
  });
  it("does not retain legacy Utkal price or delivery assertions in the Worker", () => {
    const product = { id: "id", name: "Listed Watch", price: 1999, meta_description: "Analog watch for men at ₹1,650 on Utkal Watches. Cash on Delivery and fast delivery across India. Ideal for daily wear and gifting." };
    const html = renderer().head(store, "utkalwatches", "utkalwatch.in", "/product/id", { kind: "product", json: JSON.stringify({ product }) });
    expect(html).toContain(productSearchDescription(product, store.name));
    expect(html).not.toContain("fast delivery across India");
    expect(Number(schemas(html)[0].offers.price)).toBe(1999);
  });
});