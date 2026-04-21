/**
 * V20 Header — Theme 20 (Multi Purpose). Duplicated from V19Header.
 */
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, ChevronDown, User, ShoppingCart, MapPin } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { storefrontPath } from "@/lib/subdomain";
import { useCart } from "@/contexts/CartContext";
import { optimizeImageUrl } from "@/lib/imageOptimize";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import DeliveryLocationDialog, { getSavedDeliveryLabel } from "@/components/storefront/DeliveryLocationDialog";

const SEARCH_TERMS = ['"new arrivals"', '"trending"', '"best sellers"', '"offers"', '"deals"', '"new in"'];

const LazySearchOverlay = lazy(() => import("@/components/storefront/StorefrontSearchOverlay"));

interface Category { id: string; name: string; slug: string; image_url: string | null; }

export default function V20Header({ store }: { store: any }) {
  const slug = store?.slug || "";
  const [termIdx, setTermIdx] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const { cartCount } = useCart();
  const location = useLocation();
  const queryClient = useQueryClient();
  const categories = (queryClient.getQueryData<Category[]>(["storefront-categories", store?.id]) || []) as Category[];
  const themeConfig = useStorefrontThemeConfig(store?.id);
  const marqueeEnabled = themeConfig?.marquee_enabled !== false;
  const marqueeText = themeConfig?.marquee_text || "✦ FREE DELIVERY ON ALL ORDERS · 100% SAFE & SECURE · EASY RETURNS";

  useEffect(() => {
    const id = setInterval(() => setTermIdx((i) => (i + 1) % SEARCH_TERMS.length), 2200);
    return () => clearInterval(id);
  }, []);

  const products = (queryClient.getQueryData<any[]>(["storefront-products", store?.id]) || []) as any[];

  const addressLine = store?.city || store?.location || store?.name || "Your location";
  const logoSrc = store?.logo_url ? optimizeImageUrl(store.logo_url, 120, 90) : null;

  const topCats = useMemo(() => categories.slice(0, 6), [categories]);

  return (
    <>
      {/* ============ MOBILE HEADER (< md) ============ */}
      <header className="sticky top-0 z-40 shadow-md md:hidden" style={{ background: "var(--storefront-primary, #036B52)" }}>
        <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <Link to={storefrontPath(slug)} className="block">
              <div className="text-white text-[20px] font-black leading-tight tracking-tight truncate">
                {store?.name || "Shop"}
              </div>
            </Link>
            <Link
              to={storefrontPath(slug, "account")}
              className="mt-1 inline-flex items-center gap-1 text-white text-[13px] font-bold max-w-full"
              aria-label="Change delivery address"
            >
              <span className="font-extrabold">HOME</span>
              <span>·</span>
              <span className="truncate">{addressLine}</span>
              <ChevronDown className="h-4 w-4 flex-shrink-0" strokeWidth={2.5} />
            </Link>
          </div>
          <Link
            to={storefrontPath(slug, "account")}
            className="h-9 w-9 rounded-full flex items-center justify-center bg-white/15 flex-shrink-0"
            aria-label="Account"
          >
            <User className="h-5 w-5 text-white" strokeWidth={2.2} />
          </Link>
        </div>

        <div className="px-4 pb-3">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center gap-2 bg-white rounded-xl px-3.5 py-2.5 shadow-sm text-left"
          >
            <Search className="h-4 w-4 text-gray-500 flex-shrink-0" strokeWidth={2.5} />
            <span className="text-[13px] text-gray-600 font-medium truncate">
              Search {SEARCH_TERMS[termIdx]}
            </span>
          </button>
        </div>

        {marqueeEnabled && (
          <div className="v20-marquee-yellow">
            <div className="flex gap-10 animate-marquee whitespace-nowrap">
              {Array.from({ length: 6 }).map((_, i) => (
                <span key={i} className="px-2">{marqueeText}</span>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* ============ DESKTOP HEADER (md+) ============ */}
      <header className="hidden md:block sticky top-0 z-40 bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-3 flex items-center gap-5">
          <Link to={storefrontPath(slug)} className="flex items-center gap-2 flex-shrink-0">
            {logoSrc ? (
              <img src={logoSrc} alt={store?.name} className="h-10 w-10 rounded-lg object-contain bg-gray-50" />
            ) : (
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-black text-lg"
                style={{ background: "var(--storefront-primary, #036B52)" }}
              >
                {store?.name?.[0]?.toUpperCase() || "S"}
              </div>
            )}
            <div className="leading-tight">
              <div className="text-[16px] font-black text-gray-900 truncate max-w-[220px]">{store?.name}</div>
            </div>
          </Link>

          <Link
            to={storefrontPath(slug, "account")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-gray-50 border border-gray-200 flex-shrink-0"
            aria-label="Change delivery location"
          >
            <div className="leading-tight text-left">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Deliver to</div>
              <div className="text-[13px] font-bold text-gray-900 truncate max-w-[160px]">{addressLine}</div>
            </div>
            <ChevronDown className="h-4 w-4 text-gray-700 flex-shrink-0" strokeWidth={2.5} />
          </Link>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex-1 flex items-center gap-2 bg-gray-100 hover:bg-gray-50 border border-gray-200 rounded-xl px-4 h-11 text-left transition-colors min-w-0"
          >
            <Search className="h-4 w-4 text-gray-500 flex-shrink-0" strokeWidth={2.5} />
            <span className="text-[14px] text-gray-600 font-semibold truncate">
              Search {SEARCH_TERMS[termIdx]}
            </span>
          </button>

          <Link
            to={storefrontPath(slug, "account")}
            className="flex items-center gap-1.5 px-3 h-11 rounded-lg hover:bg-gray-50 text-gray-800 font-bold text-[13px] flex-shrink-0"
          >
            <User className="h-5 w-5" strokeWidth={2.2} />
            <span className="hidden lg:inline">Account</span>
          </Link>
          <Link
            to={storefrontPath(slug, "cart")}
            className="relative flex items-center gap-1.5 px-4 h-11 rounded-lg text-white font-bold text-[13px] flex-shrink-0"
            style={{ background: "var(--storefront-primary, #036B52)" }}
          >
            <ShoppingCart className="h-5 w-5" strokeWidth={2.2} />
            <span>My Cart</span>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-yellow-400 text-[10px] font-black flex items-center justify-center" style={{ color: "var(--storefront-primary, #036B52)" }}>
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </Link>
        </div>

        {topCats.length > 0 && (
          <div className="border-t border-gray-100 bg-white">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
              <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-2">
                {(() => {
                  const isHome = location.pathname.endsWith(slug) || location.pathname.endsWith(slug + "/");
                  return (
                    <Link
                      to={storefrontPath(slug)}
                      className="flex-shrink-0 px-3 py-1.5 rounded-full text-[13px] font-bold transition-colors"
                      style={isHome ? { background: "var(--storefront-primary, #036B52)", color: "#fff" } : undefined}
                    >
                      <span className={isHome ? "" : "text-gray-700"}>Home</span>
                    </Link>
                  );
                })()}
                {topCats.map((cat) => {
                  const path = storefrontPath(slug, `category/${cat.slug}`);
                  const active = location.pathname.includes(`/category/${cat.slug}`);
                  return (
                    <Link
                      key={cat.id}
                      to={path}
                      className="flex-shrink-0 px-3 py-1.5 rounded-full text-[13px] font-bold transition-colors"
                      style={active ? { background: "var(--storefront-primary, #036B52)", color: "#fff" } : undefined}
                    >
                      <span className={active ? "" : "text-gray-700"}>{cat.name}</span>
                    </Link>
                  );
                })}
                <Link
                  to={storefrontPath(slug, "categories")}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-[13px] font-bold hover:bg-gray-100 inline-flex items-center gap-1"
                  style={{ color: "var(--storefront-primary, #036B52)" }}
                >
                  All Categories <ChevronDown className="h-3 w-3" strokeWidth={3} />
                </Link>
              </nav>
            </div>
          </div>
        )}
      </header>

      {searchOpen && (
        <Suspense fallback={null}>
          <LazySearchOverlay
            open={searchOpen}
            onClose={() => setSearchOpen(false)}
            products={products}
            slug={slug}
            storeId={store?.id}
          />
        </Suspense>
      )}
    </>
  );
}
