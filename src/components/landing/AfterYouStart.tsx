import { Rocket, Store, PackagePlus, ShoppingCart } from "lucide-react";

const steps = [
  { icon: Rocket, num: "01", title: "Start Free Trial", desc: "Sign up in 30 seconds — no card required." },
  { icon: Store, num: "02", title: "We Help You Set Up", desc: "Our team helps you customize your store." },
  { icon: PackagePlus, num: "03", title: "Add Your Products", desc: "Upload photos, set prices — or we do it for you." },
  { icon: ShoppingCart, num: "04", title: "Start Receiving Orders", desc: "Share your link & watch orders come in." },
];

const AfterYouStart = () => {
  return (
    <section className="border-b-4 border-foreground py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8 bg-bauhaus-blue relative overflow-hidden">
      <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full border-4 border-white/10" />
      <div className="absolute -bottom-12 -left-12 w-40 h-40 border-4 border-white/10 rotate-45" />
      <div className="max-w-5xl mx-auto relative z-10">
        <div className="text-center mb-12">
          <span className="inline-block font-bold uppercase tracking-widest text-xs text-foreground bg-bauhaus-yellow border-2 border-foreground px-4 py-1.5 shadow-bauhaus-sm mb-4">Getting Started</span>
          <h2 className="font-black uppercase text-3xl sm:text-4xl lg:text-5xl tracking-tighter leading-[0.9] text-primary-foreground">
            What Happens After<br />You Start?
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mb-8">
          {steps.map((s) => (
            <div key={s.num} className="bg-bauhaus-white border-2 lg:border-4 border-foreground shadow-bauhaus p-5 lg:p-6 text-center hover:-translate-y-1 transition-transform duration-200">
              <div className="font-black text-3xl text-bauhaus-blue/20 mb-2">{s.num}</div>
              <div className="w-12 h-12 bg-bauhaus-red border-2 border-foreground shadow-bauhaus-sm flex items-center justify-center mx-auto mb-3">
                <s.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="font-bold text-sm uppercase tracking-tight text-foreground mb-1.5">{s.title}</h3>
              <p className="font-medium text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center">
          <p className="inline-block bg-bauhaus-white border-2 border-foreground shadow-bauhaus-sm px-5 py-3 font-bold text-sm text-foreground">
            👉 No confusion. No technical setup. We guide you step-by-step.
          </p>
        </div>
      </div>
    </section>
  );
};

export default AfterYouStart;
