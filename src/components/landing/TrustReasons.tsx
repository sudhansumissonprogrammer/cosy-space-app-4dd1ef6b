import { Clock, Brain, IndianRupee, Smartphone, Headphones, ShieldCheck, CheckCircle } from "lucide-react";

const reasons = [
  { icon: Clock, title: "Setup in Under 10 Minutes", desc: "Sign up, add products, go live. That's it.", color: "bg-bauhaus-blue" },
  { icon: Brain, title: "No Technical Skills Needed", desc: "If you use WhatsApp, you can use ShopBanao.", color: "bg-bauhaus-red" },
  { icon: IndianRupee, title: "Zero Commission", desc: "Keep 100% of your revenue. We charge a flat fee only.", color: "bg-bauhaus-yellow" },
  { icon: Smartphone, title: "Works on Mobile", desc: "Your customers order from any phone — no app needed.", color: "bg-bauhaus-blue" },
  { icon: Headphones, title: "Dedicated Support Team", desc: "We help you set up, customize, and grow your store.", color: "bg-bauhaus-red" },
  { icon: ShieldCheck, title: "Secure Payments", desc: "UPI, cards, wallets, COD — all PCI-compliant & safe.", color: "bg-bauhaus-yellow" },
];

const deliverables = [
  "Custom branded online store",
  "Your own domain (yourstore.com)",
  "UPI, Cards & COD payments",
  "Mobile-optimized storefront",
  "Product catalog setup",
  "Order management dashboard",
  "WhatsApp order notifications",
  "Ongoing technical support",
];

const clientNames = ["Overlays", "Serdiya Jewellers", "QuickRashan", "Arrok", "Mediva"];

const TrustReasons = () => {
  return (
    <section className="border-b-4 border-foreground py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8 bg-bauhaus-canvas">
      <div className="max-w-6xl mx-auto">
        {/* Header with trusted agency badge */}
        <div className="text-center mb-10">
          <span className="inline-block font-bold uppercase tracking-widest text-xs text-primary-foreground bg-bauhaus-blue border-2 border-foreground px-4 py-1.5 shadow-bauhaus-sm mb-4">
            Trusted Agency
          </span>
          <h2 className="font-black uppercase text-3xl sm:text-4xl lg:text-5xl tracking-tighter leading-[0.9] text-foreground">
            10+ Stores Delivered<br /><span className="text-bauhaus-red">Successfully</span>
          </h2>
        </div>

        {/* Client logos strip */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-10">
          {clientNames.map((name) => (
            <div key={name} className="bg-bauhaus-white border-2 border-foreground px-4 py-2 shadow-bauhaus-sm">
              <span className="font-bold uppercase tracking-wider text-[10px] sm:text-xs text-foreground">{name}</span>
            </div>
          ))}
        </div>

        {/* Trust cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-12">
          {reasons.map((r) => (
            <div key={r.title} className="bg-bauhaus-white border-2 lg:border-4 border-foreground shadow-bauhaus p-5 lg:p-6 hover:-translate-y-1 transition-transform duration-200">
              <div className={`w-11 h-11 ${r.color} border-2 border-foreground shadow-bauhaus-sm flex items-center justify-center mb-4`}>
                <r.icon className={`h-5 w-5 ${r.color === "bg-bauhaus-yellow" ? "text-foreground" : "text-primary-foreground"}`} strokeWidth={2.5} />
              </div>
              <h3 className="font-bold text-base uppercase tracking-tight text-foreground mb-1.5">{r.title}</h3>
              <p className="font-medium text-sm text-muted-foreground leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>

        {/* What You Get checklist */}
        <div className="bg-bauhaus-white border-2 lg:border-4 border-foreground shadow-bauhaus-md p-6 sm:p-8 lg:p-10">
          <h3 className="font-black uppercase text-xl sm:text-2xl tracking-tight text-foreground mb-6 text-center">
            What You Get
          </h3>
          <div className="grid sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
            {deliverables.map((item) => (
              <div key={item} className="flex items-center gap-2.5">
                <CheckCircle className="h-5 w-5 text-bauhaus-blue flex-shrink-0" strokeWidth={2.5} />
                <span className="font-medium text-sm text-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrustReasons;
