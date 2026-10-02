import { X, Check } from "lucide-react";

const oldWay = [
  "5+ disconnected tools (Shopify + Meta + WhatsApp + courier + CRM)",
  "Pay subscription whether you sell or not",
  "Manual RTO follow-ups eat your margin",
  "Marketing data lives in 4 different dashboards",
  "Hire an agency just to keep the store running",
];

const newWay = [
  "One platform — store, WhatsApp, logistics, AI calling, checkout",
  "₹0 subscription. Flat 2% on every sale",
  "AI calling agent confirms COD orders & cuts RTO automatically",
  "Unified dashboard — every rupee spent and earned, in one view",
  "Automations handle order updates, recovery and support 24/7",
];

const ProblemVsUs = () => (
  <section className="border-b-4 border-foreground bg-bauhaus-canvas py-14 sm:py-20 px-4 sm:px-6 lg:px-8">
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-10 sm:mb-14">
        <span className="font-bold uppercase tracking-widest text-xs text-muted-foreground mb-2 block">The Shift</span>
        <h2 className="font-black uppercase text-3xl sm:text-4xl lg:text-5xl tracking-tighter leading-[0.95] text-foreground">
          Stop renting <span className="text-bauhaus-red">software.</span><br />Start paying for <span className="text-bauhaus-blue">results.</span>
        </h2>
      </div>
      <div className="grid md:grid-cols-2 gap-5 sm:gap-6">
        <div className="bg-bauhaus-white border-4 border-foreground shadow-bauhaus-lg p-6 sm:p-8">
          <div className="inline-block bg-foreground text-bauhaus-white font-bold uppercase tracking-widest text-[10px] px-2.5 py-1 mb-5">The Old Way</div>
          <h3 className="font-black uppercase text-xl sm:text-2xl text-foreground mb-5">Scattered stack</h3>
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

        <div className="bg-bauhaus-yellow border-4 border-foreground shadow-bauhaus-lg p-6 sm:p-8">
          <div className="inline-block bg-bauhaus-red text-primary-foreground font-bold uppercase tracking-widest text-[10px] px-2.5 py-1 mb-5">ShopBanao</div>
          <h3 className="font-black uppercase text-xl sm:text-2xl text-foreground mb-5">One agentic OS</h3>
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
