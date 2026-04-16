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
import arrokHome from "@/assets/showcase-arrok-home.webp";
import arrokShop from "@/assets/showcase-arrok-shop.webp";
import arrokCategories from "@/assets/showcase-arrok-categories.webp";
import medivaHome from "@/assets/showcase-mediva-home.webp";
import medivaShop from "@/assets/showcase-mediva-shop.webp";
import medivaCategories from "@/assets/showcase-mediva-categories.webp";
import quickrashanHome from "@/assets/showcase-quickrashan-home.webp";
import quickrashanShop from "@/assets/showcase-quickrashan-shop.webp";
import quickrashanCategories from "@/assets/showcase-quickrashan-categories.webp";

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
    name: "Arrok",
    type: "Clothing Store",
    color: "bg-bauhaus-yellow",
    screens: [
      { label: "Home Page", img: arrokHome },
      { label: "Shop All", img: arrokShop },
      { label: "Categories", img: arrokCategories },
    ],
  },
  {
    name: "Mediva",
    type: "Health & Supplements",
    color: "bg-bauhaus-blue",
    screens: [
      { label: "Home Page", img: medivaHome },
      { label: "Shop All", img: medivaShop },
      { label: "Categories", img: medivaCategories },
    ],
  },
  {
    name: "QuickRashan",
    type: "Grocery Store",
    color: "bg-bauhaus-blue",
    screens: [
      { label: "Home Page", img: quickrashanHome },
      { label: "All Brands", img: quickrashanShop },
      { label: "Categories", img: quickrashanCategories },
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
    color: "bg-bauhaus-red",
    screens: [
      { label: "Home Page", img: overlaysHome },
      { label: "Product Page", img: overlaysProduct },
      { label: "Wishlist", img: overlaysWishlist },
    ],
  },
];

function StoreRow({ store, storeIdx }: { store: (typeof stores)[0]; storeIdx: number }) {
  return (
    <div className="py-6 sm:py-8">
      <div className="flex items-center gap-2 mb-4 px-5 sm:px-8 lg:px-12">
        <div className={`w-3.5 h-3.5 ${store.color} border-2 border-foreground rotate-45`} />
        <h3 className="font-black uppercase text-base sm:text-xl lg:text-2xl tracking-tight text-foreground">
          {store.name}
        </h3>
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground border-2 border-foreground px-1.5 py-0.5 ml-2">
          {store.type}
        </span>
      </div>
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex items-start gap-4 sm:gap-6 px-5 sm:px-8 lg:px-12 pb-2" style={{ width: "max-content" }}>
          {store.screens.map((screen, i) => (
            <div key={screen.label} className="flex flex-col items-center">
              <div className="w-[180px] sm:w-[210px] lg:w-[240px]">
                <div className="relative bg-foreground rounded-[22px] sm:rounded-[26px] p-[5px] sm:p-[6px] shadow-xl">
                  <div className="rounded-[17px] sm:rounded-[20px] overflow-hidden bg-background">
                    <img
                      src={screen.img}
                      alt={`${store.name} - ${screen.label}`}
                      className="w-full h-auto block"
                      loading={storeIdx === 0 && i === 0 ? "eager" : "lazy"}
                    />
                  </div>
                </div>
              </div>
              <span className="mt-2 font-bold uppercase tracking-wider text-[9px] sm:text-[10px] text-foreground">
                {screen.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const StoreLookShowcase = ({ showOverlays = true }: { showOverlays?: boolean }) => {
  const displayStores = showOverlays
    ? stores
    : stores.filter((s) => s.name !== "Overlays");

  return (
    <section id="showcase" className="border-b-4 border-foreground bg-bauhaus-white relative">
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(hsl(var(--foreground)) 1.5px, transparent 1.5px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="text-center pt-10 sm:pt-14 lg:pt-20 pb-2 sm:pb-4 px-5 sm:px-8 relative z-10">
        <span className="font-bold uppercase tracking-widest text-xs text-muted-foreground mb-2 block">
          Our Portfolio
        </span>
        <h2 className="font-black uppercase text-2xl sm:text-4xl lg:text-5xl tracking-tighter leading-[0.9] text-foreground">
          Stores We've
          <br />
          <span className="text-bauhaus-blue font-['Alegreya_SC',serif] italic">
            Built
          </span>
        </h2>
        <p className="mt-3 text-sm sm:text-base text-muted-foreground font-medium max-w-xl mx-auto">
          Real stores built by our team for real businesses across India.
        </p>
      </div>
      <div className="relative z-10 pb-8 sm:pb-12">
        {displayStores.map((store, storeIdx) => (
          <StoreRow key={store.name} store={store} storeIdx={storeIdx} />
        ))}
      </div>
    </section>
  );
};

export default StoreLookShowcase;
