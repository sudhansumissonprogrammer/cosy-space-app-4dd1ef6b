import { describe, expect, it } from "vitest";
import { withImitationWorldCareGuide, imitationWorldCareGuideUrl, kalingaChainPosterUrl, type CareGallerySlide } from "./imitationWorldCareSlides";

const photo = (url: string): CareGallerySlide => ({ kind: "image", url });
describe("Imitation World care guide", () => {
  it("leaves other stores untouched", () => {
    const slides = [photo("one")];
    expect(withImitationWorldCareGuide(slides, false)).toBe(slides);
  });
  it("repeats a single photo before the care guide", () => {
    expect(withImitationWorldCareGuide([photo("one")], true).map(s => s.url))
      .toEqual(["one", "one", imitationWorldCareGuideUrl]);
  });
  it("handles the existing duplicated-single gallery", () => {
    expect(withImitationWorldCareGuide([photo("one"), photo("one")], true)).toHaveLength(3);
  });
  it("keeps remaining photos and video before the guide, which stays last", () => {
    const video: CareGallerySlide = { kind: "video", url: "video", poster: "one" };
    expect(withImitationWorldCareGuide([photo("one"), video, photo("two"), photo("three")], true))
      .toEqual([photo("one"), photo("two"), video, photo("three"), photo(imitationWorldCareGuideUrl)]);
  });
  it("does not manufacture product photos for an empty gallery", () => {
    expect(withImitationWorldCareGuide([], true)).toEqual([]);
  });

  it("puts the poster third for an eligible single-photo product, care last", () => {
    expect(withImitationWorldCareGuide([photo("one")], true, { slug: "chain-and-pendant", category: "Chain with Pendant" }).map(s => s.url))
      .toEqual(["one", "one", kalingaChainPosterUrl, imitationWorldCareGuideUrl]);
  });
  it.each(['hanumanji-gold-plated-chain-locket-8zmrfl', 'maa-letter-locket-gold-brass-pendant-necklace-chain-for-men-and-women-pendants-l-32t59n', 'om-gold-nackless-chain-gduv9j', 'premium-gold-plated-rectangular-om-pendant-chain-unisex-religious-gold-locket-fe-hl6odp', 'gold-plated-religious-om-pendant-with-sleek-snake-chain-for-men-and-women-i2wctd', 'trending-stylish-new-hindu-religious-gold-plated-brass-shree-balaji-bajrangbali--erttoc', 'durga-maa-divine-gold-plated-pendant-with-rope-chain-gippbr', 'durga-maa-divine-gold-plated-pendant-with-rope-chain-gippbq', 'micro-gold-plated-granted-polish-new-krishna-locket-with-chain-multi-colour-kris-fao53n', 'gold-plated-maa-pendant-with-chain-round-mother-locket-mom-written-necklace-for--c0zq24', 'stylish-fancy-gold-plated-alloy-neck-chain-92vwt3', 'om-kada-with-maa-chains-pandal-set-93bjk', 'five-face-original-rudraksh-gold-plated-mala-with-om-trisul-in-men-fashion-authe-abene9', 'rudraksha-chain-with-om-tilak-gold-plated-locket-gold-plated-plated-brass-chain-atmql4', 'rudraksha-bracelet-trishul-pendant-necklace-combo-for-men-gold-plated-mahadev-je-gohhhv', 'free-size-ex16hz', 'shree-om-5-mukhi-rudraksha-locket-with-chain-92y1iw', 'free-size-ex16hg'])("excludes requested product %s", slug => {
    expect(withImitationWorldCareGuide([photo("one")], true, { slug, category: "Chain with Pendant" }).map(s => s.url))
      .toEqual(["one", "one", imitationWorldCareGuideUrl]);
  });
  it("does not add the poster to other categories or stores", () => {
    const p = { slug: "chain-and-pendant", category: "Rings" };
    expect(withImitationWorldCareGuide([photo("one")], true, p).map(s => s.url)).not.toContain(kalingaChainPosterUrl);
    expect(withImitationWorldCareGuide([photo("one")], false, { ...p, category: "Chain with Pendant" })).toEqual([photo("one")]);
  });
  it("preserves later photos/videos and deduplicates informational slides", () => {
    const video: CareGallerySlide = { kind: "video", url: "video", poster: "one" };
    expect(withImitationWorldCareGuide([photo("one"), video, photo("two"), photo("three"), photo(kalingaChainPosterUrl), photo(imitationWorldCareGuideUrl)], true, { slug: "chain-and-pendant", category: "Chain with Pendant" }))
      .toEqual([photo("one"), photo("two"), photo(kalingaChainPosterUrl), video, photo("three"), photo(imitationWorldCareGuideUrl)]);
  });
});
