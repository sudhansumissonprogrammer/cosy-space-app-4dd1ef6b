import { ExternalLink, ArrowRight } from "lucide-react";
import overlaysMobile from "@/assets/showcase-overlays-mobile.webp";
import serdiyaMobile from "@/assets/showcase-serdiya-mobile.webp";
import arrokMobile from "@/assets/showcase-arrok-mobile.webp";
import medivaMobile from "@/assets/showcase-mediva-mobile.webp";

const WA_LINK = "https://wa.me/919692282485?text=Hi!%20I%20want%20to%20get%20my%20online%20store%20built";

const stores = [
  { name: "Serdiya Jewellers", category: "Jewellery Store", url: "https://serdiyajewellers.shop", img: serdiyaMobile },
  { name: "Arrok", category: "Clothing Store", url: "https://arrok.shopbanao.in", img: arrokMobile },
  { name: "Mediva", category: "Health & Supplements", url: "https://mediva.shopbanao.in", img: medivaMobile },
  { name: "Overlays", category: "Streetwear & Fashion", url: "https://overlays.shopbanao.in", img: overlaysMobile },
];

const PhoneFrame = ({ store }: { store: (typeof stores)[0] }) => (
  <a
    href={store.url}
    target="_blank"
    rel="noopener noreferrer"
    onClick={(e) => { e.preventDefault(); window.open(store.url, "_blank", "noopener,noreferrer"); }}
    className="group flex flex-col items-center"
  >
    <div className="relative w-[180px] sm:w-[210px] lg:w-[240px]">
      <div className="bg-foreground rounded-[28px] sm:rounded-[32px] p-[5px] sm:p-[6px] shadow-2xl transition-transform duration-500 group-hover:scale-[1.03] group-hover:-translate-y-2">
        <div className="absolute top-[5px] sm:top-[6px] left-1/2 -translate-x-1/2 w-16 sm:w-20 h-4 bg-foreground rounded-b-2xl z-20" />
        <div className="rounded-[23px] sm:rounded-[26px] overflow-hidden bg-background">
          <img src={store.img} alt={`${store.name} live store preview`} className="w-full h-auto block" loading="lazy" />
        </div>
      </div>
      <div className="absolute inset-0 rounded-[28px] sm:rounded-[32px] bg-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-30">
        <span className="flex items-center gap-2 bg-bauhaus-white text-foreground font-bold text-xs sm:text-sm uppercase tracking-wider px-5 py-2.5 border-2 border-foreground shadow-bauhaus">
          Visit Store <ExternalLink className="h-4 w-4" />
        </span>
      </div>
    </div>
    <div className="mt-4 text-center">
      <h3 className="font-bold text-base sm:text-lg text-foreground">{store.name}</h3>
      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{store.category}</p>
      <span className="inline-flex items-center gap-1 mt-2 text-bauhaus-red font-bold text-[11px] sm:text-xs uppercase tracking-wider group-hover:underline">
        View Live Store <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
      </span>
    </div>
  </a>
);

const LiveStorePreview = () => {
  return (
    <section className="py-14 sm:py-20 border-b-4 border-foreground bg-bauhaus-yellow/20">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 border-2 border-foreground px-3 py-1.5 mb-4 shadow-bauhaus-sm bg-bauhaus-white w-fit mx-auto">
            <span className="font-bold uppercase tracking-widest text-[10px] sm:text-xs text-foreground">
              Our Portfolio
            </span>
          </div>
          <h2 className="font-black text-2xl sm:text-3xl lg:text-4xl tracking-tight text-foreground mb-3">
            Stores We've Delivered
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto">
            Real stores, built by our team for real businesses — tap to explore them live.
          </p>
        </div>

        <div className="flex flex-wrap items-start justify-center gap-8 sm:gap-10 lg:gap-14">
          {stores.map((store) => (
            <PhoneFrame key={store.name} store={store} />
          ))}
        </div>

        <div className="text-center mt-10 sm:mt-14">
          <a
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-bauhaus-red text-primary-foreground font-bold uppercase tracking-wider text-xs sm:text-sm px-6 sm:px-8 py-3 sm:py-3.5 border-2 border-foreground shadow-bauhaus hover:bg-bauhaus-red/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-200"
          >
            Get Yours Built <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
};

export default LiveStorePreview;
