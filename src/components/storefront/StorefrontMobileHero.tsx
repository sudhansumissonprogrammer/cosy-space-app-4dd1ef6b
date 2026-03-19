import HeroBannerCarousel from "./HeroBannerCarousel";

interface StorefrontMobileHeroProps {
  mobileHeroUrl: string | null | undefined;
  mobileHeroImages?: unknown;
  storeName: string;
}

function normalizeHeroImages(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return [];

    if (raw.startsWith("[") && raw.endsWith("]")) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean);
        }
      } catch {
        // fall back to comma-split below
      }
    }

    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export default function StorefrontMobileHero({ mobileHeroUrl, mobileHeroImages, storeName }: StorefrontMobileHeroProps) {
  const slides = normalizeHeroImages(mobileHeroImages);

  if (slides.length === 0 && mobileHeroUrl?.trim()) {
    slides.push(mobileHeroUrl.trim());
  }

  if (slides.length === 0) return null;

  return (
    <div className="group">
      <HeroBannerCarousel
        images={slides}
        storeName={storeName}
        interval={2000}
        imageClassName="w-full h-auto object-contain"
      />
    </div>
  );
}

