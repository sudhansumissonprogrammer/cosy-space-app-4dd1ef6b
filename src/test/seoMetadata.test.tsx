import { render, cleanup } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useMetaTags } from "@/hooks/useMetaTags";
import { useProductJsonLd } from "@/hooks/useJsonLd";

afterEach(() => { cleanup(); document.head.querySelectorAll('link[rel="canonical"],script[type="application/ld+json"]').forEach(e => e.remove()); });

it("keeps PDP canonical when an inactive shell updates", () => {
  function Page({ name }: { name: string }) {
    useMetaTags({ storeSlug: "utkalwatches", customDomain: "utkalwatch.in", canonicalPath: "product/hublot-big-bang", title: "Watch" });
    useMetaTags({ enabled: false, storeSlug: "utkalwatches", title: name });
    return null;
  }
  const page = render(<Page name="Store" />);
  page.rerender(<Page name="Changed store" />);
  expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://utkalwatch.in/product/hublot-big-bang");
});

it("publishes seller without inventing manufacturer or expiry", () => {
  function Page() {
    useProductJsonLd({ product: { id: "p", slug: "watch", name: "Watch", price: 1149, currency: "INR", category: "Men's - Watch", stock_quantity: 1 }, storeSlug: "utkalwatches", storeName: "Utkal Watches", customDomain: "utkalwatch.in" });
    return null;
  }
  render(<Page />);
  const data = JSON.parse(document.getElementById("json-ld-structured-data")?.textContent || "{}");
  expect(data.brand).toBeUndefined();
  expect(data.mpn).toBeUndefined();
  expect(data.offers.priceValidUntil).toBeUndefined();
  expect(data.offers.seller.name).toBe("Utkal Watches");
  const crumb = JSON.parse(document.getElementById("json-ld-breadcrumb")?.textContent || "{}");
  expect(crumb.itemListElement[1].item).toBe("https://utkalwatch.in/shop");
});