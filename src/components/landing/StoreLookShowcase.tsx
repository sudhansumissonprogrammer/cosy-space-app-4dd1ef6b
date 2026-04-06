import { useRef, useEffect, useState, useCallback } from "react";
import jewelryHome from "@/assets/showcase-jewelry-home.webp";
import jewelryProduct from "@/assets/showcase-jewelry-product.webp";
import jewelryCart from "@/assets/showcase-jewelry-cart.webp";
import jewelryShop from "@/assets/showcase-jewelry-shop.webp";
import fashionHome from "@/assets/showcase-fashion-home.webp";
import fashionCategory from "@/assets/showcase-fashion-category.webp";
import fashionAllCategories from "@/assets/showcase-fashion-allcategories.webp";
import fashionSearch from "@/assets/showcase-fashion-search.webp";
import overlaysHome from "@/assets/showcase-overlays-home.webp";
import overlaysProduct from "@/assets/showcase-overlays-product.webp";
import overlaysWishlist from "@/assets/showcase-overlays-wishlist.webp";

const stores = [
  { name: "Serdiya Jewellers", type: "Jewellery Store", color: "bg-bauhaus-red", screens: [{ label: "Home Page", img: jewelryHome }, { label: "Shop Page", img: jewelryShop }, { label: "Product Page", img: jewelryProduct }, { label: "Cart Page", img: jewelryCart }] },
  { name: "Fashion Brand", type: "Clothing Store", color: "bg-bauhaus-yellow", screens: [{ label: "Home Page", img: fashionHome }, { label: "Best Selling", img: fashionCategory }, { label: "Categories", img: fashionAllCategories }, { label: "Search & Deals", img: fashionSearch }] },
  { name: "Overlays", type: "Streetwear Store", color: "bg-bauhaus-blue", screens: [{ label: "Home Page", img: overlaysHome }, { label: "Product Page", img: overlaysProduct }, { label: "Wishlist", img: overlaysWishlist }] },
];

const CARD_WIDTH_MOBILE = 216; // 200px + gap
const CARD_WIDTH_DESKTOP = 284; // 260px + gap

function HorizontalScrollStore({ store, storeIdx }: { store: typeof stores[0]; storeIdx: number }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  const handleScroll = useCallback(() => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const trackHeight = trackRef.current.offsetHeight;
    const vh = window.innerHeight;
    // progress: 0 when top of track hits top of viewport, 1 when bottom - vh reaches top
    const scrollable = trackHeight - vh;
    if (scrollable <= 0) return;
    const p = Math.min(1, Math.max(0, -rect.top / scrollable));
    setProgress(p);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const screenCount = store.screens.length;
  // On mobile we need enough height for the horizontal travel
  // Each "extra" screen beyond the viewport needs ~100vh of scroll
  const scrollMultiplier = Math.max(screenCount - 1, 1);
  const trackHeight = `${(scrollMultiplier + 1) * 100}vh`;

  return (
    <div ref={trackRef} style={{ height: trackHeight }} className="relative">
      <div className="sticky top-0 h-screen flex flex-col justify-center overflow-hidden">
        {/* Store header */}
        <div className="flex items-center gap-3 mb-5 sm:mb-6 px-4 sm:px-6 lg:px-8">
          <div className={`w-4 h-4 ${store.color} border-2 border-foreground rotate-45`} />
          <h3 className="font-black uppercase text-lg sm:text-2xl tracking-tight text-foreground">{store.name}</h3>
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-2 border-foreground px-2 py-0.5">{store.type}</span>
        </div>

        {/* Horizontally translating container */}
        <div className="relative w-full">
          <div
            className="flex gap-4 sm:gap-6 lg:gap-8 pl-4 sm:pl-6 lg:pl-8 transition-none will-change-transform"
            style={{
              transform: `translateX(-${progress * (screenCount - 1) * (typeof window !== "undefined" && window.innerWidth >= 1024 ? CARD_WIDTH_DESKTOP : CARD_WIDTH_MOBILE)}px)`,
            }}
          >
            {store.screens.map((screen) => (
              <div key={screen.label} className="flex-shrink-0 flex flex-col items-center">
                <div className="relative w-[200px] sm:w-[220px] lg:w-[260px]">
                  <div className="bg-foreground rounded-[24px] sm:rounded-[28px] p-[6px] sm:p-[8px] shadow-bauhaus-lg">
                    <div className="absolute top-[6px] sm:top-[8px] left-1/2 -translate-x-1/2 w-16 sm:w-20 h-4 sm:h-5 bg-foreground rounded-b-xl z-20" />
                    <div className="rounded-[18px] sm:rounded-[20px] overflow-hidden bg-background">
                      <img src={screen.img} alt={`${store.name} - ${screen.label}`} className="w-full h-auto block" loading={storeIdx === 0 ? "eager" : "lazy"} />
                    </div>
                  </div>
                </div>
                <span className="mt-3 font-bold uppercase tracking-wider text-xs text-foreground">{screen.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll progress dots */}
        <div className="flex justify-center gap-2 mt-5">
          {store.screens.map((_, i) => {
            const dotProgress = Math.min(1, Math.max(0, progress * (screenCount - 1) - i + 1));
            return (
              <div
                key={i}
                className={`h-2 rounded-full border border-foreground transition-all duration-200 ${
                  dotProgress > 0.5 ? store.color : "bg-muted"
                }`}
                style={{ width: dotProgress > 0.5 ? "24px" : "8px" }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

const StoreLookShowcase = ({ showOverlays = true }: { showOverlays?: boolean }) => {
  const displayStores = showOverlays ? stores : stores.filter(s => s.name !== "Overlays");
  return (
    <section id="showcase" className="border-b-4 border-foreground bg-bauhaus-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1.5px, transparent 1.5px)", backgroundSize: "24px 24px" }} />
      <div className="relative z-10">
        <div className="text-center py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8">
          <span className="font-bold uppercase tracking-widest text-xs text-muted-foreground mb-2 block">Mobile Optimized</span>
          <h2 className="font-black uppercase text-3xl sm:text-4xl lg:text-6xl tracking-tighter leading-[0.9] text-foreground">
            How Your Store<br /><span className="text-bauhaus-blue font-['Alegreya_SC',serif] italic">Actually Looks</span>
          </h2>
          <p className="mt-4 text-sm sm:text-base text-muted-foreground font-medium max-w-xl mx-auto">
            Beautiful, fast, mobile-first stores that your customers will love. Every page is optimized for conversions.
          </p>
        </div>
        {displayStores.map((store, storeIdx) => (
          <HorizontalScrollStore key={store.name} store={store} storeIdx={storeIdx} />
        ))}
      </div>
    </section>
  );
};

export default StoreLookShowcase;
