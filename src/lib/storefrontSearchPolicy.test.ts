import { describe, expect, it } from "vitest";
import { storefrontUtilityRoute } from "./storefrontSearchPolicy";

describe("storefront utility search policy", () => {
  it("excludes utility pages and private order descendants", () => {
    for (const path of ["cart", "checkout", "account", "search", "track-order", "wishlist", "auth", "login", "signup", "order-confirmation"]) {
      expect(storefrontUtilityRoute(`/${path}`, "utkalwatches")).toBe(path);
      expect(storefrontUtilityRoute(`/store/utkalwatches/${path}`, "utkalwatches")).toBe(path);
    }
    expect(storefrontUtilityRoute("/account/orders/private-order-id", "utkalwatches")).toBe("account");
  });
  it("does not exclude public product/catalogue pages or another store's path", () => {
    for (const path of ["/", "/shop", "/best-sellers", "/category/men-s-watch", "/product/watch", "/store/utkalwatches", "/store/another-store/account"]) {
      expect(storefrontUtilityRoute(path, "utkalwatches")).toBeNull();
    }
  });
});