import { describe, expect, it } from "vitest";
import { storefrontPageMeta } from "../lib/storefrontPageMeta";

describe("public route metadata ownership", () => {
  const store = { name: "Utkal Watch", slug: "utkalwatches" };
  it("gives categories their own title and canonical path", () => {
    expect(storefrontPageMeta("/categories", store)).toEqual({ title: "Browse categories — Utkal Watch", canonicalPath: "categories" });
  });
  it.each(["contact", "contact-us", "return-policy", "shipping-policy", "terms", "privacy-policy"])("owns previously uncovered public route %s", route => {
    expect(storefrontPageMeta(`/store/utkalwatches/${route}/`, store)?.canonicalPath).toBe(route);
  });
  it.each(["/", "/shop", "/category/sale", "/product/watch", "/stores", "/stores/mumbai", "/page/story", "/checkout", "/account", "/store/other/categories"])("does not replace another metadata owner for %s", path => {
    expect(storefrontPageMeta(path, store)).toBeNull();
  });
  it("uses each future store's identity instead of Utkal's", () => {
    expect(storefrontPageMeta("/categories", { name: "New Store", slug: "new-store" })?.title).toBe("Browse categories — New Store");
  });
});