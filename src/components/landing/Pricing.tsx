import { Check, ArrowRight, Star } from "lucide-react";

const WA_LINK = "https://wa.me/919692282485?text=Hi!%20I%20want%20to%20get%20my%20online%20store%20built";

const included = [
  "Custom Domain Setup",
  "Mobile-Optimized Store",
  "UPI, Cards & COD Payments",
  "Product Catalog (Unlimited)",
  "WhatsApp Order Notifications",
  "SEO Optimized Pages",
  "SSL Certificate & Security",
  "Social Media Integration",
  "Analytics Dashboard",
  "Coupons & Discounts",
  "Shipping Configuration",
  "About Us, Contact, Policies Pages",
];

const Pricing = () => {
  return (
    <section id="pricing" className="border-b-4 border-foreground py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8 bg-bauhaus-canvas">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <span className="inline-block font-bold uppercase tracking-widest text-xs text-primary-foreground bg-bauhaus-blue border-2 border-foreground px-4 py-1.5 shadow-bauhaus-sm mb-4">
            Pricing
          </span>
          <h2 className="font-black uppercase text-3xl sm:text-4xl lg:text-6xl tracking-tighter leading-[0.9] text-foreground">
            One Price.<br /><span className="text-bauhaus-red">Everything Included.</span>
          </h2>
          <p className="font-medium text-muted-foreground mt-4 max-w-md mx-auto">
            No monthly fees. No commission. No hidden charges. Just one simple payment.
          </p>
        </div>

        {/* Main pricing card */}
        <div className="bg-bauhaus-white border-4 border-foreground shadow-bauhaus-lg relative max-w-xl mx-auto">
          {/* Popular badge */}
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-bauhaus-red text-primary-foreground font-bold uppercase tracking-widest text-xs px-6 py-2 border-2 border-foreground shadow-bauhaus-sm whitespace-nowrap flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 fill-current" /> Most Popular
          </div>

          {/* Price header */}
          <div className="bg-bauhaus-red p-6 sm:p-8 border-b-4 border-foreground text-center">
            <h3 className="font-bold uppercase tracking-wider text-sm text-primary-foreground mb-1">Complete Online Store</h3>
            <div className="font-black text-5xl sm:text-6xl text-primary-foreground">
              ₹10,000
            </div>
            <p className="font-semibold text-primary-foreground/80 text-sm mt-1">One-time payment • No recurring fees</p>
          </div>

          {/* Features grid */}
          <div className="p-6 sm:p-8">
            <p className="font-bold uppercase tracking-wider text-xs text-muted-foreground mb-4">Everything you get:</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {included.map((f) => (
                <div key={f} className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-bauhaus-blue flex items-center justify-center flex-shrink-0">
                    <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
                  </div>
                  <span className="font-medium text-sm text-foreground">{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="p-6 sm:p-8 pt-0 space-y-3">
            <a
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-bauhaus-red text-primary-foreground font-bold uppercase tracking-wider text-sm px-6 py-4 border-2 border-foreground shadow-bauhaus hover:bg-bauhaus-red/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-200"
            >
              Get Your Store Built <ArrowRight className="h-4 w-4" />
            </a>
            <p className="text-center text-xs text-muted-foreground font-medium">
              Ready in 48 hours • Ongoing support included • Custom domain free
            </p>
          </div>
        </div>

        {/* Bottom reassurance */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          {[
            { label: "Ready in 48 Hours", sub: "Fast delivery guaranteed" },
            { label: "Free Revisions", sub: "Until you're 100% happy" },
            { label: "Ongoing Support", sub: "We're always here to help" },
          ].map((item) => (
            <div key={item.label} className="bg-bauhaus-white border-2 border-foreground p-4 shadow-bauhaus-sm">
              <p className="font-bold text-sm uppercase tracking-tight text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">{item.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
