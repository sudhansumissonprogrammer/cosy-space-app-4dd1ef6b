import { X, Check } from "lucide-react";
import { SectionHeading, GeoShape } from "@/components/landing/bauhaus/BauhausKit";

const oldWay = [
  "5+ disconnected tools (Shopify + Meta + WhatsApp + courier + CRM)",
  "Pay subscription whether you sell or not",
  "Manual RTO follow-ups eat your margin",
  "Marketing data lives in 4 different dashboards",
  "Hire an agency just to keep ads running",
];

const newWay = [
  "One platform — store, ads, WhatsApp, logistics, AI calling",
  "₹0 subscription. Pay 3% only when an order is delivered",
  "AI calling agent confirms COD orders & cuts RTO automatically",
  "Unified dashboard — every rupee spent and earned, in one view",
  "Agentic automations handle ads, recovery and support 24/7",
];

const ProblemVsUs = () => (
  <section className="border-b-4 border-foreground bg-bauhaus-canvas py-14 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
    <GeoShape kind="circle" color="bg-bauhaus-blue/10" className="absolute -top-24 -left-24 h-64 w-64" />
    <GeoShape kind="square" color="bg-bauhaus-red/10" className="absolute -bottom-20 -right-16 h-52 w-52 rotate-45" />

    <div className="max-w-6xl mx-auto relative z-10">
      <SectionHeading label="The Shift" size="lg">
        Stop renting <span className="text-bauhaus-red">software.</span>
        <br />Start paying for <span className="text-bauhaus-blue">results.</span>
      </SectionHeading>

      <div className="grid md:grid-cols-2 gap-5 sm:gap-6">
        <div className="relative bg-bauhaus-white border-2 sm:border-4 border-foreground shadow-bauhaus sm:shadow-bauhaus-lg p-6 sm:p-8">
          <GeoShape kind="square" color="bg-foreground" className="absolute top-3 right-3 h-3 w-3" />
          <div className="inline-block bg-foreground text-bauhaus-white font-bold uppercase tracking-widest text-[10px] px-2.5 py-1 mb-5">The Old Way</div>
          <h3 className="font-black uppercase text-2xl sm:text-3xl tracking-tighter text-foreground mb-5">Scattered stack</h3>
          <ul className="space-y-3.5">
            {oldWay.map((t) => (
              <li key={t} className="flex gap-3 items-start">
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 border-2 border-foreground bg-bauhaus-red flex items-center justify-center">
                  <X className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
                </span>
                <span className="font-medium text-sm sm:text-base text-foreground/80">{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative bg-bauhaus-yellow border-2 sm:border-4 border-foreground shadow-bauhaus sm:shadow-bauhaus-lg p-6 sm:p-8">
          <GeoShape kind="circle" color="bg-bauhaus-red" className="absolute top-3 right-3 h-3 w-3" />
          <div className="inline-block bg-bauhaus-red text-primary-foreground font-bold uppercase tracking-widest text-[10px] px-2.5 py-1 mb-5">ShopBanao</div>
          <h3 className="font-black uppercase text-2xl sm:text-3xl tracking-tighter text-foreground mb-5">One agentic OS</h3>
          <ul className="space-y-3.5">
            {newWay.map((t) => (
              <li key={t} className="flex gap-3 items-start">
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 border-2 border-foreground bg-bauhaus-blue flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
                </span>
                <span className="font-medium text-sm sm:text-base text-foreground">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </section>
);

export default ProblemVsUs;
