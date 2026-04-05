import { Check, ArrowRight } from "lucide-react";

const points = ["7-day free trial", "No setup cost", "Cancel anytime", "No commission on sales", "Full support included"];

const StartRiskFree = () => {
  return (
    <section className="border-b-4 border-foreground py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8 bg-bauhaus-yellow relative overflow-hidden">
      <div className="absolute top-8 right-8 w-32 h-32 rounded-full bg-bauhaus-white/30 -translate-y-1/2" />
      <div className="absolute bottom-8 left-8 w-24 h-24 bg-bauhaus-white/30 rotate-45" />
      <div className="max-w-3xl mx-auto relative z-10 text-center">
        <h2 className="font-black uppercase text-3xl sm:text-4xl lg:text-5xl tracking-tighter leading-[0.9] text-foreground mb-8">Start<br /><span className="text-bauhaus-red">Risk-Free</span></h2>
        <div className="inline-block bg-bauhaus-white border-2 lg:border-4 border-foreground shadow-bauhaus-lg p-6 sm:p-8 mb-8 text-left">
          <div className="space-y-3">
            {points.map((p) => (
              <div key={p} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-[#16a34a] flex items-center justify-center flex-shrink-0"><Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} /></div>
                <span className="font-bold text-sm sm:text-base text-foreground">{p}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <a href="/login" className="inline-flex items-center justify-center gap-2 bg-bauhaus-red text-primary-foreground font-bold uppercase tracking-wider text-sm px-8 py-4 border-2 border-foreground shadow-bauhaus-md hover:bg-bauhaus-red/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-200">
            Create Your Store Now <ArrowRight className="h-5 w-5" />
          </a>
          <a href="/login" className="inline-flex items-center justify-center gap-2 bg-bauhaus-white text-foreground font-bold uppercase tracking-wider text-sm px-8 py-4 border-2 border-foreground shadow-bauhaus-md hover:bg-muted active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-200 ml-3">
            Login
          </a>
        </div>
      </div>
    </section>
  );
};

export default StartRiskFree;
