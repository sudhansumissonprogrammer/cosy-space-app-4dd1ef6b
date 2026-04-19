/**
 * V19 Header — Blinkit-style: "Delivery in 11 minutes" + address + rotating search placeholder.
 */
import { useEffect, useState } from "react";
import { Search, ChevronDown, User } from "lucide-react";
import { Link } from "react-router-dom";
import { storefrontPath } from "@/lib/subdomain";

const SEARCH_TERMS = ['"milk"', '"bread"', '"eggs"', '"atta"', '"cold drinks"', '"chips"', '"chocolate"'];

export default function V19Header({ store }: { store: any }) {
  const slug = store?.slug || "";
  const [termIdx, setTermIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTermIdx((i) => (i + 1) % SEARCH_TERMS.length), 2200);
    return () => clearInterval(id);
  }, []);

  const addressLine = store?.city || store?.location || store?.name || "Your location";

  return (
    <header className="sticky top-0 z-40 shadow-md" style={{ background: "#036B52" }}>
      {/* Top: Delivery info + profile */}
      <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-3">
        <Link to={storefrontPath(slug)} className="flex-1 min-w-0">
          <div className="text-white text-[18px] font-black leading-tight tracking-tight">
            Delivery in 11 minutes
          </div>
          <div className="mt-0.5 inline-flex items-center gap-1 text-white/85 text-[12px] font-medium max-w-full">
            <span className="font-bold">HOME</span>
            <span>·</span>
            <span className="truncate">{addressLine}</span>
            <ChevronDown className="h-3 w-3 flex-shrink-0" strokeWidth={2.5} />
          </div>
        </Link>
        <Link
          to={storefrontPath(slug, "account")}
          className="h-9 w-9 rounded-full flex items-center justify-center bg-white/15 flex-shrink-0"
          aria-label="Account"
        >
          <User className="h-5 w-5 text-white" strokeWidth={2.2} />
        </Link>
      </div>

      {/* Search bar with rotating placeholder */}
      <div className="px-4 pb-3">
        <Link to={storefrontPath(slug, "shop")} className="flex items-center gap-2 bg-white rounded-xl px-3.5 py-2.5 shadow-sm">
          <Search className="h-4 w-4 text-gray-500 flex-shrink-0" strokeWidth={2.5} />
          <span className="text-[13px] text-gray-600 font-medium truncate">
            Search {SEARCH_TERMS[termIdx]}
          </span>
        </Link>
      </div>

      {/* Yellow rolling strip — bolder */}
      <div className="v19-marquee-yellow">
        <div className="flex gap-10 animate-marquee whitespace-nowrap">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="px-2">✦ FREE DELIVERY ON ALL ORDERS · ORDER IN 2 MINUTES · 100% SAFE</span>
          ))}
        </div>
      </div>
    </header>
  );
}
