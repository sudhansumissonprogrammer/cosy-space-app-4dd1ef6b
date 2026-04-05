import { Check, Code, Package, CreditCard, Search } from "lucide-react";

const features = [
  { badge: "Store Builder", badgeColor: "bg-bauhaus-blue", title: "Build your online store", highlight: "without code", desc: "Pick a theme, name your store, and go live. No coding needed.", bullets: ["Premium themes with mobile-first design", "Your own subdomain — storename.shopbanao.in", "Free SSL certificate included"], icon: Code, shapeColor: "bg-bauhaus-red", reverse: false },
  { badge: "Product Management", badgeColor: "bg-bauhaus-red", title: "Organise your products", highlight: "effortlessly", desc: "Add products with photos, variants & inventory. Manage everything from one dashboard.", bullets: ["Unlimited products with image galleries", "Categories, SKU, stock & inventory tracking", "Featured products & sale pricing"], icon: Package, shapeColor: "bg-bauhaus-blue", reverse: true },
  { badge: "Payments", badgeColor: "bg-bauhaus-yellow", title: "Simplify the", highlight: "payment process", desc: "UPI, cards, wallets, EMI & COD — all secure and instant via Razorpay.", bullets: ["Razorpay integration — UPI, cards, wallets, EMI", "Cash on delivery (COD) support", "PCI-compliant secure transactions"], icon: CreditCard, shapeColor: "bg-bauhaus-red", reverse: false },
  { badge: "SEO & Analytics", badgeColor: "bg-bauhaus-blue", title: "Get found on", highlight: "Google", desc: "Built-in SEO, Google Analytics, and fast load times to grow organically.", bullets: ["SEO-optimised pages & clean URLs", "Google Analytics integration", "Lightning fast under 1 second load time"], icon: Search, shapeColor: "bg-bauhaus-yellow", reverse: true },
];

const PowerfulFeatures = () => {
  return (
    <section className="border-b-4 border-foreground py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8 bg-bauhaus-canvas">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 sm:mb-16">
          <span className="inline-block font-bold uppercase tracking-widest text-xs text-primary-foreground bg-bauhaus-blue border-2 border-foreground px-4 py-1.5 shadow-bauhaus-sm mb-4">⚡ Powerful Features</span>
          <h2 className="font-black uppercase text-3xl sm:text-4xl lg:text-5xl tracking-tighter leading-[0.9] text-foreground">
            Everything you need to run a<br />
            <span className="text-bauhaus-red italic" style={{ fontFamily: "'Alegreya SC', serif" }}>successful online store</span>
          </h2>
          <p className="font-medium text-sm sm:text-base text-muted-foreground mt-4 max-w-lg mx-auto">
            From product management to payments, we've built every tool you need so you can focus on growing your business.
          </p>
        </div>
        <div className="space-y-8 sm:space-y-12">
          {features.map((f) => (
            <div key={f.badge} className={`grid lg:grid-cols-2 gap-6 lg:gap-10 items-center ${f.reverse ? "lg:direction-rtl" : ""}`}>
              <div className={`${f.reverse ? "lg:order-2" : "lg:order-1"}`}>
                <span className={`inline-block font-bold uppercase tracking-widest text-[10px] sm:text-xs text-primary-foreground ${f.badgeColor} border-2 border-foreground px-3 py-1 shadow-bauhaus-sm mb-4 ${f.badgeColor === "bg-bauhaus-yellow" ? "text-foreground" : ""}`}>{f.badge}</span>
                <h3 className="font-black text-xl sm:text-2xl lg:text-3xl tracking-tight text-foreground mb-3">
                  {f.title}{" "}<span className="text-bauhaus-red italic" style={{ fontFamily: "'Alegreya SC', serif" }}>{f.highlight}</span>
                </h3>
                <p className="font-medium text-sm text-muted-foreground leading-relaxed mb-4">{f.desc}</p>
                <ul className="space-y-2">
                  {f.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-bauhaus-red flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
                      </div>
                      <span className="font-medium text-sm text-foreground">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={`${f.reverse ? "lg:order-1" : "lg:order-2"}`}>
                <div className={`${f.shapeColor} border-4 border-foreground shadow-bauhaus-lg p-8 sm:p-12 flex items-center justify-center min-h-[200px] sm:min-h-[260px] relative overflow-hidden`}>
                  <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(hsl(var(--bauhaus-white)) 2px, transparent 2px)", backgroundSize: "16px 16px" }} />
                  <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full border-4 border-white/20" />
                  <div className="absolute -bottom-6 -left-6 w-20 h-20 border-4 border-white/20 rotate-45" />
                  <div className="relative bg-bauhaus-white border-4 border-foreground shadow-bauhaus-lg w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
                    <f.icon className="h-10 w-10 sm:h-12 sm:w-12 text-foreground" strokeWidth={1.5} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PowerfulFeatures;
