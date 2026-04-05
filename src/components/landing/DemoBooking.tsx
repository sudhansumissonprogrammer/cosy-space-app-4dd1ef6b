import { useState } from "react";
import { ArrowRight } from "lucide-react";

const DemoBooking = () => {
  const [form, setForm] = useState({ name: "", phone: "", business: "", city: "" });

  return (
    <section className="border-b-4 border-foreground bg-bauhaus-red py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-bauhaus-white/10" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-bauhaus-white/10 rotate-45" />
      <div className="max-w-5xl mx-auto relative z-10">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          <div>
            <span className="font-bold uppercase tracking-widest text-xs text-primary-foreground/70 mb-2 block">Book a Demo</span>
            <h2 className="font-black uppercase text-3xl sm:text-4xl lg:text-5xl tracking-tighter leading-[0.9] text-primary-foreground mb-6">See ShopBanao<br />In Action</h2>
            <p className="font-medium text-primary-foreground/80 leading-relaxed mb-8 max-w-md">Get a personalized walkthrough of how ShopBanao can transform your business. Our team will help you set up your store live.</p>
            <div className="space-y-4">
              {["Free 30-min session", "Live store setup", "Payment integration help", "No obligation"].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-bauhaus-yellow border-2 border-foreground flex items-center justify-center"><span className="text-foreground text-xs font-black">✓</span></div>
                  <span className="font-medium text-primary-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-bauhaus-white border-4 border-foreground shadow-bauhaus-lg p-6 lg:p-8">
            <h3 className="font-bold uppercase tracking-wider text-lg text-foreground mb-6">Schedule Your Demo</h3>
            <div className="space-y-4">
              <div>
                <label className="font-bold uppercase tracking-widest text-xs text-muted-foreground mb-1 block">Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border-2 border-foreground p-3 font-medium text-foreground bg-bauhaus-canvas focus:outline-none focus:ring-2 focus:ring-bauhaus-blue" placeholder="Your name" />
              </div>
              <div>
                <label className="font-bold uppercase tracking-widest text-xs text-muted-foreground mb-1 block">Phone</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border-2 border-foreground p-3 font-medium text-foreground bg-bauhaus-canvas focus:outline-none focus:ring-2 focus:ring-bauhaus-blue" placeholder="+91 96922 82485" />
              </div>
              <div>
                <label className="font-bold uppercase tracking-widest text-xs text-muted-foreground mb-1 block">Business Type</label>
                <input type="text" value={form.business} onChange={(e) => setForm({ ...form, business: e.target.value })} className="w-full border-2 border-foreground p-3 font-medium text-foreground bg-bauhaus-canvas focus:outline-none focus:ring-2 focus:ring-bauhaus-blue" placeholder="e.g. Clothing, Bakery" />
              </div>
              <div>
                <label className="font-bold uppercase tracking-widest text-xs text-muted-foreground mb-1 block">City</label>
                <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full border-2 border-foreground p-3 font-medium text-foreground bg-bauhaus-canvas focus:outline-none focus:ring-2 focus:ring-bauhaus-blue" placeholder="Your city" />
              </div>
              <button className="w-full flex items-center justify-center gap-2 bg-bauhaus-red text-primary-foreground font-bold uppercase tracking-wider px-6 py-3.5 border-2 border-foreground shadow-bauhaus-md hover:bg-bauhaus-red/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-200 mt-2">
                Book Free Demo <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DemoBooking;
