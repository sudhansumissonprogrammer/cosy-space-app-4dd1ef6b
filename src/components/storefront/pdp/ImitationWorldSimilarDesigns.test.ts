import { describe, expect, it } from "vitest";
import { orderSimilarDesigns, SIMILAR_DESIGN_SLUGS } from "./ImitationWorldSimilarDesigns";

const rows = SIMILAR_DESIGN_SLUGS.map((slug, index) => ({
  id: String(index), slug, name: `Pendant ${index}`, image_url: `https://example.com/${index}.webp`,
}));

describe("Imitation World similar designs", () => {
  it("keeps all 18 designs in the supplied order without duplicating the current product", () => {
    const result = orderSimilarDesigns([...rows].reverse(), rows[7]);
    expect(result.map((row) => row.slug)).toEqual([...SIMILAR_DESIGN_SLUGS]);
    expect(result.filter((row) => row.id === rows[7].id)).toHaveLength(1);
  });
  it("includes another PDP's current photo before the unchanged curated order", () => {
    const current = { id: "other", slug: "other", name: "Other pendant", image_url: "https://example.com/other.webp" };
    expect(orderSimilarDesigns(rows, current).map((row) => row.slug)).toEqual(["other", ...SIMILAR_DESIGN_SLUGS]);
  });
  it("does not resurrect unavailable products or empty photos", () => {
    const available = rows.slice(1).map((row, i) => i === 0 ? { ...row, image_url: null } : row);
    expect(orderSimilarDesigns(available, rows[3]).map((row) => row.slug)).toEqual([...SIMILAR_DESIGN_SLUGS].slice(2));
  });
});
describe("Imitation World added designs positions", () => {
  it("places the four added designs at positions 3, 5, 9 and 12", () => {
    expect(SIMILAR_DESIGN_SLUGS[2]).toBe("18k-gold-plated-om-studded-diamond-pendant");
    expect(SIMILAR_DESIGN_SLUGS[4]).toBe("1-gram-gold-plated-highway-chain");
    expect(SIMILAR_DESIGN_SLUGS[9]).toBe("new-micro-gold-plated-chain-pendant-hp04e0");
    expect(SIMILAR_DESIGN_SLUGS[12]).toBe("new-micro-gold-plated-chain-pendant-hp04dz");
    expect(SIMILAR_DESIGN_SLUGS).toHaveLength(18);
    expect(SIMILAR_DESIGN_SLUGS[7]).toBe("trishul-ram-new-micro-gold-plated-chain-pendant");
  });
});
