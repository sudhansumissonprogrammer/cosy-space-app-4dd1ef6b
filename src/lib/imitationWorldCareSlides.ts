import careGuideAsset from "@/assets/imitationworld/care-guide.webp.asset.json";
import chainPosterAsset from "@/assets/imitationworld/chain-poster-18k.webp.asset.json";
const careGuide = careGuideAsset as { url: string };
const chainPoster = chainPosterAsset as { url: string };

export type CareGallerySlide =
  | { kind: "image"; url: string }
  | { kind: "video"; url: string; poster: string };

export const imitationWorldCareGuideUrl = careGuide.url;
export const kalingaChainPosterUrl = chainPoster.url;

/**
 * Presentation-only: never add these posters to product data or category photos.
 * Slide order: photo 1, photo 2 (same photo repeated when there is only one),
 * 18K chain poster, jewellery care guide, then any remaining slides.
 */
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
  return [
    first,
    second,
    { kind: "image", url: chainPoster.url },
    { kind: "image", url: careGuide.url },
    ...remaining,
  ];
}
