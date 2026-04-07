/**
 * Shared "Milano-style" header, tab bar, and footer used by V10 and V12 themes.
 * Parameterized by default colors and fonts to support both themes.
 */
import { useState, lazy, Suspense } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, Heart, User, Search, Home, LayoutGrid, X, ChevronRight } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
const StorefrontSearchOverlay = lazy(() => import("@/components/storefront/StorefrontSearchOverlay"));
import { storefrontPath } from "@/lib/subdomain";
import type { Tables } from "@/integrations/supabase/types";
import StoreTextLogo from "@/components/storefront/StoreTextLogo";

type StoreData = Tables<"stores">;

interface ThemeColors {
  defaultPrimary: string;
  defaultBg: string;
  defaultText: string;
  defaultAccent: string;
  headingFontFallback: string;
  bodyFontFallback: string;
}

// ---- Header ----
export function ElegantHeader({ store, colors }: { store: StoreData; colors: ThemeColors }) {
  const { cartCount, openCart } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const queryClient = useQueryClient();
  const products = queryClient.getQueryData<any[]>(["storefront-products", store.id]);
  const customPages = queryClient.getQueryData<any[]>(["storefront-custom-pages", store.id]) ?? [];
  const { wishlistCount } = useWishlist();
  const { user } = useStorefrontAuth();

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3" style={{ backgroundColor: `var(--storefront-bg, ${colors.defaultBg})`, borderBottom: `1px solid var(--storefront-text, ${colors.defaultText})0a` }}>
        <button onClick={() => setMenuOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-md transition-all active:scale-90" aria-label="Open menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={`var(--storefront-text, ${colors.defaultText})`} strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="3" y1="7" x2="21" y2="7" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="17" x2="21" y2="17" /></svg>
        </button>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="left" className="w-[320px] p-0 border-0" style={{ backgroundColor: `var(--storefront-bg, ${colors.defaultBg})` }}>
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-5 py-3.5" style={{ backgroundColor: `var(--storefront-accent, ${colors.defaultAccent})`, color: `var(--storefront-bg, ${colors.defaultBg})` }}>
                <span className="text-sm font-bold uppercase tracking-wider" style={{ fontFamily: `var(--storefront-heading-font, '${colors.headingFontFallback}'), serif` }}>Menu</span>
                <button onClick={() => setMenuOpen(false)} className="flex h-8 w-8 items-center justify-center" aria-label="Close menu"><X className="h-5 w-5" aria-hidden="true" /></button>
              </div>
              <nav className="flex-1 overflow-y-auto">
                <div className="px-5 pt-4 pb-1"><h4 className="text-[10px] font-bold uppercase tracking-widest opacity-40" style={{ color: `var(--storefront-text, ${colors.defaultText})` }}>Pages</h4></div>
                {[{ to: storefrontPath(store.slug), label: "Home" }, { to: storefrontPath(store.slug, "shop"), label: "Shop All" }, { to: storefrontPath(store.slug, "about"), label: "About Us" }, { to: storefrontPath(store.slug, "contact"), label: "Contact" }, ...customPages.map((cp: any) => ({ to: storefrontPath(store.slug, `page/${cp.slug}`), label: cp.title }))].map((link) => (
                  <Link key={link.label} to={link.to} onClick={() => setMenuOpen(false)} className="flex items-center justify-between px-5 py-3.5 text-[15px] font-medium transition-colors" style={{ color: `var(--storefront-text, ${colors.defaultText})`, borderBottom: `1px solid var(--storefront-text, ${colors.defaultText})08`, fontFamily: `var(--storefront-body-font, '${colors.bodyFontFallback}'), sans-serif` }}>{link.label}<ChevronRight className="h-4 w-4 opacity-40" /></Link>
                ))}
                <div className="px-5 pt-5 pb-1"><h4 className="text-[10px] font-bold uppercase tracking-widest opacity-40" style={{ color: `var(--storefront-text, ${colors.defaultText})` }}>Policies</h4></div>
                {[{ to: storefrontPath(store.slug, "shipping-policy"), label: "Shipping Policy" }, { to: storefrontPath(store.slug, "terms"), label: "Terms & Conditions" }, { to: storefrontPath(store.slug, "privacy-policy"), label: "Privacy Policy" }].map((link) => (
                  <Link key={link.label} to={link.to} onClick={() => setMenuOpen(false)} className="flex items-center justify-between px-5 py-3.5 text-[15px] font-medium transition-colors" style={{ color: `var(--storefront-text, ${colors.defaultText})`, borderBottom: `1px solid var(--storefront-text, ${colors.defaultText})0a`, fontFamily: `var(--storefront-body-font, '${colors.bodyFontFallback}'), sans-serif` }}>{link.label}<ChevronRight className="h-4 w-4 opacity-40" /></Link>
                ))}
              </nav>
              <div className="border-t" style={{ borderColor: `var(--storefront-text, ${colors.defaultText})0a` }}>
                <Link to={storefrontPath(store.slug, "wishlist")} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-5 py-4 text-[15px] font-medium" style={{ color: `var(--storefront-text, ${colors.defaultText})`, fontFamily: `var(--storefront-body-font, '${colors.bodyFontFallback}'), sans-serif` }}><Heart className="h-5 w-5" />Wishlist</Link>
                <Link to={storefrontPath(store.slug, user ? "account" : "login")} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-5 py-4 text-[15px] font-medium" style={{ color: `var(--storefront-text, ${colors.defaultText})`, fontFamily: `var(--storefront-body-font, '${colors.bodyFontFallback}'), sans-serif` }}><User className="h-5 w-5" />{user ? "My Account" : "Login / Register"}</Link>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <Link to={storefrontPath(store.slug)} className="absolute left-1/2 -translate-x-1/2">
          {store.logo_url ? <img src={store.logo_url} alt={store.name} className="h-14 w-auto max-w-[200px] object-contain" /> : <StoreTextLogo storeName={store.name} size="text-xl" color={`var(--storefront-text, ${colors.defaultText})`} />}
        </Link>

        <div className="flex items-center gap-0.5">
          <button onClick={() => setSearchOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-md transition-all active:scale-90" aria-label="Search products"><Search className="h-5 w-5" style={{ color: `var(--storefront-text, ${colors.defaultText})` }} aria-hidden="true" /></button>
          <button onClick={openCart} className="relative flex h-10 w-10 items-center justify-center rounded-md transition-all active:scale-90" aria-label={`Shopping cart${cartCount > 0 ? `, ${cartCount} items` : ''}`}>
            <ShoppingCart className="h-5 w-5" style={{ color: `var(--storefront-text, ${colors.defaultText})` }} aria-hidden="true" />
            {cartCount > 0 && <span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold" style={{ backgroundColor: `var(--storefront-primary, ${colors.defaultPrimary})`, color: "#fff" }}>{cartCount > 9 ? "9+" : cartCount}</span>}
          </button>
        </div>
      </header>
      {searchOpen && <Suspense fallback={null}><StorefrontSearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} products={products} slug={store.slug} initialFiltersOpen={false} /></Suspense>}
    </>
  );
}

// ---- Tab Bar ----
export function ElegantTabBar({ store, colors, useTextForActive = false }: { store: StoreData; colors: ThemeColors; useTextForActive?: boolean }) {
  const location = useLocation();
  const { wishlistCount } = useWishlist();
  const { cartCount, openCart } = useCart();
  const { user } = useStorefrontAuth();
  const basePath = storefrontPath(store.slug);
  const tabs = [
    { icon: Home, label: "Home", to: basePath, matchExact: true },
    { icon: User, label: "Account", to: storefrontPath(store.slug, user ? "account" : "login"), match: "account" },
    { icon: LayoutGrid, label: "Shop", to: storefrontPath(store.slug, "shop"), match: "shop" },
    { icon: Heart, label: "Wishlist", to: storefrontPath(store.slug, "wishlist"), match: "wishlist", badge: wishlistCount },
    { icon: ShoppingCart, label: "Cart", to: "__cart__", match: "__cart__", badge: cartCount, isCart: true },
  ];

  const activeColor = useTextForActive
    ? `var(--storefront-text, ${colors.defaultText})`
    : `var(--storefront-primary, ${colors.defaultPrimary})`;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-center justify-around py-1.5 border-t" style={{ backgroundColor: `var(--storefront-bg, ${colors.defaultBg})`, borderColor: `var(--storefront-text, ${colors.defaultText})10` }}>
        {tabs.map((tab) => {
          const isActive = tab.matchExact ? location.pathname === basePath || location.pathname === basePath + "/" : location.pathname.includes(tab.match!);
          const TabIcon = tab.icon;
          const content = (
            <div className="flex flex-col items-center justify-center gap-0.5 py-1 px-2" style={{ minWidth: "52px" }}>
              <div className="relative flex items-center justify-center" style={{ width: "24px", height: "24px" }}>
                <TabIcon className="h-[22px] w-[22px] transition-colors" style={{ color: isActive ? activeColor : `var(--storefront-text, ${colors.defaultText})60` }} />
                {tab.badge != null && tab.badge > 0 && <span className="absolute -right-2 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold" style={{ backgroundColor: `var(--storefront-primary, ${colors.defaultPrimary})`, color: "#fff" }}>{tab.badge > 9 ? "9+" : tab.badge}</span>}
              </div>
              <span className="text-[10px] font-medium" style={{ color: isActive ? activeColor : `var(--storefront-text, ${colors.defaultText})60` }}>{tab.label}</span>
            </div>
          );
          if (tab.isCart) return <button key={tab.label} onClick={openCart} className="transition-all active:scale-90">{content}</button>;
          return <Link key={tab.label} to={tab.to} className="transition-all active:scale-90">{content}</Link>;
        })}
      </div>
    </nav>
  );
}

