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

function HorizontalScrollStore({ store, storeIdx }: { store: typeof stores[0]; storeIdx: number }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  const handleScroll = useCallback(() => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const trackHeight = trackRef.current.offsetHeight;
    const vh = window.innerHeight;
    const scrollable = trackHeight - vh;
    if (scrollable <= 0) return;
    const p = Math.min(1, Math.max(0, -rect.top / scrollable));
    setProgress(p);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const screenCount = store.screens.length;
  // Shorter scroll distance: each extra screen = 40vh of scroll
  const extraScreens = Math.max(screenCount - 1, 1);
  const trackHeightVh = 100 + extraScreens * 40;

  // Calculate how far to translate: total strip width - viewport width
  const [maxTranslate, setMaxTranslate] = useState(0);
  useEffect(() => {
    const measure = () => {
      if (stripRef.current) {
        const stripW = stripRef.current.scrollWidth;
        const viewW = window.innerWidth;
        setMaxTranslate(Math.max(0, stripW - viewW + 16));
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div ref={trackRef} style={{ height: `${trackHeightVh}vh` }} className="relative">
      <div className="sticky top-0 h-screen flex flex-col justify-center overflow-hidden">
        {/* Store header */}
        <div className="flex items-center gap-3 mb-4 sm:mb-5 px-5 sm:px-8 lg:px-12">
          <div className={`w-4 h-4 ${store.color} border-2 border-foreground rotate-45`} />
          <h3 className="font-black uppercase text-lg sm:text-2xl tracking-tight text-foreground">{store.name}</h3>
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-2 border-foreground px-2 py-0.5">{store.type}</span>
        </div>

        {/* Horizontally translating strip */}
        <div className="w-full overflow-hidden">
          <div
            ref={stripRef}
            className="flex gap-4 sm:gap-6 lg:gap-8 pl-5 sm:pl-8 lg:pl-12 pr-8"
            style={{
              transform: `translateX(-${progress * maxTranslate}px)`,
              willChange: "transform",
            }}
          >
            {store.screens.map((screen) => (
              <div key={screen.label} className="flex-shrink-0 flex flex-col items-center">
                <div className="relative w-[180px] sm:w-[210px] lg:w-[240px]">
                  <div className="bg-foreground rounded-[22px] sm:rounded-[26px] p-[5px] sm:p-[7px] shadow-bauhaus-lg">
                    <div className="absolute top-[5px] sm:top-[7px] left-1/2 -translate-x-1/2 w-14 sm:w-18 h-3.5 sm:h-4 bg-foreground rounded-b-xl z-20" />
                    <div className="rounded-[17px] sm:rounded-[19px] overflow-hidden bg-background">
                      <img src={screen.img} alt={`${store.name} - ${screen.label}`} className="w-full h-auto block" loading={storeIdx === 0 ? "eager" : "lazy"} />
                    </div>
                  </div>
                </div>
                <span className="mt-2.5 font-bold uppercase tracking-wider text-[10px] sm:text-xs text-foreground">{screen.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mt-4">
          {store.screens.map((_, i) => {
            const activeIndex = progress * (screenCount - 1);
            const isActive = Math.abs(activeIndex - i) < 0.5;
            return (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${isActive ? store.color : "bg-foreground/20"}`}
                style={{ width: isActive ? "20px" : "6px" }}
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
        <div className="text-center pt-12 sm:pt-16 lg:pt-20 pb-6 sm:pb-8 px-5 sm:px-8">
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
