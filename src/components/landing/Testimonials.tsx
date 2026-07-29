import { Quote, Star } from "lucide-react";

const testimonials = [
  { quote: "I was losing ₹15,000/month in marketplace commissions. Switched to ShopBanao and saved ₹45,000 in just 3 months. Setup took 15 minutes flat!", metric: "Saved ₹45,000 in 3 months", name: "Priya Sharma", role: "Fashion Boutique Owner", city: "Mumbai", color: "red" },
  { quote: "WhatsApp integration changed everything. I went from 8 orders a week to 34 — customers message me directly and I convert instantly.", metric: "34 orders/week", name: "Rahul Verma", role: "Electronics Store", city: "Delhi", color: "blue" },
  { quote: "I was paying ₹15,000/month in commissions on Swiggy. Now I pay ₹999 flat and keep 100% of my revenue. Best business decision I've made.", metric: "₹15,000/month saved", name: "Anita Desai", role: "Home Baker", city: "Pune", color: "yellow" },
];

const colorMap: Record<string, { border: string; bg: string; text: string }> = {
  red: { border: "border-bauhaus-red", bg: "bg-bauhaus-red", text: "text-primary-foreground" },
  blue: { border: "border-bauhaus-blue", bg: "bg-bauhaus-blue", text: "text-primary-foreground" },
  yellow: { border: "border-bauhaus-yellow", bg: "bg-bauhaus-yellow", text: "text-foreground" },
};

const Stars = () => (
  <div className="flex gap-0.5">
    {[...Array(5)].map((_, i) => (
      <Star key={i} className="h-4 w-4 fill-bauhaus-yellow text-bauhaus-yellow" />
    ))}
  </div>
);

const Testimonials = () => (
  <section className="border-b-4 border-foreground py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8">
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-12">
        <span className="font-bold uppercase tracking-widest text-xs text-muted-foreground mb-2 block">Testimonials</span>
        <h2 className="font-black uppercase text-3xl sm:text-4xl lg:text-6xl tracking-tighter leading-[0.9] text-foreground">
          Real Results From<br /><span className="text-bauhaus-blue">Real Sellers</span>
        </h2>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {testimonials.map((t) => (
          <div key={t.name} className={`bg-bauhaus-white border-4 border-foreground shadow-bauhaus-lg relative hover:-translate-y-1 transition-transform duration-200 border-t-8 ${colorMap[t.color].border}`}>
            {/* Metric badge */}
            <div className={`${colorMap[t.color].bg} px-4 py-2 border-b-2 border-foreground`}>
              <span className={`font-black text-lg ${colorMap[t.color].text}`}>{t.metric}</span>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Quote className="h-7 w-7 text-muted fill-muted" />
                <Stars />
              </div>
              <p className="font-medium text-foreground leading-relaxed mb-6">"{t.quote}"</p>
              <div className="flex items-center gap-3 pt-4 border-t-2 border-foreground">
                <div className="w-12 h-12 rounded-full bg-muted border-2 border-foreground flex items-center justify-center">
                  <span className="font-black text-lg text-muted-foreground">{t.name[0]}</span>
                </div>
                <div>
                  <div className="font-bold text-sm text-foreground">{t.name}</div>
                  <div className="font-medium text-xs text-muted-foreground">{t.role}, {t.city}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default Testimonials;
