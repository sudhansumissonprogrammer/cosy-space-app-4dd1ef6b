// Eager glob — Vite resolves all matching assets at build time as a single
// module entry, avoiding 17 parallel preload requests that occasionally
// trigger "Failed to fetch dynamically imported module" in the dev sandbox.
const _showcaseAssets = import.meta.glob("@/assets/showcase-*.webp", {
  eager: true,
  import: "default",
}) as Record<string, string>;
const _img = (name: string): string => {
  const key = Object.keys(_showcaseAssets).find((k) => k.endsWith(`/${name}`));
  return key ? _showcaseAssets[key] : "";
};
const jewelryHome = _img("showcase-jewelry-home.webp");
const jewelryProduct = _img("showcase-jewelry-product.webp");
const jewelryCart = _img("showcase-jewelry-cart.webp");
const jewelryShop = _img("showcase-jewelry-shop.webp");
const fashionHome = _img("showcase-fashion-home.webp");
const fashionCategory = _img("showcase-fashion-category.webp");
const fashionAllCategories = _img("showcase-fashion-allcategories.webp");
const fashionSearch = _img("showcase-fashion-search.webp");
const overlaysHome = _img("showcase-overlays-home.webp");
const overlaysProduct = _img("showcase-overlays-product.webp");
const overlaysWishlist = _img("showcase-overlays-wishlist.webp");
const arrokHome = _img("showcase-arrok-home.webp");
const arrokShop = _img("showcase-arrok-shop.webp");
const arrokCategories = _img("showcase-arrok-categories.webp");
const medivaHome = _img("showcase-mediva-home.webp");
const medivaShop = _img("showcase-mediva-shop.webp");
const medivaCategories = _img("showcase-mediva-categories.webp");

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
      {/* Store label */}
      <div className="flex items-center gap-2 mb-4 px-5 sm:px-8 lg:px-12">
        <div className={`w-3.5 h-3.5 ${store.color} border-2 border-foreground rotate-45`} />
        <h3 className="font-black uppercase text-base sm:text-xl lg:text-2xl tracking-tight text-foreground">
          {store.name}
        </h3>
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground border-2 border-foreground px-1.5 py-0.5 ml-2">
          {store.type}
        </span>
      </div>

      {/* Horizontally scrollable phone cards */}
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
                      loading="lazy"
                      decoding="async"
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

      {/* Section header */}
      <div className="text-center pt-10 sm:pt-14 lg:pt-20 pb-2 sm:pb-4 px-5 sm:px-8 relative z-10">
        <span className="font-bold uppercase tracking-widest text-xs text-muted-foreground mb-2 block">
          Mobile Optimized
        </span>
        <h2 className="font-black uppercase text-2xl sm:text-4xl lg:text-5xl tracking-tighter leading-[0.9] text-foreground">
          How Your Store
          <br />
          <span className="text-bauhaus-blue font-['Alegreya_SC',serif] italic">
            Actually Looks
          </span>
        </h2>
        <p className="mt-3 text-sm sm:text-base text-muted-foreground font-medium max-w-xl mx-auto">
          Beautiful, fast, mobile-first stores your customers will love.
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
