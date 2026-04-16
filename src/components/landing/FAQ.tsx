import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  { q: "How does the process work?", a: "It's simple — you share your business details, products & preferences. Our team designs and builds your store. You review it, we make changes, and launch it on your domain. Done!" },
  { q: "How long does it take?", a: "Most stores are ready within 48 hours. Complex stores with many products may take 3-4 days. We'll give you a timeline upfront." },
  { q: "What's included?", a: "Everything you need: custom design, product upload, UPI & card payments setup, WhatsApp integration, custom domain connection, mobile-optimized store, and basic SEO setup." },
  { q: "Do I need technical knowledge to manage it?", a: "Not at all! We provide an easy dashboard where you can add products, manage orders, and track sales. If you can use WhatsApp, you can manage your store." },
  { q: "What payment methods will my store support?", a: "We set up UPI, credit/debit cards, net banking, wallets, and Cash on Delivery. Payments go directly to your bank account." },
  { q: "Can I get a custom domain?", a: "Yes! We'll connect your own domain (like yourstore.com) or set you up with a free shopbanao.in subdomain." },
  { q: "What if I need changes later?", a: "Minor changes and updates are included. For major redesigns or new features, we offer affordable maintenance packages." },
  { q: "Do you provide ongoing support?", a: "Yes — we provide support via WhatsApp to help you with any questions or issues. We're always just a message away." },
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
