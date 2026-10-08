import careGuide from "@/assets/imitationworld/care-guide.webp.asset.json";

export type CareGallerySlide =
  | { kind: "image"; url: string }
  | { kind: "video"; url: string; poster: string };

export const imitationWorldCareGuideUrl = careGuide.url;

/** Presentation-only: never add the guide to product data or category photos. */
export function withImitationWorldCareGuide<T extends CareGallerySlide>(
  slides: T[],
  enabled: boolean,
): Array<T | { kind: "image"; url: string }> {
  if (!enabled) return slides;
  const photos = slides.filter((slide) => slide.kind === "image");
  const first = photos[0];
  if (!first) return slides;
  const second = photos[1] ?? first;
  let skippedPhotos = 0;
  const remaining = slides.filter((slide) => {
    if (slide.kind !== "image") return true;
    skippedPhotos += 1;
    return skippedPhotos > 2;
  });
  return [first, second, { kind: "image", url: careGuide.url }, ...remaining];
}