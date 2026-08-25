import { useState } from "react";
import { Plus, Minus } from "lucide-react";

const FAQS: { q: string; a: string }[] = [
  {
    q: "How can I contact support?",
    a: "You can reach us on WhatsApp or call us directly from the buttons on this page. Our team replies on all days between 10 AM and 7 PM.",
  },
  {
    q: "Will I receive confirmation before dispatch?",
    a: "Yes. Every order is confirmed on WhatsApp/call before it is packed and dispatched, so nothing ships without your approval.",
  },
  {
    q: "Is the watch covered under warranty?",
    a: "Yes, every watch carries a brand warranty against manufacturing defects from the date of delivery.",
  },
  {
    q: "What does the warranty include?",
    a: "The warranty covers machine and movement related manufacturing defects. Physical damage, water entry due to misuse, and normal wear of straps or glass are not covered.",
  },
  {
    q: "Is the watch water resistant?",
    a: "Most models are splash and rain resistant for daily use. They are not meant for swimming, diving or hot showers unless the product description says otherwise.",
  },
  {
    q: "What material is the watch made of?",
    a: "Watches are built with premium stainless steel, mineral/sapphire-coated glass and genuine or premium leather straps depending on the model.",
  },
  {
    q: "How long does delivery take?",
    a: "Orders are dispatched within 24 hours and usually delivered in 3–6 working days depending on your pincode.",
  },
];

export default function PdpFaqSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section
      data-sf-qa="faq"
      className="mt-8 rounded-2xl border border-border bg-card px-4 py-7 sm:px-8 sm:py-10"
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 640px" } as React.CSSProperties}
    >
      <p className="text-center text-[10px] font-bold uppercase tracking-[0.22em] text-primary/70">
        Need to know
      </p>
      <h2 className="mt-2 text-center text-3xl font-light leading-tight tracking-tight text-foreground sm:text-4xl">
        Frequently Asked
        <br className="sm:hidden" /> Questions
      </h2>
      <p className="mt-3 text-center text-sm text-muted-foreground">
        Quick answers before you place your order.
      </p>

      <div className="mx-auto mt-6 max-w-2xl divide-y divide-border border-t border-border">
        {FAQS.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={item.q}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 py-4 text-left"
              >
                <span className="text-[15px] font-bold text-foreground">{item.q}</span>
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    isOpen ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground"
                  }`}
                >
                  {isOpen ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                </span>
              </button>
              <div
                className={`grid overflow-hidden transition-all duration-300 ${
                  isOpen ? "grid-rows-[1fr] pb-4 opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="min-h-0">
                  <p className="pr-10 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
