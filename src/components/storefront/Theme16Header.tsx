/**
 * Theme 16 — Premium Modern Header
 *
 * Inspired by cinematic / editorial navigation:
 * ┌──────────────────────────────────────────────────────────┐
 * │  [HOME] [SHOP]    ──── LOGO ────    [SEARCH] [CART] ≡  │
 * └──────────────────────────────────────────────────────────┘
 *
 * Features:
 * - Pill-shaped nav links & action buttons
 * - Centered logo with decorative horizontal lines
 * - Dark bar on desktop, sleek compact on mobile
 * - Fully checkout-aware (switches to back+checkout label)
 */
import { useState, lazy, Suspense, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Search, ShoppingCart, Heart, User, ArrowLeft, Menu, X, ChevronDown } from "lucide-react";
import StoreTextLogo from "@/components/storefront/StoreTextLogo";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import { storefrontPath } from "@/lib/subdomain";
import type { Tables } from "@/integrations/supabase/types";

const LazySearchOverlay = lazy(() => import("@/components/storefront/StorefrontSearchOverlay"));

type StoreData = Tables<"stores">;

interface Theme16HeaderProps {
  store: StoreData;
  onOrderPlaced?: boolean;
  headerStyle?: string;
}

function getHeaderStyles(headerStyle: string) {
  if (headerStyle === "transparent") {
    return {
      bg: "transparent",
      borderColor: "transparent",
      extraClass: "",
      wrapperStyle: {} as React.CSSProperties,
    };
  }
  if (headerStyle === "glassmorphic") {
    return {
      bg: "rgba(255,255,255,0.12)",
      borderColor: "transparent",
      extraClass: "backdrop-blur-[20px] rounded-b-2xl shadow-lg",
      wrapperStyle: { margin: "0 8px" } as React.CSSProperties,
    };
  }
  // "normal" — solid bg
  return {
    bg: "var(--storefront-bg, hsl(var(--background)))",
    borderColor: "var(--storefront-text, hsl(var(--foreground)))10",
    extraClass: "backdrop-blur-xl",
    wrapperStyle: {} as React.CSSProperties,
  };
}

