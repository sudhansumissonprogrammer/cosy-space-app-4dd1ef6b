import { Quote } from "lucide-react";

const testimonials = [
  { quote: "ShopBanao transformed my clothing business. I went from paying 30% commission to keeping all my profits. Setup took just 15 minutes!", name: "Priya Sharma", role: "Fashion Boutique Owner", city: "Mumbai", color: "red" },
  { quote: "The WhatsApp integration is a game changer. My customers order directly from my store and I get notifications instantly.", name: "Rahul Verma", role: "Electronics Store", city: "Delhi", color: "blue" },
  { quote: "I was paying ₹15,000/month in commissions. Now I pay a flat ₹999 and keep everything else. Best business decision ever.", name: "Anita Desai", role: "Home Baker", city: "Pune", color: "yellow" },
];

const colorMap: Record<string, string> = { red: "border-bauhaus-red", blue: "border-bauhaus-blue", yellow: "border-bauhaus-yellow" };

const Testimonials = () => {
  return (
    <section className="border-b-4 border-foreground py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <span className="font-bold uppercase tracking-widest text-xs text-muted-foreground mb-2 block">Testimonials</span>
          <h2 className="font-black uppercase text-3xl sm:text-4xl lg:text-6xl tracking-tighter leading-[0.9] text-foreground">
            What Sellers<br /><span className="text-bauhaus-blue">Say</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div key={t.name} className={`bg-bauhaus-white border-4 border-foreground shadow-bauhaus-lg p-6 relative hover:-translate-y-1 transition-transform duration-200 border-t-8 ${colorMap[t.color]}`}>
              <div className="mb-4"><Quote className="h-8 w-8 text-muted fill-muted" /></div>
              <p className="font-medium text-foreground leading-relaxed mb-6">"{t.quote}"</p>
              <div className="flex items-center gap-3 pt-4 border-t-2 border-foreground">
                <div className="w-12 h-12 rounded-full bg-muted border-2 border-foreground grayscale flex items-center justify-center">
                  <span className="font-black text-lg text-muted-foreground">{t.name[0]}</span>
                </div>
                <div>
                  <div className="font-bold text-sm text-foreground">{t.name}</div>
                  <div className="font-medium text-xs text-muted-foreground">{t.role}, {t.city}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
