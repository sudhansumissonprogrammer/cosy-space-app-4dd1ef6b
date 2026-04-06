import { Clock, Brain, IndianRupee, Smartphone, Headphones, ShieldCheck } from "lucide-react";

const reasons = [
  { icon: Clock, title: "Setup in Under 10 Minutes", desc: "Sign up, add products, go live. That's it.", color: "bg-bauhaus-blue" },
  { icon: Brain, title: "No Technical Skills Needed", desc: "If you use WhatsApp, you can use ShopBanao.", color: "bg-bauhaus-red" },
  { icon: IndianRupee, title: "Zero Commission", desc: "Keep 100% of your revenue. We charge a flat fee only.", color: "bg-bauhaus-yellow" },
  { icon: Smartphone, title: "Works on Mobile", desc: "Your customers order from any phone — no app needed.", color: "bg-bauhaus-blue" },
  { icon: Headphones, title: "Dedicated Support Team", desc: "We help you set up, customize, and grow your store.", color: "bg-bauhaus-red" },
  { icon: ShieldCheck, title: "Secure Payments", desc: "UPI, cards, wallets, COD — all PCI-compliant & safe.", color: "bg-bauhaus-yellow" },
];

const TrustReasons = () => {
  return (
    <section className="border-b-4 border-foreground py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8 bg-bauhaus-canvas">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <span className="inline-block font-bold uppercase tracking-widest text-xs text-primary-foreground bg-bauhaus-blue border-2 border-foreground px-4 py-1.5 shadow-bauhaus-sm mb-4">Trust</span>
          <h2 className="font-black uppercase text-3xl sm:text-4xl lg:text-5xl tracking-tighter leading-[0.9] text-foreground">
            Why Business Owners<br /><span className="text-bauhaus-red">Trust ShopBanao</span>
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
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
      </div>
    </section>
  );
};

export default TrustReasons;
