import { Bot, PhoneCall, Truck, RotateCcw } from "lucide-react";

const agents = [
  { icon: PhoneCall, title: "Calling agent", body: "Confirms COD, answers product questions and re-engages drop-offs — in Hindi and English." },
  { icon: Truck, title: "Logistics agent", body: "Picks the right courier by pincode and flags high-risk COD orders before they ship." },
  { icon: RotateCcw, title: "Recovery agent", body: "Texts, calls and DMs abandoned carts on the right channel at the right hour." },
];

const AgenticStrip = () => (
  <section className="border-b-4 border-foreground bg-foreground text-bauhaus-white py-14 sm:py-20 px-4 sm:px-6 lg:px-8">
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-10 sm:mb-14">
        <div className="inline-flex items-center gap-2 border-2 border-bauhaus-white px-3 py-1.5 mb-5 bg-bauhaus-red">
          <Bot className="h-3.5 w-3.5 text-primary-foreground" />
          <span className="font-bold uppercase tracking-widest text-[10px] text-primary-foreground">Agentic Commerce</span>
        </div>
        <h2 className="font-black uppercase text-3xl sm:text-4xl lg:text-5xl tracking-tighter leading-[0.95]">
          Your AI co-pilot for commerce.
        </h2>
        <p className="font-medium text-sm sm:text-base text-bauhaus-white/70 mt-4 max-w-2xl mx-auto">
          ShopBanao isn't a dashboard you have to babysit. Independent AI agents run inside your store — calling, recovering, optimising — while you focus on product and brand.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-5">
        {agents.map((a) => (
          <div key={a.title} className="border-2 border-bauhaus-white/20 bg-bauhaus-white/[0.03] p-6 hover:bg-bauhaus-white/[0.06] transition-colors">
            <div className="w-10 h-10 border-2 border-bauhaus-white/40 flex items-center justify-center mb-4">
              <a.icon className="h-5 w-5 text-bauhaus-yellow" strokeWidth={2.25} />
            </div>
            <h3 className="font-black uppercase text-lg tracking-tight mb-2">{a.title}</h3>
            <p className="font-medium text-sm text-bauhaus-white/70 leading-relaxed">{a.body}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default AgenticStrip;
