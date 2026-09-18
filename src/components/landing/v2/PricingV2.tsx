import { Check, ArrowRight } from "lucide-react";
import { onAuthCtaIntent } from "@/lib/prefetchLandingAuth";

const zeros = [
  { label: "Subscription", value: "₹0" },
  { label: "Setup fee", value: "₹0" },
  { label: "Theme / app fee", value: "₹0" },
  { label: "Support fee", value: "₹0" },
];

const included = [
  "Branded storefront + custom domain",
  "Unlimited products, customers and orders",
  "WhatsApp ordering & broadcast campaigns",
  "UPI, Razorpay, Cashfree & COD checkout",
  "Shiprocket / Delhivery / Bluedart logistics",
  "AI calling agent & abandoned-cart recovery",
  "Unified order, customer & sales analytics",
  "Priority human support — 7 days a week",
];

const PricingV2 = () => (
  <section id="pricing" className="border-b-4 border-foreground py-14 sm:py-20 px-4 sm:px-6 lg:px-8 bg-bauhaus-canvas">
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-10 sm:mb-14">
        <span className="font-bold uppercase tracking-widest text-xs text-muted-foreground mb-2 block">Pricing</span>
        <h2 className="font-black uppercase text-3xl sm:text-4xl lg:text-5xl tracking-tighter leading-[0.95] text-foreground">
          ₹0 upfront. <span className="text-bauhaus-red">Flat 3% on every sale.</span>
        </h2>
        <p className="font-medium text-sm sm:text-base text-muted-foreground mt-4 max-w-2xl mx-auto">
          One simple rate on every order you place through ShopBanao — prepaid, COD or RTO. No subscription, no setup fee, no hidden add-on bills.
        </p>
      </div>

      <div className="grid sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {zeros.map((z) => (
          <div key={z.label} className="bg-bauhaus-yellow border-4 border-foreground shadow-bauhaus p-5 text-center">
            <div className="font-black text-4xl text-foreground">{z.value}</div>
            <div className="font-bold uppercase tracking-widest text-[10px] text-foreground/70 mt-1">{z.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-bauhaus-white border-4 border-foreground shadow-bauhaus-lg overflow-hidden">
        <div className="bg-bauhaus-red text-primary-foreground px-6 py-5 border-b-4 border-foreground flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <div className="font-bold uppercase tracking-widest text-[10px] opacity-80">Success-based</div>
            <div className="font-black text-3xl sm:text-4xl tracking-tight">3% per order</div>
          </div>
          <div className="font-bold text-sm opacity-90">Charged weekly. No lock-in.</div>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 p-6 sm:p-8">
          {included.map((i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="mt-0.5 flex-shrink-0 w-5 h-5 border-2 border-foreground bg-bauhaus-blue flex items-center justify-center">
                <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
              </span>
              <span className="font-medium text-sm text-foreground">{i}</span>
            </div>
          ))}
        </div>
        <div className="p-6 sm:p-8 border-t-4 border-foreground bg-bauhaus-canvas flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <p className="font-bold text-sm text-foreground/80">Cancel any time. Migrate out with your full data.</p>
          <a href="/signup" {...onAuthCtaIntent} className="inline-flex items-center justify-center gap-2 bg-bauhaus-red text-primary-foreground font-bold uppercase tracking-wider text-sm px-6 py-3 border-2 border-foreground shadow-bauhaus hover:bg-bauhaus-red/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-[transform,opacity,colors,box-shadow] duration-200">
            Start Free <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  </section>
);

export default PricingV2;
