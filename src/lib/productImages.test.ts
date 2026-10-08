import { describe, expect, it } from "vitest";
import { resolveProductImages } from "./imageOptimize";

describe("product gallery source normalization", () => {
  it("deduplicates gallery rows with whitespace without changing photo URLs", () => {
    expect(resolveProductImages({
      image_url: " https://example.com/main.webp ",
      product_images: [
        { image_url: " https://example.com/main.webp ", display_order: 0 },
        { image_url: " https://example.com/second.webp ", display_order: 1 },
        { image_url: " ", display_order: 2 },
        { image_url: null, display_order: 3 },
      ],
    })).toEqual(["https://example.com/main.webp", "https://example.com/second.webp"]);
  });
});