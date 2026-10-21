import careGuideAsset from "@/assets/imitationworld/care-guide.webp.asset.json";
const careGuide = careGuideAsset as { url: string };

export type CareGallerySlide =
  | { kind: "image"; url: string }
  | { kind: "video"; url: string; poster: string };

export const imitationWorldCareGuideUrl = careGuide.url;

export function isKalingaInformationalSlide(url: string): boolean {
  return url === imitationWorldCareGuideUrl;
}

/**
 * Presentation-only: never add these posters to product data or category photos.
 * Slide order: photo 1, photo 2 (same photo repeated when there is only one),
 * then remaining slides, and the jewellery care guide always last.
 */
export function withImitationWorldCareGuide<T extends CareGallerySlide>(
  slides: T[],
  enabled: boolean,
  product?: { slug?: string | null; category?: string | null },
): Array<T | { kind: "image"; url: string }> {
  if (!enabled) return slides;
  const cleanSlides = slides.filter(slide => !isKalingaInformationalSlide(slide.url));
  const photos = cleanSlides.filter((slide) => slide.kind === "image");
  const first = photos[0];
  if (!first) return slides;
  const second = photos[1] ?? first;
  let skippedPhotos = 0;
  const remaining = cleanSlides.filter((slide) => {
    if (slide.kind !== "image") return true;
    skippedPhotos += 1;
    return skippedPhotos > 2;
  });
  return [
    first,
    second,
    ...remaining,
    { kind: "image", url: careGuide.url },
  ];
}
