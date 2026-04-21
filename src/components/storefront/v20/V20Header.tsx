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
  const [locationOpen, setLocationOpen] = useState(false);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
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

  useEffect(() => {
    if (store?.id) setSavedLabel(getSavedDeliveryLabel(store.id));
  }, [store?.id]);

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
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt={store?.name || "Logo"}
                  className="h-9 max-w-[180px] object-contain object-left"
                />
              ) : (
                <div
                  className="text-white text-[24px] leading-tight truncate"
                  style={{ fontFamily: "'Alegreya SC', serif", fontWeight: 700, letterSpacing: "0.04em" }}
                >
                  {store?.name || "Shop"}
                </div>
              )}
            </Link>
            <button
              type="button"
              onClick={() => setLocationOpen(true)}
              className="mt-1 inline-flex items-center gap-1 text-white text-[13px] font-bold max-w-full"
              aria-label="Set delivery location"
            >
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2.5} />
              <span className="truncate italic">{savedLabel || "Set delivery location"}</span>
              <ChevronDown className="h-4 w-4 flex-shrink-0" strokeWidth={2.5} />
            </button>
          </div>
          {store?.whatsapp_number ? (
            <a
              href={`https://wa.me/${String(store.whatsapp_number).replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Hi ${store?.name || ""}! I have a question.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 w-9 rounded-full flex items-center justify-center bg-[#25D366] flex-shrink-0 shadow-md active:scale-95 transition-transform"
              aria-label="Chat on WhatsApp"
            >
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </a>
          ) : (
            <Link
              to={storefrontPath(slug, "account")}
              className="h-9 w-9 rounded-full flex items-center justify-center bg-white/15 flex-shrink-0"
              aria-label="Account"
            >
              <User className="h-5 w-5 text-white" strokeWidth={2.2} />
            </Link>
          )}
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
          <Link to={storefrontPath(slug)} className="flex items-center flex-shrink-0">
            {logoSrc ? (
              <img
                src={store?.logo_url ? optimizeImageUrl(store.logo_url, 200, 90) : ""}
                alt={store?.name}
                className="h-11 max-w-[220px] object-contain"
              />
            ) : (
              <div
                className="text-[26px] truncate max-w-[260px]"
                style={{
                  fontFamily: "'Alegreya SC', serif",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  color: "var(--storefront-primary, #036B52)",
                }}
              >
                {store?.name || "Shop"}
              </div>
            )}
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
            data-cart-target
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

      {store?.id && (
        <DeliveryLocationDialog
          open={locationOpen}
          onClose={() => setLocationOpen(false)}
          storeId={store.id}
          onSaved={(label) => setSavedLabel(label)}
        />
      )}
    </>
  );
}
