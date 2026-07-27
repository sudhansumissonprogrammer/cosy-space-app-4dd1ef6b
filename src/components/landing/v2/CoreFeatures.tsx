import { Sparkles, LineChart, Truck, PhoneCall, Zap, MessageCircle } from "lucide-react";
import { BauCard, SectionHeading } from "@/components/landing/bauhaus/BauhausKit";

const features = [
  {
    icon: Sparkles,
    title: "AI Store Builder",
    body: "Pick a theme, drop your catalogue and your storefront writes its own product copy, alt text and SEO meta.",
    color: "bg-bauhaus-red",
    iconTone: "text-primary-foreground",
  },
  {
    icon: LineChart,
    title: "AI Ads Tracker",
    body: "Meta, Google and influencer spend pulled into one dashboard. See ROAS per creative, not per campaign.",
    color: "bg-bauhaus-blue",
    iconTone: "text-primary-foreground",
  },
  {
    icon: Truck,
    title: "Zero-RTO Logistics",
    body: "Shiprocket, Delhivery and Bluedart pre-integrated. AI flags high-risk COD orders before they ship.",
    color: "bg-bauhaus-yellow",
    iconTone: "text-foreground",
  },
  {
    icon: PhoneCall,
    title: "AI Calling Agent",
    body: "Confirms COD, recovers abandoned carts and answers product questions in Hindi & English — 24/7, in your voice.",
    color: "bg-bauhaus-red",
    iconTone: "text-primary-foreground",
  },
  {
    icon: Zap,
    title: "1-Click Checkout",
    body: "OTP-less Indian checkout. Address auto-fill, UPI intent, COD with prepaid nudge. Drops cart abandonment by ~30%.",
    color: "bg-bauhaus-blue",
    iconTone: "text-primary-foreground",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp Flows",
    body: "Order updates, abandoned-cart recovery, broadcast campaigns and 2-way support — on your own WABA number.",
    color: "bg-bauhaus-yellow",
    iconTone: "text-foreground",
  },
];

const CoreFeatures = () => (
  <section id="features" className="border-b-4 border-foreground py-14 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8">
    <div className="max-w-7xl mx-auto">
      <SectionHeading label="The Platform" size="lg">
        Everything a D2C brand needs.<br />
        <span className="text-bauhaus-red">Nothing it doesn't.</span>
      </SectionHeading>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        {features.map((f, i) => (
          <BauCard key={f.title} index={i} className="p-6 group" shadow="shadow-bauhaus sm:shadow-bauhaus-md">
            <div
              className={`${f.color} w-12 h-12 border-2 border-foreground flex items-center justify-center mb-4 transition-transform duration-200 ease-out group-hover:scale-110 ${
                i % 3 === 2 ? "rounded-full" : "rounded-none"
              }`}
            >
              <f.icon className={`h-6 w-6 ${f.iconTone}`} strokeWidth={2.5} />
            </div>
            <h3 className="font-black uppercase text-lg sm:text-xl text-foreground mb-2 tracking-tight">{f.title}</h3>
            <p className="font-medium text-sm text-muted-foreground leading-relaxed">{f.body}</p>
          </BauCard>
        ))}
      </div>
    </div>
  </section>
);

export default CoreFeatures;
