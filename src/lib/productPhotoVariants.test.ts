import { describe, expect, it } from "vitest";
import { resolveVariantUrl } from "./uploadOptimizedImage";
import { getImageSrcSet } from "./imageOptimize";

const root = "https://cdn.shopbanao.in/product-images/store/product/";

describe("known product photo families", () => {
  it("uses tiny siblings only for explicitly marked new upload families", () => {
    const photo = `${root}1791400000000-new-thumb160-1200w.webp`;
    expect(resolveVariantUrl(photo, 160)).toBe(photo.replace("1200w", "160w"));
    expect(resolveVariantUrl(photo, 120)).toBe(photo.replace("1200w", "160w"));
    expect(resolveVariantUrl(photo, 400)).toBe(photo.replace("1200w", "800w"));
    expect(resolveVariantUrl(`${root}1791400000000-old-1200w.webp`, 160)).toContain("800w");
  });
  it("keeps modern category cards on one existing 800px photo", () => {
    const photo = `${root}1791307529627-c7mlzg-1200w.webp`;
    expect(resolveVariantUrl(photo, 400)).toBe(photo.replace("1200w", "800w"));
    const srcset = getImageSrcSet(photo, [300, 500, 700, 900]);
    expect(srcset).toBe(`${photo.replace("1200w", "800w")} 800w`);
    expect(srcset).not.toContain("1200w");
  });

  it("reserves canonical PDP and zoom photos for their requested sizes", () => {
    const photo = `${root}1791307529627-c7mlzg-1200w.webp`;
    expect(resolveVariantUrl(photo, 1200)).toBe(photo);
    expect(resolveVariantUrl(photo, 1600)).toBe(photo.replace("1200w", "2000w"));
  });

  it("preserves old 400px families without inventing an 800px file", () => {
    const photo = `${root}1790747948999-legacy-1200w.webp`;
    expect(resolveVariantUrl(photo, 800)).toBe(photo.replace("1200w", "400w"));
  });

  it("never invents siblings for single-file, raw, or unknown photos", () => {
    for (const photo of [`${root}legacy-800w.webp`, `${root}unknown-1200w.webp`, "https://images.meesho.com/item.avif"]) {
      expect(resolveVariantUrl(photo, 160)).toBe(photo);
      if (!photo.includes("unknown")) expect(resolveVariantUrl(photo, 2000)).toBe(photo);
    }
  });
});