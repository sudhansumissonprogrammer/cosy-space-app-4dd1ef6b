import { Store, Clock, Users, Database, RefreshCw, UserX, MapPin, IndianRupee } from "lucide-react";

const problems = [
  { icon: Store, problem: "Sir abhi aapka business sirf is dukaan tak limited hai… Jo yahan aaya wahi customer hai. Jo nahi aaya, wo aapka customer ban hi nahi sakta.", solution: "Online store mein aapka shop poore India mein khul jata hai." },
  { icon: Clock, problem: "Aap din mein 10–12 ghante hi bech sakte ho… Baaki time shop band to sales bhi band.", solution: "Online store aapka 24/7 salesman hai — raat mein bhi order aata hai." },
  { icon: Users, problem: "Har customer ko manually handle karna padta hai… Product dikhana, price batana — same cheez baar-baar.", solution: "Online mein sab automatic hai — customer khud dekhega, khud order karega." },
  { icon: Database, problem: "Customer aaya aur chala gaya… repeat sale zero. Aapke paas uska data nahi rehta.", solution: "Online store mein har customer ka number save hota hai — WhatsApp se baar-baar sell kar sakte ho." },
  { icon: RefreshCw, problem: "Purane customers ko wapas lane ka koi system nahi hai.", solution: "Ek click mein WhatsApp campaign chalao aur repeat orders lao." },
  { icon: UserX, problem: "Customer product dekh ke chala jata hai… baad mein contact nahi hota.", solution: "Online store mein wo kabhi bhi wapas aakar order kar sakta hai." },
  { icon: MapPin, problem: "Aap sirf local customers tak limited ho.", solution: "Online mein poore India mein sell kar sakte ho — Instagram, ads, WhatsApp se." },
  { icon: IndianRupee, problem: "Website banwana mehenga aur complicated lagta hai.", solution: "Hum store free mein banate hain — cost 1–2 orders mein recover ho jata hai." },
];

const ProblemAwareness = () => {
  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-12 md:mb-16">
          <span className="inline-block bg-bauhaus-red text-bauhaus-white font-bold text-xs md:text-sm uppercase tracking-[0.15em] px-4 py-2 border-2 border-foreground mb-4">Real Problems</span>
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-foreground leading-tight">
            Problems Every Offline<br />Business Faces
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 max-w-5xl mx-auto">
          {problems.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={index} className="bg-bauhaus-white border-2 md:border-4 border-foreground shadow-[4px_4px_0px_0px_hsl(var(--foreground))] md:shadow-bauhaus p-5 md:p-6 flex flex-col gap-3 hover:-translate-y-1 transition-transform duration-200">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-10 h-10 bg-bauhaus-red flex items-center justify-center border-2 border-foreground">
                    <Icon className="h-5 w-5 text-bauhaus-white" strokeWidth={2.5} />
                  </div>
                  <p className="text-sm md:text-base font-bold text-foreground leading-snug">{item.problem}</p>
                </div>
                <div className="border-l-4 border-[#16a34a] pl-3 ml-12">
                  <p className="text-sm md:text-base font-semibold text-[#16a34a]">👉 {item.solution}</p>
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
