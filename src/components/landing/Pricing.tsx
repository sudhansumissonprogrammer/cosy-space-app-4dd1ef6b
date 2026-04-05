import { Check, ArrowRight } from "lucide-react";

const plans = [
  { name: "Starter", price: "₹499", period: "/month", desc: "Perfect for getting started", features: ["50 Products", "Custom Domain", "UPI Payments", "WhatsApp Orders", "Basic Analytics", "Email Support"], color: "blue", popular: false },
  { name: "Growth", price: "₹999", period: "/month", desc: "Best for serious sellers", features: ["500 Products", "Custom Domain", "All Payment Options", "WhatsApp + SMS", "Advanced Analytics Dashboard", "Facebook Pixel + Tracking", "Priority Support", "Coupons & Discounts", "SEO Tools", "App Integration", "Mobile App", "Payment Gateway Integration", "AI Product Descriptions", "AI Store Content Generator"], color: "red", popular: true },
  { name: "Pro", price: "₹2,499", period: "/month", desc: "For established brands", features: ["Unlimited Products", "Multiple Domains", "All Payment Options", "Full Marketing Suite", "API Access", "Dedicated Manager", "Custom Integrations", "White-label"], color: "yellow", popular: false },
];

const colorMap: Record<string, { bg: string; text: string }> = {
  red: { bg: "bg-bauhaus-red", text: "text-primary-foreground" },
  blue: { bg: "bg-bauhaus-blue", text: "text-primary-foreground" },
  yellow: { bg: "bg-bauhaus-yellow", text: "text-foreground" },
};

const Pricing = () => {
  return (
    <section id="pricing" className="border-b-4 border-foreground py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8 bg-bauhaus-canvas">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <span className="font-bold uppercase tracking-widest text-xs text-muted-foreground mb-2 block">Pricing</span>
          <h2 className="font-black uppercase text-3xl sm:text-4xl lg:text-6xl tracking-tighter leading-[0.9] text-foreground">
            Simple, Honest<br /><span className="text-bauhaus-red">Pricing</span>
          </h2>
          <p className="font-medium text-muted-foreground mt-4 max-w-md mx-auto">No commission. No hidden fees. Just one flat monthly price.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-start">
          {plans.map((p) => (
            <div key={p.name} className={`bg-bauhaus-white border-2 sm:border-4 border-foreground shadow-bauhaus sm:shadow-bauhaus-lg relative hover:-translate-y-2 transition-transform duration-200 ${p.popular ? "lg:-mt-4 lg:mb-4" : ""}`}>
              {p.popular && <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-bauhaus-red text-primary-foreground font-bold uppercase tracking-widest text-xs px-6 py-2 border-2 border-foreground shadow-bauhaus-sm">Most Popular</div>}
              <div className={`${colorMap[p.color].bg} p-6 border-b-4 border-foreground`}>
                <h3 className={`font-bold uppercase tracking-wider text-sm ${colorMap[p.color].text}`}>{p.name}</h3>
                <div className={`font-black text-4xl ${colorMap[p.color].text} mt-2`}>{p.price}<span className="font-medium text-base opacity-80">{p.period}</span></div>
                <p className={`font-medium text-sm ${colorMap[p.color].text} opacity-80 mt-1`}>{p.desc}</p>
              </div>
              <div className="p-6 space-y-3">
                {p.features.map((f) => (
                  <div key={f} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full ${colorMap[p.color].bg} flex items-center justify-center flex-shrink-0`}><Check className={`h-3 w-3 ${colorMap[p.color].text}`} strokeWidth={3} /></div>
                    <span className="font-medium text-sm text-foreground">{f}</span>
                  </div>
                ))}
              </div>
              <div className="p-6 pt-0">
                <a href="/signup" className={`flex items-center justify-center gap-2 w-full ${colorMap[p.color].bg} ${colorMap[p.color].text} font-bold uppercase tracking-wider text-sm px-6 py-3.5 border-2 border-foreground shadow-bauhaus hover:opacity-90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-200`}>
                  Start Free Trial <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
        <p className="text-center font-medium text-sm text-muted-foreground mt-8">👉 Most users start with the Growth plan and upgrade later.</p>
      </div>
    </section>
  );
};

export default Pricing;
