import { Globe, CreditCard, MessageCircle, BarChart3, Star, ShoppingBag, Truck, Palette, Tag, Users, Search, Shield } from "lucide-react";

const features = [
  { icon: Globe, title: "Custom Domain", desc: "Use your own domain like yourstore.com for a professional brand identity.", cat: "Branding", color: "red" },
  { icon: CreditCard, title: "UPI & Payment Gateway", desc: "Accept UPI, cards, net banking, and wallets. Money goes directly to your account.", cat: "Payments", color: "blue" },
  { icon: MessageCircle, title: "WhatsApp Integration", desc: "Receive orders, send updates, and chat with customers on WhatsApp.", cat: "Communication", color: "yellow" },
  { icon: ShoppingBag, title: "Product Management", desc: "Add unlimited products with variants, images, and inventory tracking.", cat: "Store", color: "blue" },
  { icon: Truck, title: "Delivery Integration", desc: "Built-in shipping with Shiprocket, Delhivery, and local delivery options.", cat: "Logistics", color: "red" },
  { icon: Palette, title: "Store Themes", desc: "Choose from beautiful themes and customize colors, fonts, and layouts.", cat: "Design", color: "yellow" },
  { icon: Tag, title: "Coupons & Discounts", desc: "Create discount codes, flash sales, and bundle offers to boost sales.", cat: "Marketing", color: "red" },
  { icon: Users, title: "Customer Management", desc: "Build your customer database with profiles, order history, and segments.", cat: "CRM", color: "blue" },
  { icon: BarChart3, title: "Analytics Dashboard", desc: "Track sales, visitors, conversion rates, and revenue in real time.", cat: "Analytics", color: "yellow" },
  { icon: Search, title: "SEO Tools", desc: "Optimize your store for Google with meta tags, sitemaps, and clean URLs.", cat: "Growth", color: "blue" },
  { icon: Star, title: "Product Reviews", desc: "Collect and display customer reviews to build trust and credibility.", cat: "Social Proof", color: "red" },
  { icon: Shield, title: "SSL Security", desc: "Free SSL certificate for secure checkout and customer data protection.", cat: "Security", color: "yellow" },
];

const colorMap: Record<string, string> = { red: "bg-bauhaus-red", blue: "bg-bauhaus-blue", yellow: "bg-bauhaus-yellow" };

const FeaturesGrid = () => {
  return (
    <section id="features" className="border-b-4 border-foreground bg-bauhaus-canvas py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <span className="font-bold uppercase tracking-widest text-xs text-muted-foreground mb-2 block">Features</span>
          <h2 className="font-black uppercase text-3xl sm:text-4xl lg:text-6xl tracking-tighter leading-[0.9] text-foreground">
            All Features.<br /><span className="text-bauhaus-blue">One Flat Price.</span>
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {features.map((f, i) => (
            <div key={f.title} className="bg-bauhaus-white border-2 lg:border-4 border-foreground shadow-bauhaus p-5 lg:p-6 relative hover:-translate-y-1 transition-transform duration-200 group">
              <div className={`absolute top-3 right-3 w-3 h-3 ${i % 3 === 0 ? "rounded-full bg-bauhaus-red" : i % 3 === 1 ? "bg-bauhaus-blue" : "bg-bauhaus-yellow rotate-45"}`} />
              <div className={`w-12 h-12 ${colorMap[f.color]} border-2 border-foreground shadow-bauhaus-sm flex items-center justify-center mb-4`}>
                <f.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="font-bold uppercase tracking-widest text-[10px] text-muted-foreground">{f.cat}</span>
              <h3 className="font-bold text-lg text-foreground mt-1 mb-2">{f.title}</h3>
              <p className="font-medium text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesGrid;
