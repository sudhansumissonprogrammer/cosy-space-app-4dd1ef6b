import { MessageCircle } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";

interface FloatingWhatsAppProps {
  store: StoreData;
}

export default function FloatingWhatsApp({ store }: FloatingWhatsAppProps) {
  if (!store.whatsapp_number) return null;

  const phone = store.whatsapp_number.replace(/[^0-9+]/g, "");
  const message = encodeURIComponent(
    `Hi ${store.name}! 👋\nI'm interested in buying products from your store. Could you help me?`
  );
  const href = `https://wa.me/${phone}?text=${message}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-[#25D366]/30 transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-[#25D366]/40 active:scale-95"
    >
      <MessageCircle className="h-7 w-7" fill="white" strokeWidth={0} />
    </a>
  );
}
