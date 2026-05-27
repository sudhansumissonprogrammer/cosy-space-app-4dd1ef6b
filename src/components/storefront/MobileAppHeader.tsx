/**
 * Shared mobile app-style header used by V3 and V11 themes.
 * Features: hamburger menu, logo, search button, cart button.
 */
import { useState, useEffect, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useNavIcons } from "@/hooks/useNavIcons";
import StoreTextLogo from "@/components/storefront/StoreTextLogo";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useCart } from "@/contexts/CartContext";
const StorefrontSearchOverlay = lazy(() => import("@/components/storefront/StorefrontSearchOverlay"));
import { storefrontPath } from "@/lib/subdomain";
import type { Tables } from "@/integrations/supabase/types";

type StoreData = Tables<"stores">;

export default function MobileAppHeader({ store }: { store: StoreData }) {
  const { cartCount, openCart } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const getIcon = useNavIcons(store.id);
  const MenuIcon = getIcon("menu");
  const SearchIcon = getIcon("search");
  const CartIcon = getIcon("cart");
  const queryClient = useQueryClient();
  const products = queryClient.getQueryData<any[]>(["storefront-products", store.id]);
  const customPages = queryClient.getQueryData<any[]>(["storefront-custom-pages", store.id]) ?? [];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header className={`header-shrink ${scrolled ? "is-shrunk" : ""} sticky top-0 z-30 border-b`} style={{ backgroundColor: "var(--storefront-bg, hsl(var(--background)))", borderColor: "var(--storefront-text, hsl(var(--foreground)))10", minHeight: 60 }}>
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button className="flex h-12 w-12 items-center justify-center rounded-xl transition-colors" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))10" }} aria-label="Open menu">
                <MenuIcon className="h-6 w-6" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }} aria-hidden="true" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="storefront-font w-[280px] p-0">
              <div className="flex flex-col">
                <div className="border-b p-4" style={{ backgroundColor: "var(--storefront-bg, hsl(var(--card)))" }}>
                  {store.logo_url ? <img src={store.logo_url} alt={store.name} className="h-14 w-auto max-w-[200px] object-contain" /> : <StoreTextLogo storeName={store.name} size="text-lg" />}
                </div>
                <nav className="flex flex-col gap-1.5 p-4">
                  {[{ to: storefrontPath(store.slug), label: "Home" }, { to: storefrontPath(store.slug, "shop"), label: "Shop All" }, { to: storefrontPath(store.slug, "about"), label: "About Us" }, { to: storefrontPath(store.slug, "contact"), label: "Contact Us" }, ...customPages.map((cp: any) => ({ to: storefrontPath(store.slug, `page/${cp.slug}`), label: cp.title })), { to: storefrontPath(store.slug, "wishlist"), label: "Wishlist" }, { to: storefrontPath(store.slug, "account"), label: "My Account" }].map((link) => (
                    <Link key={link.to} to={link.to} onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-medium transition-colors" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>{link.label}</Link>
                  ))}
                </nav>
              </div>
            </SheetContent>
          </Sheet>

          <Link to={storefrontPath(store.slug)} className="logo-shrink flex items-center shrink-0 overflow-visible">
            {store.logo_url ? <img src={store.logo_url} alt={store.name} className="h-12 w-auto max-w-[180px] object-contain origin-left" style={{ transform: "scale(2.2)" }} /> : <StoreTextLogo storeName={store.name} size="text-base" color="var(--storefront-text, hsl(var(--foreground)))" />}
          </Link>

          <button onClick={() => setSearchOpen(true)} className="flex flex-1 items-center gap-2 rounded-full px-3.5 py-2 text-sm transition-all active:scale-[0.98]" style={{ backgroundColor: "var(--storefront-text, hsl(var(--foreground)))08", border: "1px solid var(--storefront-text, hsl(var(--foreground)))12" }} aria-label="Search products">
            <SearchIcon className="h-4 w-4 shrink-0" style={{ color: "var(--storefront-text, hsl(var(--foreground)))50" }} aria-hidden="true" />
            <span style={{ color: "var(--storefront-text, hsl(var(--foreground)))40" }}>Search products...</span>
          </button>

          <button onClick={openCart} className="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors" aria-label="Open cart">
            <CartIcon className="h-5 w-5" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }} />
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex items-center justify-center rounded-full text-[9px] font-bold min-w-[18px] h-[18px] px-1" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))", color: "var(--storefront-btn-text, #fff)" }}>
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </button>
        </div>
      </header>
      {searchOpen && <Suspense fallback={null}><StorefrontSearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} products={products} slug={store.slug} initialFiltersOpen={false} /></Suspense>}
    </>
  );
}
