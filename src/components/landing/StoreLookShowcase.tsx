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
        <div className="flex-shrink-0 w-[50vw] sm:w-[40vw] lg:w-[30vw] h-full flex flex-col justify-center pl-5 sm:pl-8 lg:pl-12 pr-2">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-4 h-4 ${store.color} border-2 border-foreground rotate-45`} />
            <h3 className="font-black uppercase text-lg sm:text-2xl lg:text-3xl tracking-tight text-foreground">{store.name}</h3>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-2 border-foreground px-2 py-0.5 inline-block w-fit">{store.type}</span>
        </div>

        {/* Phone cards */}
        {store.screens.map((screen, i) => (
          <div
            key={screen.label}
            className="phone-card flex-shrink-0 flex flex-col items-center justify-center px-2 sm:px-3 lg:px-5"
          >
            <div className="relative w-[180px] sm:w-[210px] lg:w-[240px]">
              <div className="bg-foreground rounded-[22px] sm:rounded-[26px] p-[5px] sm:p-[7px] shadow-2xl">
                <div className="absolute top-[5px] sm:top-[7px] left-1/2 -translate-x-1/2 w-14 sm:w-18 h-3.5 sm:h-4 bg-foreground rounded-b-xl z-20" />
                <div className="rounded-[17px] sm:rounded-[19px] overflow-hidden bg-background">
                  <img src={screen.img} alt={`${store.name} - ${screen.label}`} className="w-full h-auto block" loading={storeIdx === 0 && i === 0 ? "eager" : "lazy"} />
                </div>
              </div>
            </div>
            <span className="mt-3 font-bold uppercase tracking-wider text-[10px] sm:text-xs text-foreground">{screen.label}</span>
          </div>
        ))}

        {/* Trailing space */}
        <div className="flex-shrink-0 w-[10vw]" />
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