export default function Theme16Header({ store, onOrderPlaced, headerStyle = "normal" }: Theme16HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isCheckout = location.pathname.includes("/checkout");
  const hs = getHeaderStyles(headerStyle);
  const { cartCount, openCart } = useCart();
  const { wishlistCount } = useWishlist();
  const { user, loading: authLoading } = useStorefrontAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const catalogTimer = useRef<ReturnType<typeof setTimeout>>();
  const queryClient = useQueryClient();
  const products = queryClient.getQueryData<any[]>(["storefront-products", store.id]);
  const categories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]) ?? [];
  const customPages = queryClient.getQueryData<any[]>(["storefront-custom-pages", store.id]) ?? [];

  const handleBackClick = () => {
    if (onOrderPlaced) {
      navigate(storefrontPath(store.slug));
      return;
    }
    navigate(storefrontPath(store.slug, "cart"));
  };

  const handleCatalogEnter = () => { clearTimeout(catalogTimer.current); setCatalogOpen(true); };
  const handleCatalogLeave = () => { catalogTimer.current = setTimeout(() => setCatalogOpen(false), 200); };

  const pillClass =
    "px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] rounded-full border transition-all duration-200 hover:scale-105 active:scale-95";

  const LogoWithLines = (
    <Link to={storefrontPath(store.slug)} className="flex items-center gap-3 shrink-0" aria-label={`${store.name} home`}>
      {/* Left decorative line */}
      <span className="hidden lg:block w-12 xl:w-20 h-[1.5px] rounded-full" style={{ background: "var(--storefront-text, hsl(var(--foreground)))" }} />
      {store.logo_url ? (
        <img
          src={store.logo_url}
          alt={store.name}
          className="h-8 md:h-10 w-auto max-w-[140px] md:max-w-[180px] object-contain"
          loading="eager"
          decoding="sync"
        />
      ) : (
        <StoreTextLogo storeName={store.name} size="text-xl md:text-2xl" />
      )}
      {/* Right decorative line */}
      <span className="hidden lg:block w-12 xl:w-20 h-[1.5px] rounded-full" style={{ background: "var(--storefront-text, hsl(var(--foreground)))" }} />
    </Link>
  );

  // ───── CHECKOUT HEADER ─────
  if (isCheckout) {
    return (
      <nav className="sticky top-0 z-30 backdrop-blur-xl border-b" style={{
        backgroundColor: "var(--storefront-bg, hsl(var(--background)))",
        borderColor: "var(--storefront-text, hsl(var(--foreground)))10",
        color: "var(--storefront-text, hsl(var(--foreground)))",
      }}>
        <div className="mx-auto flex h-12 max-w-6xl items-center gap-3 px-3">
          <button onClick={handleBackClick} className="flex h-9 w-9 items-center justify-center rounded-full transition-all hover:scale-110" aria-label="Go back"
            style={{ border: "1px solid var(--storefront-text, hsl(var(--foreground)))20" }}>
            <ArrowLeft className="h-4 w-4" />
          </button>
          {store.logo_url ? (
            <img src={store.logo_url} alt={store.name} className="h-7 w-auto max-w-[100px] object-contain" />
          ) : (
            <StoreTextLogo storeName={store.name} size="text-base" />
          )}
          <span className="text-xs font-semibold uppercase tracking-widest opacity-60">Checkout</span>
          <div className="flex-1" />
        </div>
      </nav>
    );
  }

  // ───── MOBILE HEADER (< md) ─────
  const MobileHeader = (
    <nav className="md:hidden sticky top-0 z-30" style={{
      backgroundColor: "var(--storefront-bg, hsl(var(--background)))",
      color: "var(--storefront-text, hsl(var(--foreground)))",
    }}>
      {/* Top bar: hamburger, logo centered, cart */}
      <div className="flex items-center h-14 px-3 relative">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button className="flex h-9 w-9 items-center justify-center rounded-full transition-all active:scale-90"
              style={{ border: "1.5px solid var(--storefront-text, hsl(var(--foreground)))25" }}
              aria-label="Open menu">
              <Menu className="h-4.5 w-4.5" strokeWidth={2} />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="storefront-font w-[300px] p-0" style={{
            backgroundColor: "var(--storefront-bg, hsl(var(--background)))",
            color: "var(--storefront-text, hsl(var(--foreground)))",
          }}>
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--storefront-text, hsl(var(--foreground)))12" }}>
                {store.logo_url ? (
                  <img src={store.logo_url} alt={store.name} className="h-8 w-auto max-w-[140px] object-contain" />
                ) : (
                  <StoreTextLogo storeName={store.name} size="text-lg" />
                )}
              </div>
              <nav className="flex flex-col gap-0.5 p-3">
                {[
                  { to: storefrontPath(store.slug), label: "Home" },
                  { to: storefrontPath(store.slug, "shop"), label: "Shop All" },
                  { to: storefrontPath(store.slug, "categories"), label: "Categories" },
                  { to: storefrontPath(store.slug, "about"), label: "About Us" },
                  { to: storefrontPath(store.slug, "contact"), label: "Contact" },
                  ...customPages.map((cp: any) => ({ to: storefrontPath(store.slug, `page/${cp.slug}`), label: cp.title })),
                  { to: storefrontPath(store.slug, "wishlist"), label: "Wishlist" },
                  { to: storefrontPath(store.slug, "account"), label: "My Account" },
                ].map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center rounded-xl px-4 py-3 text-sm font-medium transition-all hover:opacity-70"
                    style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          </SheetContent>
        </Sheet>

        {/* Centered logo */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2">
          <span className="w-6 h-[1.5px] rounded-full" style={{ background: "var(--storefront-text, hsl(var(--foreground)))40" }} />
          <Link to={storefrontPath(store.slug)} aria-label={`${store.name} home`}>
            {store.logo_url ? (
              <img src={store.logo_url} alt={store.name} className="h-8 w-auto max-w-[120px] object-contain" loading="eager" decoding="sync" />
            ) : (
              <StoreTextLogo storeName={store.name} size="text-lg" />
            )}
          </Link>
          <span className="w-6 h-[1.5px] rounded-full" style={{ background: "var(--storefront-text, hsl(var(--foreground)))40" }} />
        </div>

        {/* Right: search + cart */}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-all active:scale-90"
            style={{ border: "1.5px solid var(--storefront-text, hsl(var(--foreground)))25" }}
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            onClick={openCart}
            className="relative flex h-9 w-9 items-center justify-center rounded-full transition-all active:scale-90"
            style={{ border: "1.5px solid var(--storefront-text, hsl(var(--foreground)))25" }}
            aria-label="Cart"
          >
            <ShoppingCart className="h-4 w-4" />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
                style={{
                  backgroundColor: "var(--storefront-primary, hsl(var(--primary)))",
                  color: "var(--storefront-btn-text, #fff)",
                }}>
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Bottom border line */}
      <div className="h-[1px]" style={{ background: "var(--storefront-text, hsl(var(--foreground)))10" }} />
    </nav>
  );

  // ───── DESKTOP HEADER (md+) ─────
  const DesktopHeader = (
    <nav className="hidden md:block sticky top-0 z-30" style={{
      backgroundColor: "var(--storefront-bg, hsl(var(--background)))",
      color: "var(--storefront-text, hsl(var(--foreground)))",
    }}>
      <div className="mx-auto flex h-16 max-w-7xl items-center px-6 relative">
        {/* ── Left: Pill nav links ── */}
        <div className="flex items-center gap-2">
          <Link to={storefrontPath(store.slug)}
            className={pillClass}
            style={{
              borderColor: "var(--storefront-text, hsl(var(--foreground)))30",
              color: "var(--storefront-text, hsl(var(--foreground)))",
            }}>
            Home
          </Link>
          <Link to={storefrontPath(store.slug, "shop")}
            className={pillClass}
            style={{
              borderColor: "var(--storefront-text, hsl(var(--foreground)))30",
              color: "var(--storefront-text, hsl(var(--foreground)))",
            }}>
            Shop
          </Link>

          {categories.length > 0 && (
            <div className="relative" onMouseEnter={handleCatalogEnter} onMouseLeave={handleCatalogLeave}>
              <button
                className={`${pillClass} flex items-center gap-1`}
                style={{
                  borderColor: "var(--storefront-text, hsl(var(--foreground)))30",
                  color: "var(--storefront-text, hsl(var(--foreground)))",
                }}>
                Catalog
                <ChevronDown className="h-3 w-3 transition-transform" style={{ transform: catalogOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
              </button>
              {catalogOpen && (
                <div className="absolute left-0 top-full mt-2 min-w-[200px] rounded-xl border py-2 shadow-2xl backdrop-blur-xl"
                  style={{
                    backgroundColor: "var(--storefront-bg, hsl(var(--background)))",
                    borderColor: "var(--storefront-text, hsl(var(--foreground)))15",
                  }}>
                  {categories.map((cat: any) => (
                    <Link key={cat.id}
                      to={storefrontPath(store.slug, `shop?category=${cat.slug}`)}
                      onClick={() => setCatalogOpen(false)}
                      className="block px-4 py-2.5 text-[12px] font-medium uppercase tracking-wide transition-opacity hover:opacity-60"
                      style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
                      {cat.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          <Link to={storefrontPath(store.slug, "contact")}
            className={pillClass}
            style={{
              borderColor: "var(--storefront-text, hsl(var(--foreground)))30",
              color: "var(--storefront-text, hsl(var(--foreground)))",
            }}>
            Contact
          </Link>
        </div>

        {/* ── Center: Logo with decorative lines ── */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {LogoWithLines}
        </div>

        {/* ── Right: Pill action buttons ── */}
        <div className="ml-auto flex items-center gap-2">
          {customPages.slice(0, 1).map((cp: any) => (
            <Link key={cp.id}
              to={storefrontPath(store.slug, `page/${cp.slug}`)}
              className={pillClass}
              style={{
                borderColor: "var(--storefront-text, hsl(var(--foreground)))30",
                color: "var(--storefront-text, hsl(var(--foreground)))",
              }}>
              {cp.title}
            </Link>
          ))}

          <Link to={storefrontPath(store.slug, "about")}
            className={pillClass}
            style={{
              borderColor: "var(--storefront-text, hsl(var(--foreground)))30",
              color: "var(--storefront-text, hsl(var(--foreground)))",
            }}>
            About
          </Link>

          {/* Icon buttons in pills */}
          <div className="flex items-center gap-1.5 ml-1">
            <button onClick={() => setSearchOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full border transition-all hover:scale-105"
              style={{ borderColor: "var(--storefront-text, hsl(var(--foreground)))30" }}
              aria-label="Search">
              <Search className="h-4 w-4" />
            </button>

            {!authLoading && (
              <Link to={storefrontPath(store.slug, user ? "account" : "login")}
                className="flex h-9 w-9 items-center justify-center rounded-full border transition-all hover:scale-105"
                style={{ borderColor: "var(--storefront-text, hsl(var(--foreground)))30" }}
                aria-label={user ? "Account" : "Login"}>
                <User className="h-4 w-4" />
              </Link>
            )}

            <Link to={storefrontPath(store.slug, "wishlist")}
              className="relative flex h-9 w-9 items-center justify-center rounded-full border transition-all hover:scale-105"
              style={{ borderColor: "var(--storefront-text, hsl(var(--foreground)))30" }}
              aria-label="Wishlist">
              <Heart className="h-4 w-4" />
              {wishlistCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
                  style={{
                    backgroundColor: "var(--storefront-primary, hsl(var(--primary)))",
                    color: "var(--storefront-btn-text, #fff)",
                  }}>
                  {wishlistCount > 9 ? "9+" : wishlistCount}
                </span>
              )}
            </Link>

            <button onClick={openCart}
              className="relative flex h-9 w-9 items-center justify-center rounded-full border transition-all hover:scale-105"
              style={{ borderColor: "var(--storefront-text, hsl(var(--foreground)))30" }}
              aria-label="Cart">
              <ShoppingCart className="h-4 w-4" />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
                  style={{
                    backgroundColor: "var(--storefront-primary, hsl(var(--primary)))",
                    color: "var(--storefront-btn-text, #fff)",
                  }}>
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom border */}
      <div className="h-[1px]" style={{ background: "var(--storefront-text, hsl(var(--foreground)))10" }} />
    </nav>
  );

  return (
    <>
      {MobileHeader}
      {DesktopHeader}

      {searchOpen && (
        <Suspense fallback={null}>
          <LazySearchOverlay
            open={searchOpen}
            onClose={() => setSearchOpen(false)}
            products={products}
            slug={store.slug}
            storeId={store.id}
            initialFiltersOpen={false}
          />
        </Suspense>
      )}
    </>
  );
}
