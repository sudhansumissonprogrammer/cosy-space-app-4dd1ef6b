import { describe, expect, it } from "vitest";
import manifest from "@/assets/storefront-thumbnails/manifest.json";
import { verifiedThumbnail } from "./verifiedThumbnails";
import { optimizeImageUrl } from "./imageOptimize";

describe("verified small-display copies", () => {
  const source = Object.keys(manifest)[0];
  it("uses only a published manifest entry at small sizes", () => {
    expect(verifiedThumbnail(source, source, 160)).toContain("https://cosy-space-app.lovable.app/__l5e/");
    expect(verifiedThumbnail("https://example.com/photo.jpg", "https://example.com/photo.jpg", 160)).toBeUndefined();
  });
  it("preserves card, PDP, and zoom sources", () => {
    for (const size of [800, 1200, 2000]) expect(verifiedThumbnail(source, source, size)).toBeUndefined();
    expect(optimizeImageUrl(source, 800)).toBe(source);
  });
  it("matches canonical photos through their verified existing card URL", () => {
    const canonical = "https://cdn.shopbanao.in/product-images/e5fe0b51-60f0-4f17-9300-846f8450b0d5/c3c5dff2-173a-4f4d-90e4-8b1c88c305d9/1791305553339-e454um-1200w.webp";
    expect(optimizeImageUrl(canonical, 160)).toContain("/__l5e/assets-v1/");
    expect(optimizeImageUrl(canonical, 1200)).toBe(canonical);
  });
});