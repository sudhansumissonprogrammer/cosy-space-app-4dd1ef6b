import { useEffect, useState } from "react";

interface PdpAskWhatsAppProps {
  phone: string;
  storeName: string;
  productName: string;
  productUrl: string;
  priceLabel: string;
  /** When true, lifts above the sticky CTA bar so it doesn't overlap. */
  liftedAboveStickyBar?: boolean;
}

/**
 * Persistent product-aware WhatsApp "Ask about this product" button on PDP.
 * Pre-fills product link, name and price so seller has full context.
 * Positioned bottom-left so it doesn't collide with cart/right-side floaters.
 */
export default function PdpAskWhatsApp({
  phone,
  storeName,
  productName,
  productUrl,
  priceLabel,
  liftedAboveStickyBar,
}: PdpAskWhatsAppProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 240);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const cleanedPhone = phone.replace(/[^0-9+]/g, "");
  if (!cleanedPhone) return null;

  const text = `Hi ${storeName}! 👋\n\nI have a question about *${productName}* (${priceLabel}).\n\n🔗 ${productUrl}\n\nCould you share more details — purity, weight, availability and customisation options?`;
  const href = `https://wa.me/${encodeURIComponent(cleanedPhone)}?text=${encodeURIComponent(text)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Ask about this product on WhatsApp"
      className={`fixed left-4 z-40 flex items-center gap-2 rounded-full bg-[#25D366] px-3.5 h-11 text-white shadow-lg shadow-[#25D366]/30 transition-all duration-300 active:scale-95 hover:brightness-110 ${
        show ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
      }`}
      style={{ bottom: liftedAboveStickyBar ? "calc(80px + env(safe-area-inset-bottom))" : "20px" }}
    >
      <svg viewBox="0 0 32 32" fill="white" className="h-5 w-5 shrink-0">
        <path d="M16.004 3.2C9.056 3.2 3.406 8.848 3.404 15.8c-.001 2.222.58 4.392 1.683 6.303L3.2 28.8l6.867-1.802A12.56 12.56 0 0 0 16 28.398h.005C22.95 28.398 28.6 22.75 28.6 15.8 28.6 8.85 22.95 3.2 16.004 3.2Zm5.74 15.362c-.315-.158-1.863-.92-2.152-1.025-.289-.105-.499-.158-.71.158-.21.315-.815 1.025-.999 1.236-.184.21-.368.236-.683.079-.315-.158-1.33-.49-2.533-1.562-.937-.835-1.568-1.867-1.752-2.182-.184-.315-.02-.486.138-.643.142-.141.315-.368.473-.552.158-.184.21-.315.315-.526.106-.21.053-.394-.026-.552-.079-.158-.71-1.71-.973-2.341-.256-.615-.517-.532-.71-.542-.184-.008-.394-.01-.604-.01s-.552.079-.841.394c-.29.315-1.104 1.078-1.104 2.63 0 1.552 1.13 3.052 1.288 3.262.158.21 2.224 3.396 5.388 4.762.753.326 1.341.52 1.8.665.756.24 1.444.206 1.988.125.607-.09 1.863-.762 2.126-1.498.263-.736.263-1.367.184-1.498-.079-.132-.289-.21-.604-.369Z" />
      </svg>
      <span className="text-[12px] font-bold whitespace-nowrap">Ask about this</span>
    </a>
  );
}
