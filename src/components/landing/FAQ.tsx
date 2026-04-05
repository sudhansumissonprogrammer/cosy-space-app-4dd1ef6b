import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  { q: "How quickly can I set up my store?", a: "You can have your store live in under 10 minutes. Just sign up, add your products, choose a theme, and you're ready to sell." },
  { q: "Do I need any technical knowledge?", a: "Not at all! ShopBanao is designed for non-technical users. If you can use WhatsApp, you can run a store on ShopBanao." },
  { q: "What payment methods are supported?", a: "We support UPI, credit/debit cards, net banking, wallets, and Cash on Delivery. Payments go directly to your bank account." },
  { q: "Is there any commission on sales?", a: "Zero commission, ever. You keep 100% of your sales revenue. We only charge a flat monthly subscription fee." },
  { q: "Can I use my own domain name?", a: "Yes! You can connect your own domain (like yourstore.com) or use a free shopbanao.in subdomain." },
  { q: "What happens after the free trial?", a: "After 7 days, you can choose a plan that fits your needs. Your store and data remain intact. No surprise charges." },
  { q: "Do you provide delivery/shipping support?", a: "Yes, we integrate with Shiprocket, Delhivery, and other logistics partners. You can also set up local delivery zones." },
  { q: "Can I migrate from another platform?", a: "Absolutely. We offer free migration support. Our team will help you move your products, customers, and orders seamlessly." },
];

const FAQ = () => {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="border-b-4 border-foreground py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8 bg-bauhaus-canvas">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <span className="font-bold uppercase tracking-widest text-xs text-muted-foreground mb-2 block">FAQ</span>
          <h2 className="font-black uppercase text-3xl sm:text-4xl lg:text-5xl tracking-tighter leading-[0.9] text-foreground">
            Frequently Asked<br /><span className="text-bauhaus-red">Questions</span>
          </h2>
        </div>
        <div className="space-y-4">
          {faqs.map((f, i) => (
            <div key={i} className={`border-2 lg:border-4 border-foreground shadow-bauhaus transition-all duration-200 ${open === i ? "" : "bg-bauhaus-white"}`}>
              <button onClick={() => setOpen(open === i ? null : i)} className={`w-full flex items-center justify-between p-4 lg:p-5 text-left transition-colors duration-200 ${open === i ? "bg-bauhaus-red text-primary-foreground" : "text-foreground hover:bg-muted"}`}>
                <span className="font-bold text-sm lg:text-base pr-4">{f.q}</span>
                <ChevronDown className={`h-5 w-5 flex-shrink-0 transition-transform duration-200 ${open === i ? "rotate-180" : ""}`} />
              </button>
              {open === i && (
                <div className="p-4 lg:p-5 bg-[#FFF9C4] border-t-4 border-foreground">
                  <p className="font-medium text-sm text-foreground leading-relaxed">{f.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQ;
