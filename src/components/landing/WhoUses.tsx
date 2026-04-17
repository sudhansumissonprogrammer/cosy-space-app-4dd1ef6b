import { Shirt, Gem, Store, CakeSlice, Cpu, Gift } from "lucide-react";

const audiences = [
  { icon: Shirt, title: "Clothing & Fashion", desc: "Sell ethnic wear, western, kids fashion with size variants.", color: "red" },
  { icon: Gem, title: "Jewellery Shops", desc: "Showcase collections, manage custom orders & pricing.", color: "yellow" },
  { icon: Store, title: "Grocery & Local Stores", desc: "Bring your local store online — take orders 24/7.", color: "blue" },
  { icon: CakeSlice, title: "Bakers & Food Business", desc: "Take cake orders, set delivery slots, manage requests.", color: "red" },
  { icon: Cpu, title: "Electronics & Accessories", desc: "Sell gadgets, accessories, and electronics with variants.", color: "yellow" },
  { icon: Gift, title: "Gift & Handmade Products", desc: "Sell custom gifts, artwork, crafts & handmade items.", color: "blue" },
];

const colorMap: Record<string, string> = { red: "bg-bauhaus-red", blue: "bg-bauhaus-blue", yellow: "bg-bauhaus-yellow" };

const WhoUses = () => {
  return (
    <section id="sellers" className="border-b-4 border-foreground bg-bauhaus-red py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-8 right-8 w-32 h-32 rounded-full border-4 border-white/20 opacity-30" />
      <div className="absolute bottom-8 left-8 w-24 h-24 border-4 border-white/20 rotate-45 opacity-30" />
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-12">
          <span className="font-bold uppercase tracking-widest text-xs text-primary-foreground/70 mb-2 block">For Everyone</span>
          <h2 className="font-black uppercase text-3xl sm:text-4xl lg:text-6xl tracking-tighter leading-[0.9] text-primary-foreground">
            Built For Businesses<br />Like Yours
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {audiences.map((a) => (
            <div key={a.title} className="bg-bauhaus-white border-2 lg:border-4 border-foreground shadow-bauhaus-lg p-5 lg:p-6 hover:-translate-y-1 transition-transform duration-200">
              <div className={`w-12 h-12 ${colorMap[a.color]} border-2 border-foreground shadow-bauhaus-sm flex items-center justify-center mb-4`}>
                <a.icon className={`h-6 w-6 ${a.color === "yellow" ? "text-foreground" : "text-primary-foreground"}`} />
              </div>
              <h3 className="font-bold text-lg uppercase tracking-tight text-foreground mb-2">{a.title}</h3>
              <p className="font-medium text-sm text-muted-foreground leading-relaxed">{a.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhoUses;
