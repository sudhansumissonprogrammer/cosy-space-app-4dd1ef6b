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

function HeroCarousel({ slides, storeName }: { slides: string[]; storeName: string }) {
  const [current, setCurrent] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = useCallback((idx: number) => {
    setCurrent((idx + slides.length) % slides.length);
  }, [slides.length]);

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  // Auto-play
  useEffect(() => {
    intervalRef.current = setInterval(next, 4000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [next]);

  // Pause on touch
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = e.changedTouches[0].clientX - touchStart;
    if (Math.abs(diff) > 50) {
      if (diff < 0) next(); else prev();
    }
    setTouchStart(null);
    intervalRef.current = setInterval(next, 4000);
  };

  return (
    <div className="relative overflow-hidden">
      {/* Slides container */}
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {slides.map((url, i) => (
          <div key={i} className="w-full flex-shrink-0">
            <img
              src={optimizeImageUrl(url, 800)}
              alt={`${storeName} hero banner ${i + 1}`}
              className="w-full h-auto object-contain"
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : undefined}
            />
          </div>
        ))}
      </div>

      {/* Side arrows */}
      <button
        onClick={prev}
        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
        aria-label="Previous slide"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        onClick={next}
        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
        aria-label="Next slide"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === current ? "w-5 bg-white" : "w-2 bg-white/50"
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
