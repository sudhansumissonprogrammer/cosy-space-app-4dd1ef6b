import { render, cleanup } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useMetaTags } from "@/hooks/useMetaTags";
import { useProductJsonLd } from "@/hooks/useJsonLd";
import { MemoryRouter, Link } from "react-router-dom";
import { fireEvent } from "@testing-library/react";
import { useCanonical } from "@/hooks/useCanonical";

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
  expect(data.sku).toBeUndefined();
  expect(data.offers.itemCondition).toBeUndefined();
  expect(data.offers.priceValidUntil).toBeUndefined();
  expect(data.offers.seller.name).toBe("Utkal Watches");
  const crumb = JSON.parse(document.getElementById("json-ld-breadcrumb")?.textContent || "{}");
  expect(crumb.itemListElement[1].item).toBe("https://utkalwatch.in/shop");
  expect(crumb.itemListElement[1].name).toBe("Shop All");
});

it("uses the actual category slug, not one guessed from its label", () => {
  function Page() {
    useProductJsonLd({ product: { id: "p", name: "Watch", price: 1149, currency: "INR", category: "Men's - Watch" }, categoryLink: { name: "Men's - Watch", slug: "mens-watch-collection" }, storeSlug: "utkalwatches", storeName: "Utkal Watches", customDomain: "utkalwatch.in" });
    return null;
  }
  render(<Page />);
  const crumb = JSON.parse(document.getElementById("json-ld-breadcrumb")?.textContent || "{}");
  expect(crumb.itemListElement[1].item).toBe("https://utkalwatch.in/category/mens-watch-collection");
});

it("updates canonical and OG URL on query-only pagination", () => {
  function Page() {
    useCanonical("https://utkalwatch.in/shop");
    return <Link to="/shop?page=2">Next</Link>;
  }
  const page = render(<MemoryRouter initialEntries={["/shop"]}><Page /></MemoryRouter>);
  fireEvent.click(page.getByText("Next"));
  expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://utkalwatch.in/shop?page=2");
  expect(document.querySelector('meta[property="og:url"]')?.getAttribute("content")).toBe("https://utkalwatch.in/shop?page=2");
});

it("clears product social data when the next route has no photo or description", () => {
  function Page({ listing }: { listing: boolean }) {
    useMetaTags({ title: listing ? "Shop All" : "Watch", description: listing ? undefined : "Product facts", ogImage: listing ? undefined : "https://cdn.shopbanao.in/watch.webp", ogType: listing ? "website" : "product" });
    return null;
  }
  const page = render(<Page listing={false} />);
  page.rerender(<Page listing />);
  expect(document.querySelector('meta[property="og:type"]')?.getAttribute("content")).toBe("website");
  expect(document.querySelector('meta[property="og:image"]')?.getAttribute("content")).toBe("");
  expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe("");
});