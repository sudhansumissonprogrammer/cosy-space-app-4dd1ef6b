import { ExternalLink } from "lucide-react";

const stores = [
  { name: "FashionHub", type: "Clothing Store", color: "red", products: ["Ethnic Wear", "Western Dresses", "Accessories"], revenue: "₹2.5L/month" },
  { name: "BakeMyDay", type: "Bakery & Cakes", color: "yellow", products: ["Custom Cakes", "Pastries", "Gift Boxes"], revenue: "₹1.8L/month" },
  { name: "FitGear Pro", type: "Fitness Equipment", color: "blue", products: ["Dumbbells", "Yoga Mats", "Resistance Bands"], revenue: "₹3.2L/month" },
  { name: "GoldCraft", type: "Jewellery Store", color: "red", products: ["Necklaces", "Earrings", "Bracelets"], revenue: "₹4.1L/month" },
];

const colorMap: Record<string, string> = { red: "bg-bauhaus-red", blue: "bg-bauhaus-blue", yellow: "bg-bauhaus-yellow" };

const StoreShowcases = () => {
  return (
    <section className="border-b-4 border-foreground py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <span className="font-bold uppercase tracking-widest text-xs text-muted-foreground mb-2 block">Showcase</span>
          <h2 className="font-black uppercase text-3xl sm:text-4xl lg:text-6xl tracking-tighter leading-[0.9] text-foreground">
            Stores Built With<br /><span className="text-bauhaus-red">ShopBanao</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {stores.map((s) => (
            <div key={s.name} className="bg-bauhaus-white border-2 lg:border-4 border-foreground shadow-bauhaus-lg hover:-translate-y-2 transition-transform duration-200 group">
              <div className={`${colorMap[s.color]} p-4 border-b-4 border-foreground`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-lg uppercase tracking-tight text-primary-foreground">{s.name}</h3>
                  <ExternalLink className="h-4 w-4 text-primary-foreground/70" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-primary-foreground/80">{s.type}</span>
              </div>
              <div className="p-4 space-y-2">
                {s.products.map((p) => (
                  <div key={p} className="flex items-center gap-2"><div className="w-2 h-2 bg-foreground rounded-full" /><span className="font-medium text-sm text-foreground">{p}</span></div>
                ))}
              </div>
              <div className="px-4 pb-4 pt-2 border-t-2 border-foreground">
                <span className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Revenue</span>
                <div className="font-black text-xl text-foreground">{s.revenue}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StoreShowcases;
