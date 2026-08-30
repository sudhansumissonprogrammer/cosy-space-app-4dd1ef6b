import { Sparkles, LineChart, Truck, PhoneCall, Zap, MessageCircle } from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "AI Store Builder",
    body: "Pick a theme, drop your catalogue and your storefront writes its own product copy, alt text and SEO meta.",
    color: "bg-bauhaus-red",
  },
  {
    icon: LineChart,
    title: "Sales Analytics",
    body: "Orders, revenue, repeat customers and top products in one live dashboard — no spreadsheets, no guesswork.",
    color: "bg-bauhaus-blue",
  },
  {
    icon: Truck,
    title: "Zero-RTO Logistics",
    body: "Shiprocket, Delhivery and Bluedart pre-integrated. AI flags high-risk COD orders before they ship.",
    color: "bg-bauhaus-yellow",
  },
  {
    icon: PhoneCall,
    title: "AI Calling Agent",
    body: "Confirms COD, recovers abandoned carts and answers product questions in Hindi & English — 24/7, in your voice.",
    color: "bg-bauhaus-red",
  },
  {
    icon: Zap,
    title: "1-Click Checkout",
    body: "OTP-less Indian checkout. Address auto-fill, UPI intent, COD with prepaid nudge. Drops cart abandonment by ~30%.",
    color: "bg-bauhaus-blue",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp Flows",
    body: "Order updates, abandoned-cart recovery, broadcast campaigns and 2-way support — on your own WABA number.",
    color: "bg-bauhaus-yellow",
  },
];

const CoreFeatures = () => (
  <section id="features" className="border-b-4 border-foreground py-14 sm:py-20 px-4 sm:px-6 lg:px-8">
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-10 sm:mb-14">
        <span className="font-bold uppercase tracking-widest text-xs text-muted-foreground mb-2 block">The Platform</span>
        <h2 className="font-black uppercase text-3xl sm:text-4xl lg:text-5xl tracking-tighter leading-[0.95] text-foreground">
          Everything a D2C brand needs.<br /><span className="text-bauhaus-red">Nothing it doesn't.</span>
        </h2>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        {features.map((f) => (
          <div key={f.title} className="bg-bauhaus-white border-4 border-foreground shadow-bauhaus p-6 hover:-translate-y-1 hover:shadow-bauhaus-lg transition-transform duration-200">
            <div className={`${f.color} w-12 h-12 border-2 border-foreground flex items-center justify-center mb-4`}>
              <f.icon className="h-6 w-6 text-foreground" strokeWidth={2.5} />
            </div>
            <h3 className="font-black uppercase text-lg sm:text-xl text-foreground mb-2 tracking-tight">{f.title}</h3>
            <p className="font-medium text-sm text-muted-foreground leading-relaxed">{f.body}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default CoreFeatures;
