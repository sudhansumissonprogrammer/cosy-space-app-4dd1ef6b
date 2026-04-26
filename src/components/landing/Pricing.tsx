import { Check, ArrowRight } from "lucide-react";
import { useState } from "react";

const monthly = [
  { name: "Starter", price: 0, desc: "Perfect for getting started", features: ["10 Products", "7-day free trial included", "Custom Domain", "UPI Payments", "WhatsApp Orders", "Basic Analytics", "Email Support"], color: "blue", popular: false, includesFrom: null as string | null },
  { name: "Pro", price: 399, desc: "Best for growing sellers", features: ["100 Products", "7-day free trial included", "Custom Domain", "All Payment Options", "WhatsApp + SMS", "Advanced Analytics Dashboard", "Facebook Pixel + Tracking", "Priority Support", "Coupons & Discounts", "SEO Tools", "AI Product Descriptions"], color: "yellow", popular: false, includesFrom: "Starter" },
  { name: "Growth", price: 699, desc: "For established brands", features: ["Unlimited Products", "7-day free trial included", "Multiple Domains", "Custom Theme Design", "Sales Funnel Builder", "Dedicated Account Manager", "Priority WhatsApp Support", "API Access", "White-label Branding", "AI Store Content Generator"], color: "red", popular: true, includesFrom: "Pro" },
];

const colorMap: Record<string, { bg: string; text: string }> = {
  red: { bg: "bg-bauhaus-red", text: "text-primary-foreground" },
  blue: { bg: "bg-bauhaus-blue", text: "text-primary-foreground" },
  yellow: { bg: "bg-bauhaus-yellow", text: "text-foreground" },
};

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const Pricing = () => {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="border-b-4 border-foreground py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8 bg-bauhaus-canvas">
      <div className="max-w-6xl mx-auto">
        {/* Urgency banner */}
        <div className="bg-bauhaus-red text-primary-foreground text-center font-bold text-sm sm:text-base py-3 px-4 border-2 border-foreground shadow-bauhaus mb-8">
          🔥 Launch Offer — Lock in these prices before they increase
        </div>

        <div className="text-center mb-8">
          <span className="font-bold uppercase tracking-widest text-xs text-muted-foreground mb-2 block">Pricing</span>
          <h2 className="font-black uppercase text-3xl sm:text-4xl lg:text-6xl tracking-tighter leading-[0.9] text-foreground">
            Simple, Honest<br /><span className="text-bauhaus-red">Pricing</span>
          </h2>
          <p className="font-medium text-muted-foreground mt-4 max-w-md mx-auto">No commission. No hidden fees. Just one flat monthly price.</p>

          {/* Annual toggle */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <span className={`font-bold text-sm ${!annual ? "text-foreground" : "text-muted-foreground"}`}>Monthly</span>
            <button onClick={() => setAnnual(!annual)} aria-label="Toggle annual billing" className={`relative inline-flex h-8 w-[52px] items-center rounded-full border-2 border-foreground transition-colors duration-300 ${annual ? "bg-bauhaus-blue" : "bg-muted"}`}>
              <span className={`inline-block h-5 w-5 rounded-full bg-bauhaus-white border-2 border-foreground transition-transform duration-300 ${annual ? "translate-x-[26px]" : "translate-x-[4px]"}`} />
            </button>
            <span className={`font-bold text-sm ${annual ? "text-foreground" : "text-muted-foreground"}`}>Annual</span>
            {annual && <span className="bg-bauhaus-blue text-primary-foreground font-bold text-xs px-2 py-1 border border-foreground">Save 20%</span>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-start">
          {monthly.map((p) => {
            const price = annual ? Math.round(p.price * 0.8) : p.price;
            const period = annual ? "/month" : "/month";
            return (
              <div key={p.name} className={`bg-bauhaus-white border-2 sm:border-4 border-foreground shadow-bauhaus sm:shadow-bauhaus-lg relative hover:-translate-y-2 transition-transform duration-200 ${p.popular ? "lg:-mt-4 lg:mb-4" : ""}`}>
                {p.popular && <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-bauhaus-red text-primary-foreground font-bold uppercase tracking-widest text-xs px-6 py-2 border-2 border-foreground shadow-bauhaus-sm whitespace-nowrap">🔥 Most Popular</div>}
                <div className={`${colorMap[p.color].bg} p-6 border-b-4 border-foreground`}>
                  <h3 className={`font-bold uppercase tracking-wider text-sm ${colorMap[p.color].text}`}>{p.name}</h3>
                  <div className={`font-black text-4xl ${colorMap[p.color].text} mt-2`}>
                    {fmt(price)}<span className="font-medium text-base opacity-80">{period}</span>
                  </div>
                  {annual && (
                    <div className="mt-1 space-y-0.5">
                      <div className={`font-medium text-xs ${colorMap[p.color].text} opacity-70 line-through`}>{fmt(p.price)}/month</div>
                      <div className={`font-bold text-sm ${colorMap[p.color].text} opacity-90`}>{fmt(price * 12)}/year</div>
                    </div>
                  )}
                  <p className={`font-medium text-sm ${colorMap[p.color].text} opacity-80 mt-1`}>{p.desc}</p>
                </div>
                <div className="p-6 space-y-3">
                  {p.includesFrom && (
                    <div className="flex items-center gap-2 pb-3 mb-1 border-b-2 border-dashed border-muted">
                      <Check className="h-4 w-4 text-bauhaus-red flex-shrink-0" strokeWidth={3} />
                      <span className="font-bold text-sm text-foreground">Everything in {p.includesFrom}</span>
                    </div>
                  )}
                  {p.features.map((f) => (
                    <div key={f} className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full ${colorMap[p.color].bg} flex items-center justify-center flex-shrink-0`}><Check className={`h-3 w-3 ${colorMap[p.color].text}`} strokeWidth={3} /></div>
                      <span className="font-medium text-sm text-foreground">{f}</span>
                    </div>
                  ))}
                </div>
                <div className="p-6 pt-0 space-y-2">
                  <a href="/signup" className={`flex items-center justify-center gap-2 w-full ${colorMap[p.color].bg} ${colorMap[p.color].text} font-bold uppercase tracking-wider text-sm px-6 py-3.5 border-2 border-foreground shadow-bauhaus hover:opacity-90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-200`}>
                    Start Free Trial <ArrowRight className="h-4 w-4" />
                  </a>
                  <p className="text-center text-xs text-muted-foreground font-medium">7-day free trial • Cancel anytime • No card required</p>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-center font-medium text-sm text-muted-foreground mt-8">👉 Most users start with the Growth plan and upgrade later.</p>
        <p className="text-center font-medium text-xs text-muted-foreground mt-3 max-w-2xl mx-auto px-4">
          All prices are in INR and exclusive of 18% GST. Monthly plans are billed every 30 days; annual plans are billed once for 12 months. Cancel anytime from your dashboard — see our <a href="/refund-policy" className="underline font-bold">Refund Policy</a> and <a href="/terms" className="underline font-bold">Terms</a>.
        </p>
      </div>
    </section>
  );
};

export default Pricing;
