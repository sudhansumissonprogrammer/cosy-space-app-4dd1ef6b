import { ArrowRight, ShieldCheck, CreditCard, Globe, Package, TrendingUp, ExternalLink } from "lucide-react";
import overlaysMobile from "@/assets/showcase-overlays-mobile.png";
import serdiyaMobile from "@/assets/showcase-serdiya-mobile.png";

const liveStores = [
  { img: overlaysMobile, label: "Overlays", url: "https://overlays.shopbanao.in" },
  { img: serdiyaMobile, label: "Serdiya Jewellers", url: "https://serdiyajewellers.shop" },
];

const PhoneMockup = ({ img, label, url, className = "" }: { img: string; label: string; url: string; className?: string }) => (
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    className={`group flex flex-col items-center ${className}`}
  >
    <div className="relative w-full">
      <div className="bg-foreground rounded-[22px] sm:rounded-[26px] lg:rounded-[28px] p-[3px] sm:p-[3px] shadow-2xl transition-transform duration-500 group-hover:scale-[1.03] group-hover:-translate-y-1">
        <div className="absolute top-[3px] left-1/2 -translate-x-1/2 w-10 sm:w-12 lg:w-14 h-2.5 sm:h-3 bg-foreground rounded-b-lg z-20" />
        <div className="rounded-[19px] sm:rounded-[23px] lg:rounded-[25px] overflow-hidden">
          <img src={img} alt={`${label} live store`} className="w-full h-auto block" />
        </div>
      </div>
      {/* Hover overlay */}
      <div className="absolute inset-0 rounded-[22px] sm:rounded-[26px] lg:rounded-[28px] bg-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-30">
        <span className="flex items-center gap-1.5 bg-bauhaus-white text-foreground font-bold text-[9px] sm:text-[10px] uppercase tracking-wider px-3 py-1.5 border-2 border-foreground shadow-bauhaus">
          Visit Store <ExternalLink className="h-3 w-3" />
        </span>
      </div>
    </div>
    <span className="mt-2 lg:mt-3 font-bold uppercase tracking-wider text-[9px] sm:text-[10px] text-white/80 group-hover:underline">{label}</span>
  </a>
);

const heroVariants = [
  {
    headline: <>Stop Paying 25% Commission —<br />Launch Your Own Store with <span className="text-bauhaus-red italic" style={{ fontFamily: "'Alegreya SC', serif", fontWeight: 700, fontSize: '1.15em' }}>ShopBanao</span></>,
    sub: "Keep 100% of your revenue. Your own online store with custom domain, UPI payments — live in 10 minutes.",
  },
  {
    headline: <>Build your store within minutes using<br /><span className="text-bauhaus-red italic" style={{ fontFamily: "'Alegreya SC', serif", fontWeight: 700, fontSize: '1.15em' }}>ShopBanao</span></>,
    sub: "Create your own professional online store with custom domain, UPI payments, and zero commission. Start selling in minutes.",
  },
];

