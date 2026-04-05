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
  { name: "Serdiya Jewellers", type: "Jewellery Store", screens: [{ label: "Home Page", img: jewelryHome }, { label: "Shop Page", img: jewelryShop }, { label: "Product Page", img: jewelryProduct }, { label: "Cart Page", img: jewelryCart }] },
  { name: "Fashion Brand", type: "Clothing Store", screens: [{ label: "Home Page", img: fashionHome }, { label: "Best Selling", img: fashionCategory }, { label: "Categories", img: fashionAllCategories }, { label: "Search & Deals", img: fashionSearch }] },
  { name: "Overlays", type: "Streetwear Store", screens: [{ label: "Home Page", img: overlaysHome }, { label: "Product Page", img: overlaysProduct }, { label: "Wishlist", img: overlaysWishlist }] },
];

const StoreLookShowcase = ({ showOverlays = true }: { showOverlays?: boolean }) => {
  const displayStores = showOverlays ? stores : stores.filter(s => s.name !== "Overlays");
  return (
    <section id="showcase" className="border-b-4 border-foreground bg-bauhaus-white py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(hsl(var(--foreground)) 1.5px, transparent 1.5px)", backgroundSize: "24px 24px" }} />
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-10 sm:mb-16">
          <span className="font-bold uppercase tracking-widest text-xs text-muted-foreground mb-2 block">Mobile Optimized</span>
          <h2 className="font-black uppercase text-3xl sm:text-4xl lg:text-6xl tracking-tighter leading-[0.9] text-foreground">
            How Your Store<br /><span className="text-bauhaus-blue font-['Alegreya_SC',serif] italic">Actually Looks</span>
          </h2>
          <p className="mt-4 text-sm sm:text-base text-muted-foreground font-medium max-w-xl mx-auto">
            Beautiful, fast, mobile-first stores that your customers will love. Every page is optimized for conversions.
          </p>
        </div>
        {displayStores.map((store, storeIdx) => (
          <div key={store.name} className={`${storeIdx > 0 ? "mt-12 sm:mt-20" : ""}`}>
            <div className="flex items-center gap-3 mb-6 sm:mb-8">
              <div className={`w-4 h-4 ${storeIdx === 0 ? "bg-bauhaus-red" : storeIdx === 1 ? "bg-bauhaus-yellow" : "bg-bauhaus-blue"} border-2 border-foreground rotate-45`} />
              <h3 className="font-black uppercase text-lg sm:text-2xl tracking-tight text-foreground">{store.name}</h3>
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-2 border-foreground px-2 py-0.5">{store.type}</span>
            </div>
            <div className="flex gap-4 sm:gap-6 lg:gap-8 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide justify-start lg:justify-center">
              {store.screens.map((screen) => (
                <div key={screen.label} className="flex-shrink-0 snap-center flex flex-col items-center">
                  <div className="relative w-[200px] sm:w-[220px] lg:w-[260px]">
                    <div className="bg-foreground rounded-[24px] sm:rounded-[28px] p-[6px] sm:p-[8px] shadow-bauhaus-lg">
                      <div className="absolute top-[6px] sm:top-[8px] left-1/2 -translate-x-1/2 w-16 sm:w-20 h-4 sm:h-5 bg-foreground rounded-b-xl z-20" />
                      <div className="rounded-[18px] sm:rounded-[20px] overflow-hidden bg-background">
                        <img src={screen.img} alt={`${store.name} - ${screen.label}`} className="w-full h-auto block" loading="lazy" />
                      </div>
                    </div>
                  </div>
                  <span className="mt-3 font-bold uppercase tracking-wider text-xs text-foreground">{screen.label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default StoreLookShowcase;
