import { describe, expect, it } from "vitest";
import { getPdpHeroSrcSet } from "./imageOptimize";

const base = "https://cdn.shopbanao.in/product-images/s/t/";

describe("PDP hero srcset", () => {
  it("offers 800w only for uploads after 2026-09-30 05:59:09 UTC", () => {
    const u = `${base}1791307529627-c7mlzg-1200w.webp`;
    expect(getPdpHeroSrcSet(u)).toBe(`${base}1791307529627-c7mlzg-800w.webp 800w, ${u} 1200w`);
  });
  it("keeps older uploads (400w card era) on the single 1200w photo", () => {
    expect(getPdpHeroSrcSet(`${base}1790000000000-abc-1200w.webp`)).toBe("");
  });
  it("never derives siblings for raw or legacy single-file photos", () => {
    expect(getPdpHeroSrcSet(`${base}meesho-raw.jpg`)).toBe("");
    expect(getPdpHeroSrcSet(`${base}1791307529627-x-800w.webp`)).toBe("");
  });
});
