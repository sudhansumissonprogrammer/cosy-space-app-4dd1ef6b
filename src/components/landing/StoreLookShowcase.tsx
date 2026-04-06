import { useRef, useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

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

gsap.registerPlugin(ScrollTrigger);

const stores = [
  {
    name: "Serdiya Jewellers",
    type: "Jewellery Store",
    color: "bg-bauhaus-red",
    screens: [
      { label: "Home Page", img: jewelryHome },
      { label: "Shop Page", img: jewelryShop },
      { label: "Product Page", img: jewelryProduct },
      { label: "Cart Page", img: jewelryCart },
    ],
  },
  {
    name: "Fashion Brand",
    type: "Clothing Store",
    color: "bg-bauhaus-yellow",
    screens: [
      { label: "Home Page", img: fashionHome },
      { label: "Best Selling", img: fashionCategory },
      { label: "Categories", img: fashionAllCategories },
      { label: "Search & Deals", img: fashionSearch },
    ],
  },
  {
    name: "Overlays",
    type: "Streetwear Store",
    color: "bg-bauhaus-blue",
    screens: [
      { label: "Home Page", img: overlaysHome },
      { label: "Product Page", img: overlaysProduct },
      { label: "Wishlist", img: overlaysWishlist },
    ],
  },
];

function HorizontalScrollStore({
  store,
  storeIdx,
}: {
  store: (typeof stores)[0];
  storeIdx: number;
}) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return;

    const ctx = gsap.context(() => {
      // How far the track needs to travel
      const getScrollAmount = () => track.scrollWidth - window.innerWidth;

      const tween = gsap.to(track, {
        x: () => -getScrollAmount(),
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: () => `+=${getScrollAmount()}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          anticipatePin: 1,
        },
      });

      // Subtle scale animation on each card
      const cards = track.querySelectorAll(".phone-card");
      cards.forEach((card) => {
        gsap.fromTo(
          card,
          { scale: 0.92, opacity: 0.6 },
          {
            scale: 1,
            opacity: 1,
            ease: "power2.out",
            scrollTrigger: {
              trigger: card,
              containerAnimation: tween,
              start: "left 80%",
              end: "left 40%",
              scrub: true,
            },
          }
        );
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={sectionRef} className="relative overflow-hidden">
      {/* Horizontal track */}
      <div
        ref={trackRef}
        className="flex items-center h-screen will-change-transform"
        style={{ width: "max-content" }}
      >
        {/* Leading space with store header */}
        <div className="flex-shrink-0 w-screen h-full flex flex-col justify-center px-6 sm:px-10 lg:px-16">
          <div className="max-w-lg">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-5 h-5 ${store.color} border-2 border-foreground rotate-45`}
              />
              <h3 className="font-black uppercase text-2xl sm:text-3xl lg:text-4xl tracking-tight text-foreground">
                {store.name}
              </h3>
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-2 border-foreground px-3 py-1 inline-block">
              {store.type}
            </span>
            <p className="mt-4 text-sm sm:text-base text-muted-foreground font-medium">
              Scroll to explore every page of this store →
            </p>
          </div>
        </div>

        {/* Phone cards */}
        {store.screens.map((screen, i) => (
          <div
            key={screen.label}
            className="phone-card flex-shrink-0 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8"
          >
            <div className="relative w-[220px] sm:w-[250px] lg:w-[280px]">
              <div className="bg-foreground rounded-[28px] sm:rounded-[32px] p-[7px] sm:p-[8px] shadow-2xl">
                {/* Notch */}
                <div className="absolute top-[7px] sm:top-[8px] left-1/2 -translate-x-1/2 w-20 sm:w-24 h-5 sm:h-6 bg-foreground rounded-b-2xl z-20" />
                {/* Screen */}
                <div className="rounded-[21px] sm:rounded-[24px] overflow-hidden bg-background">
                  <img
                    src={screen.img}
                    alt={`${store.name} - ${screen.label}`}
                    className="w-full h-auto block"
                    loading={storeIdx === 0 && i === 0 ? "eager" : "lazy"}
                  />
                </div>
              </div>
              {/* Reflection glow */}
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-3/4 h-8 bg-foreground/10 rounded-full blur-xl" />
            </div>
            <span className="mt-5 font-bold uppercase tracking-[0.2em] text-xs sm:text-sm text-foreground">
              {screen.label}
            </span>
          </div>
        ))}

        {/* Trailing space */}
        <div className="flex-shrink-0 w-[20vw]" />
      </div>
    </div>
  );
}

const StoreLookShowcase = ({
  showOverlays = true,
}: {
  showOverlays?: boolean;
}) => {
  const displayStores = showOverlays
    ? stores
    : stores.filter((s) => s.name !== "Overlays");

  return (
    <section
      id="showcase"
      className="border-b-4 border-foreground bg-bauhaus-white relative"
    >
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(hsl(var(--foreground)) 1.5px, transparent 1.5px)",
          backgroundSize: "24px 24px",
        }}
      />
      {/* Section header */}
      <div className="text-center pt-14 sm:pt-20 lg:pt-24 pb-4 sm:pb-6 px-5 sm:px-8 relative z-10">
        <span className="font-bold uppercase tracking-widest text-xs text-muted-foreground mb-2 block">
          Mobile Optimized
        </span>
        <h2 className="font-black uppercase text-3xl sm:text-4xl lg:text-6xl tracking-tighter leading-[0.9] text-foreground">
          How Your Store
          <br />
          <span className="text-bauhaus-blue font-['Alegreya_SC',serif] italic">
            Actually Looks
          </span>
        </h2>
        <p className="mt-4 text-sm sm:text-base text-muted-foreground font-medium max-w-xl mx-auto">
          Beautiful, fast, mobile-first stores that your customers will love.
          Every page is optimized for conversions.
        </p>
      </div>

      {/* Horizontal scroll sections */}
      <div className="relative z-10">
        {displayStores.map((store, storeIdx) => (
          <HorizontalScrollStore
            key={store.name}
            store={store}
            storeIdx={storeIdx}
          />
        ))}
      </div>
    </section>
  );
};

export default StoreLookShowcase;
