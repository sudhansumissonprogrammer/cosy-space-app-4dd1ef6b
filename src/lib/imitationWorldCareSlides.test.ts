import { describe, expect, it } from "vitest";
import { withImitationWorldCareGuide, imitationWorldCareGuideUrl, type CareGallerySlide } from "./imitationWorldCareSlides";

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
  it("never adds the retired 18K chain poster, even for Chain with Pendant", () => {
    const result = withImitationWorldCareGuide([photo("one")], true, { slug: "chain-and-pendant", category: "Chain with Pendant" });
    expect(result.map(s => s.url)).toEqual(["one", "one", imitationWorldCareGuideUrl]);
  });
  it("deduplicates a care guide already present in slides", () => {
    const result = withImitationWorldCareGuide([photo("one"), photo(imitationWorldCareGuideUrl)], true);
    expect(result.map(s => s.url)).toEqual(["one", "one", imitationWorldCareGuideUrl]);
  });
});
