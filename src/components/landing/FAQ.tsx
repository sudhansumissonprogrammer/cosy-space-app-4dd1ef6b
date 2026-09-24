import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  { q: "What does ShopBanao actually cost?", a: "₹0 subscription, ₹0 setup, ₹0 theme or app fee. You pay a flat 3% on every order placed through ShopBanao — prepaid, COD or RTO. One rate, nothing hidden." },
  { q: "Why 3% on sales — and not a subscription?", a: "A subscription bills you the same in slow months. A flat 3% scales with your business: small when you are starting, predictable when you scale. One rate covers the storefront, WhatsApp, logistics, AI calling and support." },
  { q: "How is ShopBanao different from Shopify or WooCommerce?", a: "Shopify gives you a storefront. ShopBanao is the full commerce OS — storefront + WhatsApp + logistics + AI calling + checkout — built for the Indian buyer. One platform, one bill, one team to call." },
  { q: "What does the 'agentic' part mean in practice?", a: "Independent AI agents run inside your store: a calling agent confirms COD and recovers abandons in Hindi/English, and a recovery agent re-engages on the right channel — all without you babysitting a dashboard." },
  { q: "How quickly can I be live?", a: "Most brands go live in under a day. Pick a theme, import your catalogue, plug UPI / Shiprocket / WhatsApp, and you're shipping. Our team helps free of charge." },
  { q: "Can I migrate from Shopify, Dukaan or WooCommerce?", a: "Yes — and we do it for you. Free migration of products, customers, orders and domain. Zero downtime." },
  { q: "Which payment methods are supported?", a: "UPI, Razorpay, Cashfree, PayU, credit/debit, net banking, wallets and Cash on Delivery. Money settles directly into your bank account." },
  { q: "Is there a contract or lock-in?", a: "No contract, no lock-in. Cancel any time and walk out with all your data — products, customers, orders, designs." },
];

const FAQ_SCRIPT_ID = "faq-jsonld";

const FAQ = () => {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    };
    let el = document.getElementById(FAQ_SCRIPT_ID) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.id = FAQ_SCRIPT_ID;
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(schema);
    return () => { document.getElementById(FAQ_SCRIPT_ID)?.remove(); };
  }, []);

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
            <div key={i} className={`border-2 lg:border-4 border-foreground shadow-bauhaus transition-[transform,opacity,colors,box-shadow] duration-200 ${open === i ? "" : "bg-bauhaus-white"}`}>
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
