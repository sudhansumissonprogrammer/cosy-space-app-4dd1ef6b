import HeroBannerCarousel from "./HeroBannerCarousel";

interface StorefrontMobileHeroProps {
  mobileHeroUrl: string | null | undefined;
  mobileHeroImages?: string[] | null;
  storeName: string;
}

export default function StorefrontMobileHero({ mobileHeroUrl, mobileHeroImages, storeName }: StorefrontMobileHeroProps) {
  const slides: string[] = [];
  if (mobileHeroImages && mobileHeroImages.length > 0) {
    slides.push(...mobileHeroImages);
  } else if (mobileHeroUrl) {
    slides.push(mobileHeroUrl);
  }

  if (slides.length === 0) return null;

  return (
    <div className="block md:hidden">
      <HeroBannerCarousel
        images={slides}
        storeName={storeName}
        interval={2000}
        imageClassName="w-full h-auto object-contain"
      />
    </div>
  );
}

