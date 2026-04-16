import { MessageCircle, Palette, CheckCircle, ShoppingCart } from "lucide-react";

const WA_LINK = "https://wa.me/919692282485?text=Hi!%20I%20want%20to%20get%20my%20online%20store%20built";

const steps = [
  { num: "01", icon: MessageCircle, title: "Tell Us Your Needs", desc: "Share your business details, products & preferences — we handle the rest.", color: "bg-bauhaus-blue" },
  { num: "02", icon: Palette, title: "We Design & Build", desc: "Our team creates a custom, branded online store tailored to your business.", color: "bg-bauhaus-red" },
  { num: "03", icon: CheckCircle, title: "Review & Launch", desc: "You review the store, request changes, and we take it live on your domain.", color: "bg-bauhaus-yellow" },
  { num: "04", icon: ShoppingCart, title: "Start Selling", desc: "Your store is live — customers order online, payments flow to your account.", color: "bg-bauhaus-blue" },
];

const SolutionFlow = () => {
  return (
    <section id="process" className="py-16 md:py-24 bg-bauhaus-blue/5 border-y-4 border-foreground">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-12 md:mb-16">
          <span className="inline-block bg-bauhaus-blue text-bauhaus-white font-bold text-xs md:text-sm uppercase tracking-[0.15em] px-4 py-2 border-2 border-foreground mb-4">Our Process</span>
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-foreground leading-tight">How It Works</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-4 max-w-5xl mx-auto mb-12">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="flex flex-col items-center text-center relative">
                {index < steps.length - 1 && <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-1 bg-foreground" />}
                <div className={`w-16 h-16 ${step.color} border-3 md:border-4 border-foreground flex items-center justify-center mb-4 relative z-10`}>
                  <Icon className="h-7 w-7 text-bauhaus-white" strokeWidth={2.5} />
                </div>
                <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">Step {step.num}</span>
                <h3 className="text-lg font-black uppercase text-foreground mb-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground font-medium">{step.desc}</p>
              </div>
            );
          })}
        </div>
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="bg-bauhaus-white border-2 md:border-4 border-foreground shadow-[4px_4px_0px_0px_hsl(var(--foreground))] md:shadow-bauhaus p-5 md:p-6">
            <p className="text-lg md:text-xl font-black text-[#16a34a] uppercase tracking-wide">👉 100% Done For You — Design, Setup & Launch</p>
          </div>
          <p className="text-sm md:text-base text-muted-foreground font-medium leading-relaxed">
            Once your store is live and you reach <span className="font-black text-foreground">1,000 customers</span>, expect <span className="font-black text-foreground">10–15 daily orders</span> from repeat buyers alone.
          </p>
          <div className="flex flex-col items-center gap-2 pt-4">
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="inline-block bg-bauhaus-red text-bauhaus-white font-black text-base md:text-lg uppercase tracking-wider px-8 py-4 border-2 md:border-4 border-foreground shadow-[4px_4px_0px_0px_hsl(var(--foreground))] md:shadow-bauhaus hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_hsl(var(--foreground))] transition-all duration-200">
              Get Your Store Built Now
            </a>
            <span className="text-xs md:text-sm text-muted-foreground font-semibold">Ready in 48 hours • Done for you</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SolutionFlow;
