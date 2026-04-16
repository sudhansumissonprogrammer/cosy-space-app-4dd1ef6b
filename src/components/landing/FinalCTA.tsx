import { ArrowRight, MessageCircle } from "lucide-react";

const WA_LINK = "https://wa.me/919692282485?text=Hi!%20I%20want%20to%20get%20my%20online%20store%20built";

const FinalCTA = () => {
  return (
    <section className="border-b-4 border-foreground bg-bauhaus-yellow py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-8 left-8 w-40 h-40 rounded-full bg-bauhaus-white/50 -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-8 right-8 w-32 h-32 bg-bauhaus-white/50 rotate-45 translate-x-1/2 translate-y-1/2" />
      <div className="max-w-4xl mx-auto relative z-10 text-center">
        <div className="inline-block bg-bauhaus-red text-primary-foreground font-bold uppercase tracking-widest text-[10px] sm:text-xs px-4 py-1.5 border-2 border-foreground shadow-bauhaus-sm mb-6">
          ⚡ Limited Slots Available This Month
        </div>
        <h2 className="font-black uppercase text-2xl sm:text-4xl md:text-5xl lg:text-7xl tracking-tighter leading-[0.9] text-foreground mb-6">
          Get Your Online Store<br />Built by Experts
        </h2>
        <p className="font-medium text-lg text-foreground/80 mb-3 max-w-lg mx-auto">
          We build your complete ecommerce website — custom domain, payments, everything. Ready to sell.
        </p>
        <p className="text-sm font-semibold text-foreground/60 mb-4">Done for you • Ready in 48 hours • Ongoing support</p>
        <p className="text-xs font-bold text-bauhaus-red mb-8">✦ No upfront payment until you see the design</p>
        <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 sm:gap-4">
          <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 bg-bauhaus-red text-primary-foreground font-bold uppercase tracking-wider text-sm px-6 sm:px-8 py-3 sm:py-4 border-2 border-foreground shadow-bauhaus sm:shadow-bauhaus-md hover:bg-bauhaus-red/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-200">
            <MessageCircle className="h-5 w-5" /> Get Started on WhatsApp <ArrowRight className="h-5 w-5" />
          </a>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
