import { X, Check } from "lucide-react";

const normalSite = ["Only shows products", "No order system", "No payment integration", "No customer tracking", "No WhatsApp automation"];
const shopBanao = ["Full online store", "Order + payment system", "Customer data collected", "WhatsApp marketing built-in", "Admin dashboard to manage everything"];

const WhyNotWebsite = () => {
  return (
    <section className="border-b-4 border-foreground py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8 bg-bauhaus-canvas">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <span className="inline-block font-bold uppercase tracking-widest text-xs text-primary-foreground bg-bauhaus-red border-2 border-foreground px-4 py-1.5 shadow-bauhaus-sm mb-4">Compare</span>
          <h2 className="font-black uppercase text-3xl sm:text-4xl lg:text-5xl tracking-tighter leading-[0.9] text-foreground">
            Why Not Just a<br /><span className="text-bauhaus-red">Normal Website?</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4 lg:gap-6">
          <div className="bg-bauhaus-white border-2 lg:border-4 border-foreground shadow-bauhaus-lg">
            <div className="bg-foreground p-4 lg:p-5"><h3 className="font-bold uppercase tracking-wider text-sm text-primary-foreground text-center">❌ Normal Website</h3></div>
            <div className="p-5 lg:p-6 space-y-3">
              {normalSite.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-bauhaus-red/15 flex items-center justify-center flex-shrink-0"><X className="h-3.5 w-3.5 text-bauhaus-red" strokeWidth={3} /></div>
                  <span className="font-medium text-sm text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-bauhaus-white border-2 lg:border-4 border-foreground shadow-bauhaus-lg relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-bauhaus-yellow text-foreground font-bold uppercase tracking-widest text-[10px] px-4 py-1.5 border-2 border-foreground shadow-bauhaus-sm">Recommended</div>
            <div className="bg-bauhaus-blue p-4 lg:p-5"><h3 className="font-bold uppercase tracking-wider text-sm text-primary-foreground text-center">✅ ShopBanao</h3></div>
            <div className="p-5 lg:p-6 space-y-3">
              {shopBanao.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#16a34a]/15 flex items-center justify-center flex-shrink-0"><Check className="h-3.5 w-3.5 text-[#16a34a]" strokeWidth={3} /></div>
                  <span className="font-bold text-sm text-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhyNotWebsite;
