import { MessageCircle } from "lucide-react";

const PHONE = "919876543210";
const MESSAGE = encodeURIComponent("Hi! I want to know more about ShopBanao");

const LandingWhatsApp = () => (
  <a
    href={`https://wa.me/${PHONE}?text=${MESSAGE}`}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Chat on WhatsApp"
    className="fixed bottom-20 lg:bottom-6 right-4 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] text-white shadow-lg hover:scale-110 transition-transform duration-200 border-2 border-foreground"
  >
    <MessageCircle className="h-7 w-7" fill="white" strokeWidth={0} />
  </a>
);

export default LandingWhatsApp;
