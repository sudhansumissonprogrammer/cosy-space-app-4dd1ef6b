import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { SectionHeading } from "@/components/landing/bauhaus/BauhausKit";

const faqs = [
  { q: "What does ShopBanao actually cost?", a: "₹0 subscription, ₹0 setup, ₹0 marketing fee. You pay a flat 3% only on orders that are actually delivered. If an order RTOs, you pay nothing on it." },
  { q: "Why 3% on delivered — and not a subscription?", a: "Because we win only when you win. A subscription charges you in slow months too. Our 3% is success-based: no delivered order, no fee. It keeps us obsessed with your conversion, RTO and retention." },
  { q: "How is ShopBanao different from Shopify or WooCommerce?", a: "Shopify gives you a storefront. ShopBanao is the full agentic commerce OS — storefront + WhatsApp + ads attribution + logistics + AI calling + checkout — built for the Indian buyer. One platform, one bill, one team to call." },
  { q: "What does the 'agentic' part mean in practice?", a: "Independent AI agents run inside your store: a calling agent confirms COD and recovers abandons in Hindi/English, an ads agent watches creative-level ROAS, and a recovery agent re-engages on the right channel — all without you babysitting a dashboard." },
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
        <SectionHeading label="FAQ" size="lg" align="center" labelShape="triangle">
          Frequently asked<br /><span className="text-bauhaus-red">questions</span>
        </SectionHeading>

        <div className="space-y-4">
          {faqs.map((f, i) => (
            <div key={i} className={`border-2 lg:border-4 border-foreground shadow-bauhaus transition-[transform,opacity,colors,box-shadow] duration-200 ${open === i ? "" : "bg-bauhaus-white"}`}>
              <button onClick={() => setOpen(open === i ? null : i)} className={`w-full flex items-center justify-between p-4 lg:p-5 text-left transition-colors duration-200 ${open === i ? "bg-bauhaus-red text-primary-foreground" : "text-foreground hover:bg-muted"}`}>
                <span className="font-bold text-sm lg:text-base pr-4">{f.q}</span>
                <ChevronDown className={`h-5 w-5 flex-shrink-0 transition-transform duration-200 ${open === i ? "rotate-180" : ""}`} />
              </button>
              {open === i && (
                <div className="p-4 lg:p-5 bg-bauhaus-yellow/30 border-t-4 border-foreground">
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
