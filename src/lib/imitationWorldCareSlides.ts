import careGuideAsset from "@/assets/imitationworld/care-guide.webp.asset.json";
import chainPosterAsset from "@/assets/imitationworld/chain-poster.webp.asset.json";
const careGuide = careGuideAsset as { url: string };

export type CareGallerySlide =
  | { kind: "image"; url: string }
  | { kind: "video"; url: string; poster: string };

export const imitationWorldCareGuideUrl = careGuide.url;
export const kalingaChainPosterUrl = chainPosterAsset.url;
export const kalingaChainPosterExcludedSlugs = new Set([
  "hanumanji-gold-plated-chain-locket-8zmrfl",
  "maa-letter-locket-gold-brass-pendant-necklace-chain-for-men-and-women-pendants-l-32t59n",
  "om-gold-nackless-chain-gduv9j",
  "premium-gold-plated-rectangular-om-pendant-chain-unisex-religious-gold-locket-fe-hl6odp",
  "gold-plated-religious-om-pendant-with-sleek-snake-chain-for-men-and-women-i2wctd",
  "trending-stylish-new-hindu-religious-gold-plated-brass-shree-balaji-bajrangbali--erttoc",
  "durga-maa-divine-gold-plated-pendant-with-rope-chain-gippbr",
  "durga-maa-divine-gold-plated-pendant-with-rope-chain-gippbq",
  "micro-gold-plated-granted-polish-new-krishna-locket-with-chain-multi-colour-kris-fao53n",
  "gold-plated-maa-pendant-with-chain-round-mother-locket-mom-written-necklace-for--c0zq24",
  "stylish-fancy-gold-plated-alloy-neck-chain-92vwt3",
  "om-kada-with-maa-chains-pandal-set-93bjk",
  "five-face-original-rudraksh-gold-plated-mala-with-om-trisul-in-men-fashion-authe-abene9",
  "rudraksha-chain-with-om-tilak-gold-plated-locket-gold-plated-plated-brass-chain-atmql4",
  "rudraksha-bracelet-trishul-pendant-necklace-combo-for-men-gold-plated-mahadev-je-gohhhv",
  "free-size-ex16hz",
  "shree-om-5-mukhi-rudraksha-locket-with-chain-92y1iw",
  "free-size-ex16hg",
]);

export function isKalingaInformationalSlide(url: string): boolean {
  return url === imitationWorldCareGuideUrl || url === kalingaChainPosterUrl;
}

/**
 * Presentation-only: never add these posters to product data or category photos.
 * Slide order: photo 1, photo 2 (same photo repeated when there is only one),
 * then the eligible chain poster third, remaining slides, and care guide last.
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
    ...(product?.category?.trim().toLowerCase() === "chain with pendant"
      && product.slug && !kalingaChainPosterExcludedSlugs.has(product.slug)
      ? [{ kind: "image" as const, url: kalingaChainPosterUrl }] : []),
    ...remaining,
    { kind: "image", url: careGuide.url },
  ];
}
