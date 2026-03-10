interface StorefrontMobileHeroProps {
  mobileHeroUrl: string | null | undefined;
  storeName: string;
}

export default function StorefrontMobileHero({ mobileHeroUrl, storeName }: StorefrontMobileHeroProps) {
  if (!mobileHeroUrl) return null;

  return (
    <div className="block md:hidden">
      <img
        src={mobileHeroUrl}
        alt={`${storeName} hero banner`}
        className="w-full h-auto object-contain"
        loading="eager"
      />
    </div>
  );
}