const Hero = () => {
  // Simple A/B: variant 0 (outcome-based) vs variant 1 (original)
  const variant = typeof window !== "undefined"
    ? (parseInt(localStorage.getItem("hero_ab") ?? String(Math.random() < 0.5 ? 0 : 1)) || 0)
    : 0;

  if (typeof window !== "undefined" && !localStorage.getItem("hero_ab")) {
    localStorage.setItem("hero_ab", String(variant));
  }

  const { headline, sub } = heroVariants[variant] ?? heroVariants[0];

  return (
    <section className="border-b-4 border-foreground">
      <div className="px-5 sm:px-8 lg:px-12 xl:px-16 py-14 sm:py-16 lg:py-0 min-h-[72svh] sm:min-h-0 flex flex-col justify-center">
        <div className="grid lg:grid-cols-2 gap-0 max-w-7xl mx-auto w-full">
          <div className="flex flex-col justify-center lg:py-20 xl:py-24">
            <div className="inline-flex items-center gap-2 border-2 border-foreground px-3 py-1.5 mb-6 sm:mb-7 shadow-bauhaus-sm bg-bauhaus-yellow w-fit">
              <span className="font-bold uppercase tracking-widest text-[10px] sm:text-xs text-foreground">7-Day Free Trial</span>
            </div>

            <h1 className="font-black text-[28px] sm:text-4xl lg:text-5xl xl:text-6xl tracking-tight leading-[1.1] text-foreground mb-4 sm:mb-5">
              {headline}
            </h1>

            <p className="font-medium text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed mb-7 sm:mb-8 max-w-md">
              {sub}
            </p>

            <div className="flex flex-row gap-3 mb-6 sm:mb-7">
              <a href="/signup" className="inline-flex items-center justify-center gap-2 bg-bauhaus-red text-primary-foreground font-bold uppercase tracking-wider text-xs sm:text-sm px-5 sm:px-8 py-3 sm:py-3.5 border-2 border-foreground shadow-bauhaus hover:bg-bauhaus-red/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-200">
                Start Free Trial <ArrowRight className="h-4 w-4" />
              </a>
              <a href="/#showcase" className="inline-flex items-center justify-center gap-2 bg-bauhaus-white text-foreground font-bold uppercase tracking-wider text-xs sm:text-sm px-5 sm:px-8 py-3 sm:py-3.5 border-2 border-foreground shadow-bauhaus hover:bg-muted active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-200">
                View Demo Store
              </a>
            </div>

            <div className="flex items-center gap-3 sm:gap-5">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-bauhaus-blue flex-shrink-0" />
                <span className="font-medium text-[11px] sm:text-xs text-muted-foreground whitespace-nowrap">Zero Commission</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-bauhaus-blue flex-shrink-0" />
                <span className="font-medium text-[11px] sm:text-xs text-muted-foreground whitespace-nowrap">UPI Payments</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-bauhaus-blue flex-shrink-0" />
                <span className="font-medium text-[11px] sm:text-xs text-muted-foreground whitespace-nowrap">Custom Domain</span>
              </div>
            </div>
          </div>

          <div className="hidden lg:flex bg-bauhaus-blue items-center justify-center relative overflow-hidden min-h-[520px] -mr-12 xl:-mr-16">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(hsl(var(--bauhaus-white)) 2px, transparent 2px)", backgroundSize: "20px 20px" }} />
            <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-bauhaus-white/5 border-2 border-white/10" />
            <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-bauhaus-white/5 border-2 border-white/10" />
            <div className="relative z-10 flex items-end gap-5 xl:gap-7 px-6">
              <PhoneMockup img={liveStores[0].img} label={liveStores[0].label} url={liveStores[0].url} className="w-[190px] xl:w-[210px] -rotate-3 translate-y-3" />
              <PhoneMockup img={liveStores[1].img} label={liveStores[1].label} url={liveStores[1].url} className="w-[190px] xl:w-[210px] rotate-3 -translate-y-3" />
            </div>
            <div className="absolute bottom-5 left-5 bg-bauhaus-white border-3 border-foreground shadow-bauhaus-lg p-3 w-44 z-20">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Revenue</span>
                <TrendingUp className="h-3 w-3 text-bauhaus-red" />
              </div>
              <div className="text-xl font-black text-foreground">₹12,450</div>
              <div className="text-[9px] font-bold text-bauhaus-red mt-0.5">↑ 23% from yesterday</div>
            </div>
            <div className="absolute top-5 right-5 bg-bauhaus-white border-3 border-foreground shadow-bauhaus p-2.5 w-32 z-20">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Orders</span>
                <Package className="h-3 w-3 text-bauhaus-blue" />
              </div>
              <div className="text-lg font-black text-foreground">34</div>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:hidden bg-bauhaus-blue border-t-4 border-foreground">
        <div className="flex justify-center gap-4 py-6 px-5 overflow-hidden">
          <PhoneMockup img={liveStores[0].img} label={liveStores[0].label} url={liveStores[0].url} className="w-[145px] sm:w-[165px] -rotate-2" />
          <PhoneMockup img={liveStores[1].img} label={liveStores[1].label} url={liveStores[1].url} className="w-[145px] sm:w-[165px] rotate-2" />
        </div>
        <div className="grid grid-cols-3 border-t-4 border-foreground">
          <div className="bg-bauhaus-white border-r-2 border-foreground p-3 sm:p-4">
            <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Revenue</div>
            <div className="text-base sm:text-lg font-black text-foreground">₹12,450</div>
            <div className="text-[9px] sm:text-[10px] font-bold text-bauhaus-red">↑ 23%</div>
          </div>
          <div className="bg-bauhaus-white border-r-2 border-foreground p-3 sm:p-4">
            <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Orders</div>
            <div className="text-base sm:text-lg font-black text-foreground">34</div>
          </div>
          <div className="bg-bauhaus-yellow p-3 sm:p-4 flex flex-col items-center justify-center">
            <div className="flex gap-1.5 mb-1.5">
              <div className="w-3 h-3 rounded-full bg-bauhaus-red" />
              <div className="w-3 h-3 bg-bauhaus-blue" />
              <div className="w-0 h-0" style={{ borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderBottom: "10px solid hsl(var(--foreground))" }} />
            </div>
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-foreground">Store Live</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
