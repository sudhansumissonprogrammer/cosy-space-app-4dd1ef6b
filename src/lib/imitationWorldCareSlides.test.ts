import { describe, expect, it } from "vitest";
import { withImitationWorldCareGuide, imitationWorldCareGuideUrl, type CareGallerySlide } from "./imitationWorldCareSlides";

const photo = (url: string): CareGallerySlide => ({ kind: "image", url });
describe("Imitation World care guide", () => {
  it("leaves other stores untouched", () => {
    const slides = [photo("one")];
    expect(withImitationWorldCareGuide(slides, false)).toBe(slides);
  });
  it("repeats a single photo before the third-slide guide", () => {
    expect(withImitationWorldCareGuide([photo("one")], true).map(s => s.url))
      .toEqual(["one", "one", imitationWorldCareGuideUrl]);
  });
  it("handles the existing duplicated-single gallery", () => {
    expect(withImitationWorldCareGuide([photo("one"), photo("one")], true)).toHaveLength(3);
  });
  it("preserves remaining photos and video after the guide", () => {
    const video: CareGallerySlide = { kind: "video", url: "video", poster: "one" };
    expect(withImitationWorldCareGuide([photo("one"), video, photo("two"), photo("three")], true))
      .toEqual([photo("one"), photo("two"), photo(imitationWorldCareGuideUrl), video, photo("three")]);
  });
  it("does not manufacture product photos for an empty gallery", () => {
    expect(withImitationWorldCareGuide([], true)).toEqual([]);
  });
});