// ---- Footer ----
export function ElegantFooter({ store, colors }: { store: StoreData; colors: ThemeColors }) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-8" style={{ backgroundColor: `var(--storefront-accent, ${colors.defaultAccent})`, color: `var(--storefront-bg, ${colors.defaultBg})` }}>
      <div className="px-5 py-10 space-y-8 max-w-6xl mx-auto">
        <div className="text-center space-y-3">
          {store.logo_url ? <img src={store.logo_url} alt={store.name} className="h-10 w-auto mx-auto object-contain brightness-0 invert" /> : <StoreTextLogo storeName={store.name} size="text-2xl" />}
          {store.description && <p className="text-sm opacity-60 max-w-md mx-auto leading-relaxed">{store.description}</p>}
        </div>
        <div className="grid grid-cols-2 gap-6 text-sm">
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-widest opacity-50" style={{ color: `var(--storefront-primary, ${colors.defaultPrimary})` }}>Quick Links</h4>
            {[{ to: storefrontPath(store.slug), label: "Home" }, { to: storefrontPath(store.slug, "shop"), label: "Shop" }, { to: storefrontPath(store.slug, "about"), label: "About Us" }, { to: storefrontPath(store.slug, "contact"), label: "Contact Us" }].map((link) => (<Link key={link.label} to={link.to} className="block opacity-60 hover:opacity-100 transition-opacity text-[13px]">{link.label}</Link>))}
          </div>
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-widest opacity-50" style={{ color: `var(--storefront-primary, ${colors.defaultPrimary})` }}>Policies</h4>
            {[{ to: storefrontPath(store.slug, "return-policy"), label: "Return & Refund" }, { to: storefrontPath(store.slug, "shipping-policy"), label: "Shipping Policy" }, { to: storefrontPath(store.slug, "terms"), label: "Terms & Conditions" }, { to: storefrontPath(store.slug, "privacy-policy"), label: "Privacy Policy" }].map((link) => (<Link key={link.label} to={link.to} className="block opacity-60 hover:opacity-100 transition-opacity text-[13px]">{link.label}</Link>))}
          </div>
        </div>
        <div className="pt-6 border-t border-white/10 text-center"><p className="text-[11px] opacity-40">© {year} {store.name}. All rights reserved.</p></div>
      </div>
    </footer>
  );
}
