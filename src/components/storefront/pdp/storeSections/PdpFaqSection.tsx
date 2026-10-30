import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { Link } from "react-router-dom";
import { storefrontPath } from "@/lib/subdomain";
import type { ReactNode } from "react";

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
  {
    q: "Is an unboxing video required for return or refund?",
    a: "Yes — it is mandatory. Please record a clear, uncut unboxing video that shows the sealed parcel, the label and the complete opening of the box. Return, replacement or refund claims for damaged, defective, missing or wrong items cannot be approved without this video.",
  },
  {
    q: "How do I raise a return or refund request?",
    a: "Contact us on WhatsApp or call within 7 days of delivery with your order number and the unboxing video. Once verified, we arrange the pickup and process the refund to your original payment method within 5–7 business days after the item reaches us and passes inspection.",
  },
];

export default function PdpFaqSection({ store }: { store?: { slug: string } } = {}) {
  const [open, setOpen] = useState<number | null>(null);
  const faqs: { q: string; a: ReactNode }[] = store ? [
    { q: "How can I contact support?", a: "You can reach us via WhatsApp, phone or email mentioned on the website." },
    { q: "Will I receive confirmation before dispatch?", a: "Yes, you will receive a packing photo and invoice on WhatsApp before the order is shipped." },
    { q: "Is the watch covered under warranty?", a: "Yes, the watch comes with a 6-month warranty covering the internal movement." },
    { q: "What does the warranty include?", a: "The warranty covers functional issues related to the movement. Damage due to impact, mishandling or normal wear is not included." },
    { q: "Is the watch water resistant?", a: "Yes, the watch is water resistant for daily use like hand washing and splashes. It is not meant for swimming or showering." },
    { q: "What material is the watch made of?", a: "All our watches feature a stainless steel and metal build with a long-lasting premium finish." },
    { q: "How long does delivery take?", a: "Orders are dispatched within 24–48 hours and usually delivered within 2–5 working days depending on your location." },
  ] : FAQS;

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
        {faqs.map((item, i) => {
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
