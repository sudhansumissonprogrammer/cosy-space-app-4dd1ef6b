import { ArrowRight } from "lucide-react";

const FinalCTA = () => {
  return (
    <section className="border-b-4 border-foreground bg-bauhaus-yellow py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-8 left-8 w-40 h-40 rounded-full bg-bauhaus-white/50 -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-8 right-8 w-32 h-32 bg-bauhaus-white/50 rotate-45 translate-x-1/2 translate-y-1/2" />
      <div className="max-w-4xl mx-auto relative z-10 text-center">
        <h2 className="font-black uppercase text-2xl sm:text-4xl md:text-5xl lg:text-7xl tracking-tighter leading-[0.9] text-foreground mb-6">
          Create Your Online<br />Store in 1 Minute
        </h2>
        <p className="font-medium text-lg text-foreground/80 mb-8 max-w-lg mx-auto">
          Start Free — No Setup Cost. Join sellers across India selling online with zero commission.
        </p>
        <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 sm:gap-4">
          <a href="/signup" className="inline-flex items-center justify-center gap-2 bg-bauhaus-red text-primary-foreground font-bold uppercase tracking-wider text-sm px-6 sm:px-8 py-3 sm:py-4 border-2 border-foreground shadow-bauhaus sm:shadow-bauhaus-md hover:bg-bauhaus-red/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-200">
            Start Free Trial <ArrowRight className="h-5 w-5" />
          </a>
          <a href="/#showcase" className="inline-flex items-center justify-center gap-2 bg-bauhaus-white text-foreground font-bold uppercase tracking-wider text-sm px-6 sm:px-8 py-3 sm:py-4 border-2 border-foreground shadow-bauhaus sm:shadow-bauhaus-md hover:bg-muted active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-200">
            View Demo Store
          </a>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
