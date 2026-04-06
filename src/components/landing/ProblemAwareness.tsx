import { Store, Clock, TrendingDown, ShieldX } from "lucide-react";

const problems = [
  { icon: Store, problem: "Your shop only serves the local area — customers beyond your street never find you.", solution: "Go online and sell to customers across India, 24/7." },
  { icon: Clock, problem: "When the shop is closed, sales stop — no orders come in overnight or on holidays.", solution: "An online store never sleeps — orders flow in round the clock." },
  { icon: TrendingDown, problem: "Your competitors are already selling online — your customers are switching to them.", solution: "Launch your own store before you lose more business." },
  { icon: ShieldX, problem: "Posting on social media doesn't build trust — people assume it's not a real brand.", solution: "A professional online store gives you instant credibility." },
];

const ProblemAwareness = () => {
  return (
    <section className="py-10 md:py-16 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-8 md:mb-10">
          <span className="inline-block bg-bauhaus-red text-bauhaus-white font-bold text-xs uppercase tracking-[0.15em] px-3 py-1.5 border-2 border-foreground mb-3">Real Problems</span>
          <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tight text-foreground leading-tight">
            Problems Every Offline<br />Business Faces
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 max-w-4xl mx-auto">
          {problems.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={index} className="bg-bauhaus-white border-2 border-foreground shadow-[3px_3px_0px_0px_hsl(var(--foreground))] p-4 flex flex-col gap-2 hover:-translate-y-1 transition-transform duration-200">
                <div className="flex items-start gap-2.5">
                  <div className="shrink-0 w-8 h-8 bg-bauhaus-red flex items-center justify-center border-2 border-foreground">
                    <Icon className="h-4 w-4 text-bauhaus-white" strokeWidth={2.5} />
                  </div>
                  <p className="text-sm font-bold text-foreground leading-snug">{item.problem}</p>
                </div>
                <div className="border-l-3 border-[#16a34a] pl-2.5 ml-10">
                  <p className="text-xs md:text-sm font-semibold text-[#16a34a]">👉 {item.solution}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ProblemAwareness;
