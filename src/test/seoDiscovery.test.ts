import { describe, expect, it } from "vitest";
import { discoveryPage, discoveryUrl, productImageUrls, readAllRows, sitemapLastmod } from "../../supabase/functions/_shared/seoDiscovery";

describe("bounded catalogue discovery", () => {
  it("does not fabricate sitemap dates for undated pages", () => {
    expect(sitemapLastmod(null)).toBe("");
    expect(sitemapLastmod("not-a-date")).toBe("");
    expect(sitemapLastmod("2026-10-24T10:15:00Z")).toBe("<lastmod>2026-10-24</lastmod>");
  });
  it("has distinct addresses for page one and two", () => {
    expect(discoveryUrl("https://utkalwatch.in/category/men-s-watch", 1)).toBe("https://utkalwatch.in/category/men-s-watch");
    expect(discoveryUrl("https://utkalwatch.in/category/men-s-watch", 2)).toBe("https://utkalwatch.in/category/men-s-watch?page=2");
  });
  it("rejects invalid page inputs", () => {
    expect(discoveryPage(null)).toBe(1);
    expect(discoveryPage("2")).toBe(2);
    for (const raw of ["0", "-1", "2.5", "100001", "<script>"]) expect(discoveryPage(raw)).toBeNull();
  });
  it("does not truncate a catalogue at 1000 rows", async () => {
    const rows = Array.from({ length: 1069 }, (_, id) => ({ id }));
    const all = await readAllRows(async (from, to) => ({ data: rows.slice(from, to + 1) }));
    expect(all.length).toBe(1069);
    expect(all.at(-1)?.id).toBe(1068);
  });
  it("does not return a partial sitemap on query failure", async () => {
    await expect(readAllRows(async () => ({ data: null, error: new Error("failed") }))).rejects.toThrow("Catalogue retrieval failed");
  });
  it("merges actual hero and gallery without deriving image siblings", () => {
    expect(productImageUrls("https://cdn.shopbanao.in/raw800.webp", ["https://cdn.shopbanao.in/raw800.webp", "https://cdn.shopbanao.in/back.webp"]))
      .toEqual(["https://cdn.shopbanao.in/raw800.webp", "https://cdn.shopbanao.in/back.webp"]);
  });
});