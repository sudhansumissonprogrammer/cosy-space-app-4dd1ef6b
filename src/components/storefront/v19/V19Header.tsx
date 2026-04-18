/**
 * V19 Header — Quick commerce grocery green header.
 * Top row: Store name + WhatsApp icon
 * Sub row: "Set delivery location" pill (static, no GPS)
 * Bottom row: Sticky search bar
 * Below header: yellow rolling marquee
 */
import { Search, MessageCircle, MapPin, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { storefrontPath } from "@/lib/subdomain";

export default function V19Header({ store }: { store: any }) {
  const waNum = store?.whatsapp_number?.replace(/\D/g, "") || "";
  const slug = store?.slug || "";

  return (
    <header className="sticky top-0 z-40 shadow-md" style={{ background: "#036B52" }}>
      {/* Top: store name + WhatsApp */}
      <div className="px-4 pt-3 pb-2 flex items-start justify-between">
        <div className="flex flex-col">
          <Link to={storefrontPath(slug)} className="text-white text-2xl font-black leading-none tracking-tight">
            {store?.name || "Store"}
          </Link>
          <button className="mt-1.5 inline-flex items-center gap-1 text-white/90 text-[12px] font-medium">
            <MapPin className="h-3.5 w-3.5" strokeWidth={2.5} />
            <span>Set delivery location</span>
            <ChevronDown className="h-3 w-3" strokeWidth={2.5} />
          </button>
        </div>
        {waNum && (
          <a
            href={`https://wa.me/${waNum}`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 w-9 rounded-full flex items-center justify-center"
            style={{ background: "#25D366" }}
            aria-label="WhatsApp"
          >
            <MessageCircle className="h-5 w-5 text-white" fill="white" />
          </a>
        )}
      </div>

      {/* Search bar */}
      <div className="px-4 pb-3">
        <Link to={storefrontPath(slug, "shop")} className="flex items-center gap-2 bg-white rounded-full px-4 py-2.5 shadow-sm">
          <Search className="h-4 w-4 text-gray-500" strokeWidth={2.5} />
          <span className="text-[13px] text-gray-500 font-medium">Search products...</span>
        </Link>
      </div>

      {/* Yellow rolling strip */}
      <div className="v19-marquee-yellow">
        <div className="flex gap-8 animate-marquee whitespace-nowrap">
          <span className="px-2">✦ Free delivery on all orders!</span>
          <span className="px-2">✦ Free delivery on all orders!</span>
          <span className="px-2">✦ Free delivery on all orders!</span>
          <span className="px-2">✦ Free delivery on all orders!</span>
          <span className="px-2">✦ Free delivery on all orders!</span>
          <span className="px-2">✦ Free delivery on all orders!</span>
        </div>
      </div>
    </header>
  );
}
