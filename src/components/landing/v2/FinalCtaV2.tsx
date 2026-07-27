import { ArrowRight } from "lucide-react";
import { onAuthCtaIntent } from "@/lib/prefetchLandingAuth";
import { bauButtonClass, GeoShape } from "@/components/landing/bauhaus/BauhausKit";

const FinalCtaV2 = () => (
  <section className="border-b-4 border-foreground bg-bauhaus-yellow py-14 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
    <div className="absolute top-8 left-8 w-40 h-40 rounded-full bg-bauhaus-white/50 -translate-x-1/2 -translate-y-1/2" />
    <div className="absolute bottom-8 right-8 w-32 h-32 bg-bauhaus-white/50 rotate-45 translate-x-1/2 translate-y-1/2" />
    <GeoShape kind="triangle" color="bg-bauhaus-red/20" className="absolute top-10 right-16 h-24 w-24 hidden sm:block" />
    <GeoShape kind="circle" color="bg-bauhaus-blue/25" className="absolute bottom-12 left-14 h-14 w-14 hidden sm:block" />
    <div className="max-w-4xl mx-auto relative z-10 text-center">
      <h2 className="font-black uppercase text-3xl sm:text-5xl lg:text-7xl tracking-tighter leading-[0.9] text-foreground mb-5">
        Stop paying for software.<br /><span className="text-bauhaus-red">Pay for results.</span>
      </h2>
      <p className="font-medium text-base sm:text-lg text-foreground/80 mb-3 max-w-xl mx-auto">
        ₹0 to start. 3% only when an order is delivered. Cancel any time.
      </p>
      <p className="text-sm font-semibold text-foreground/60 mb-8">No card required · Live in a day · Migrate from Shopify free</p>
      <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 sm:gap-4">
        <a href="/signup" {...onAuthCtaIntent} className={bauButtonClass({ variant: "red", size: "lg", shadow: "shadow-bauhaus sm:shadow-bauhaus-md" })}>
          Start Free <ArrowRight className="h-5 w-5" />
        </a>
        <a href="#demo" className={bauButtonClass({ variant: "outline", size: "lg", shadow: "shadow-bauhaus sm:shadow-bauhaus-md" })}>
          Book a Demo
        </a>
      </div>
    </div>
  </section>
);

export default FinalCtaV2;
