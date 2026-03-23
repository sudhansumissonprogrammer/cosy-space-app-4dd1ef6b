import { useState, useEffect, useRef, Suspense } from "react";
import { useThemePreview } from "@/hooks/useThemePreview";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import {
  Store, ShoppingCart, Heart, User, Search, Menu, Home, LayoutGrid, X, ChevronRight,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useStorefront, type StoreData } from "@/layouts/StorefrontLayout";
import { CartProvider, useCart } from "@/contexts/CartContext";
import { WishlistProvider, useWishlist } from "@/contexts/WishlistContext";
import { StorefrontAuthProvider, useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import StorefrontFooter from "@/components/storefront/StorefrontFooter";
import StorefrontInstagramSection from "@/components/storefront/StorefrontInstagramSection";
import FloatingWhatsApp from "@/components/storefront/FloatingWhatsApp";
import SideCart from "@/components/storefront/SideCart";
import DynamicPwaManifest from "@/components/storefront/DynamicPwaManifest";
import { trackPageView } from "@/lib/trackPageView";
import SmartInstallPrompt from "@/components/SmartInstallPrompt";
import StorefrontSearchOverlay from "@/components/storefront/StorefrontSearchOverlay";
import { useMetaTags } from "@/hooks/useMetaTags";
import { useFacebookPixel } from "@/hooks/useFacebookPixel";
import { Skeleton } from "@/components/ui/skeleton";
import { StorefrontContentSkeleton } from "@/components/ContentSkeleton";
import { storefrontPath } from "@/lib/subdomain";

/* ── Header ── */
function V12Header({ store }: { store: StoreData }) {
  const { cartCount, openCart } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const queryClient = useQueryClient();
  const categories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]);
  const products = queryClient.getQueryData<any[]>(["storefront-products", store.id]);
  const { wishlistCount } = useWishlist();
  const { user } = useStorefrontAuth();

  return (
    <>
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-4 py-3"
        style={{
          backgroundColor: "var(--storefront-bg, #ffffff)",
          borderBottom: "1px solid var(--storefront-text, #1a1a1a)12",
        }}
      >
        {/* Left: Hamburger */}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button className="flex h-10 w-10 items-center justify-center rounded-md transition-all active:scale-90" aria-label="Open menu">
              <Menu className="h-5 w-5" style={{ color: "var(--storefront-text, #1a1a1a)" }} aria-hidden="true" />
            </button>
          </SheetTrigger>

          <SheetContent side="left" className="w-[300px] p-0 border-0" style={{ backgroundColor: "var(--storefront-bg, #ffffff)" }}>
            <div className="flex flex-col h-full">
              {/* Menu header */}
              <div
                className="flex items-center justify-between px-5 py-3.5"
                style={{
                  backgroundColor: "var(--storefront-primary, #FF3F6C)",
                  color: "#fff",
                }}
              >
                <span className="text-sm font-bold uppercase tracking-wider" style={{ fontFamily: "var(--storefront-heading-font, 'Poppins'), sans-serif" }}>Menu</span>
                <button onClick={() => setMenuOpen(false)} className="flex h-8 w-8 items-center justify-center" aria-label="Close menu">
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto">
                {/* Pages */}
                <div className="px-5 pt-4 pb-1">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-40" style={{ color: "var(--storefront-text, #1a1a1a)" }}>Pages</h4>
                </div>
                {[
                  { to: storefrontPath(store.slug), label: "Home" },
                  { to: storefrontPath(store.slug, "best-sellers"), label: "Shop All" },
                  { to: storefrontPath(store.slug, "contact"), label: "Contact" },
                ].map((link) => (
                  <Link
                    key={link.label}
                    to={link.to}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-between px-5 py-3.5 text-[15px] font-medium transition-colors"
                    style={{
                      color: "var(--storefront-text, #1a1a1a)",
                      borderBottom: "1px solid var(--storefront-text, #1a1a1a)08",
                      fontFamily: "var(--storefront-body-font, 'Inter'), sans-serif",
                    }}
                  >
                    {link.label}
                    <ChevronRight className="h-4 w-4 opacity-40" />
                  </Link>
                ))}

                {/* Categories */}
                {categories && categories.length > 0 && (
                  <>
                    <div className="px-5 pt-5 pb-1">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-40" style={{ color: "var(--storefront-text, #1a1a1a)" }}>Categories</h4>
                    </div>
                    {categories.map((cat: any) => (
                      <Link
                        key={cat.id}
                        to={storefrontPath(store.slug, `category/${cat.slug}`)}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center justify-between px-5 py-3.5 text-[15px] font-medium transition-colors"
                        style={{
                          color: "var(--storefront-text, #1a1a1a)",
                          borderBottom: "1px solid var(--storefront-text, #1a1a1a)08",
                          fontFamily: "var(--storefront-body-font, 'Inter'), sans-serif",
                        }}
                      >
                        {cat.name}
                        <ChevronRight className="h-4 w-4 opacity-40" />
                      </Link>
                    ))}
                  </>
                )}

                {/* Policies */}
                <div className="px-5 pt-5 pb-1">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-40" style={{ color: "var(--storefront-text, #1a1a1a)" }}>Policies</h4>
                </div>
                {[
                  { to: storefrontPath(store.slug, "return-policy"), label: "Return Policy" },
                  { to: storefrontPath(store.slug, "shipping-policy"), label: "Shipping Policy" },
                  { to: storefrontPath(store.slug, "terms"), label: "Terms & Conditions" },
                  { to: storefrontPath(store.slug, "privacy-policy"), label: "Privacy Policy" },
                ].map((link) => (
                  <Link
                    key={link.label}
                    to={link.to}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-between px-5 py-3.5 text-[15px] font-medium transition-colors"
                    style={{
                      color: "var(--storefront-text, #1a1a1a)",
                      borderBottom: "1px solid var(--storefront-text, #1a1a1a)08",
                      fontFamily: "var(--storefront-body-font, 'Inter'), sans-serif",
                    }}
                  >
                    {link.label}
                    <ChevronRight className="h-4 w-4 opacity-40" />
                  </Link>
                ))}
              </nav>

              {/* Bottom links */}
              <div className="border-t" style={{ borderColor: "var(--storefront-text, #1a1a1a)0a" }}>
                <Link
                  to={storefrontPath(store.slug, "wishlist")}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-5 py-4 text-[15px] font-medium"
                  style={{ color: "var(--storefront-text, #1a1a1a)" }}
                >
                  <Heart className="h-5 w-5" />
                  Wishlist
                </Link>
                <Link
                  to={storefrontPath(store.slug, user ? "account" : "login")}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-5 py-4 text-[15px] font-medium"
                  style={{ color: "var(--storefront-text, #1a1a1a)" }}
                >
                  <User className="h-5 w-5" />
                  {user ? "My Account" : "Login / Register"}
                </Link>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Center: Logo */}
        <Link to={storefrontPath(store.slug)} className="absolute left-1/2 -translate-x-1/2">
          {store.logo_url ? (
            <img src={store.logo_url} alt={store.name} className="h-8 w-auto max-w-[130px] object-contain" />
          ) : (
            <span
              className="text-xl font-bold"
              style={{
                color: "var(--storefront-text, #1a1a1a)",
                fontFamily: "var(--storefront-heading-font, 'Poppins'), sans-serif",
              }}
            >
              {store.name}
            </span>
          )}
        </Link>

        {/* Right: Search + Cart */}
        <div className="flex items-center gap-0.5">
          <button onClick={() => setSearchOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-md transition-all active:scale-90" aria-label="Search products">
            <Search className="h-5 w-5" style={{ color: "var(--storefront-text, #1a1a1a)" }} aria-hidden="true" />
          </button>
          <button onClick={openCart} className="relative flex h-10 w-10 items-center justify-center rounded-md transition-all active:scale-90" aria-label={`Shopping cart${cartCount > 0 ? `, ${cartCount} items` : ''}`}>
            <ShoppingCart className="h-5 w-5" style={{ color: "var(--storefront-text, #1a1a1a)" }} aria-hidden="true" />
            {cartCount > 0 && (
              <span
                className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                style={{ backgroundColor: "var(--storefront-primary, #FF3F6C)" }}
              >
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <StorefrontSearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} products={products} slug={store.slug} initialFiltersOpen={false} />
    </>
  );
}

/* ── Bottom Tab Bar ── */
function V12TabBar({ store }: { store: StoreData }) {
  const location = useLocation();
  const { wishlistCount } = useWishlist();
  const { cartCount, openCart } = useCart();
  const { user } = useStorefrontAuth();

  const basePath = storefrontPath(store.slug);
  const tabs = [
    { icon: Home, label: "Home", to: basePath, matchExact: true },
    { icon: LayoutGrid, label: "Shop", to: storefrontPath(store.slug, "best-sellers"), match: "best-sellers" },
    { icon: Heart, label: "Wishlist", to: storefrontPath(store.slug, "wishlist"), match: "wishlist", badge: wishlistCount },
    { icon: User, label: "Account", to: storefrontPath(store.slug, user ? "account" : "login"), match: "account" },
    { icon: ShoppingCart, label: "Cart", to: "__cart__", match: "__cart__", badge: cartCount, isCart: true },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div
        className="flex items-center justify-around py-1.5 border-t"
        style={{
          backgroundColor: "var(--storefront-bg, #ffffff)",
          borderColor: "var(--storefront-text, #1a1a1a)10",
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.matchExact
            ? location.pathname === basePath || location.pathname === basePath + "/"
            : location.pathname.includes(tab.match!);
          const TabIcon = tab.icon;

          const content = (
            <div className="flex flex-col items-center justify-center gap-0.5 py-1 px-2" style={{ minWidth: "52px" }}>
              <div className="relative flex items-center justify-center" style={{ width: "24px", height: "24px" }}>
                <TabIcon
                  className="h-[22px] w-[22px] transition-colors"
                  style={{ color: isActive ? "var(--storefront-primary, #FF3F6C)" : "var(--storefront-text, #1a1a1a)60" }}
                />
                {tab.badge != null && tab.badge > 0 && (
                  <span
                    className="absolute -right-2 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white"
                    style={{ backgroundColor: "var(--storefront-primary, #FF3F6C)" }}
                  >
                    {tab.badge > 9 ? "9+" : tab.badge}
                  </span>
                )}
              </div>
              <span
                className="text-[10px] font-medium"
                style={{ color: isActive ? "var(--storefront-primary, #FF3F6C)" : "var(--storefront-text, #1a1a1a)60" }}
              >
                {tab.label}
              </span>
            </div>
          );

          if (tab.isCart) {
            return (
              <button key={tab.label} onClick={openCart} className="transition-all active:scale-90">
                {content}
              </button>
            );
          }

          return (
            <Link key={tab.label} to={tab.to} className="transition-all active:scale-90">
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function StorefrontV12Skeleton() {
  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between bg-white">
        <Skeleton className="h-10 w-10 rounded-md" />
        <Skeleton className="h-8 w-28" />
        <div className="flex gap-1">
          <Skeleton className="h-10 w-10 rounded-md" />
          <Skeleton className="h-10 w-10 rounded-md" />
        </div>
      </div>
      <Skeleton className="h-[400px] w-full" />
      <div className="px-4 py-4 flex gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0">
            <Skeleton className="h-[72px] w-[72px] rounded-full" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
      <div className="px-4 grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-72 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/* ── Footer ── */
function V12Footer({ store }: { store: StoreData }) {
  const year = new Date().getFullYear();

  return (
    <footer
      className="mt-8"
      style={{
        backgroundColor: "var(--storefront-accent, #111111)",
        color: "#fff",
      }}
    >
      <div className="px-5 py-10 space-y-8 max-w-6xl mx-auto">
        <div className="text-center space-y-3">
          {store.logo_url ? (
            <img src={store.logo_url} alt={store.name} className="h-10 w-auto mx-auto object-contain brightness-0 invert" />
          ) : (
            <h3
              className="text-2xl font-bold"
              style={{ fontFamily: "var(--storefront-heading-font, 'Poppins'), sans-serif" }}
            >
              {store.name}
            </h3>
          )}
          {store.description && (
            <p className="text-sm opacity-60 max-w-md mx-auto leading-relaxed">{store.description}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6 text-sm">
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-widest opacity-50" style={{ color: "var(--storefront-primary, #FF3F6C)" }}>Quick Links</h4>
            {[
              { to: storefrontPath(store.slug), label: "Home" },
              { to: storefrontPath(store.slug, "best-sellers"), label: "Shop All" },
              { to: storefrontPath(store.slug, "contact"), label: "Contact Us" },
            ].map((link) => (
              <Link key={link.label} to={link.to} className="block opacity-60 hover:opacity-100 transition-opacity text-[13px]">
                {link.label}
              </Link>
            ))}
          </div>
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-widest opacity-50" style={{ color: "var(--storefront-primary, #FF3F6C)" }}>Policies</h4>
            {[
              { to: storefrontPath(store.slug, "return-policy"), label: "Return & Refund" },
              { to: storefrontPath(store.slug, "shipping-policy"), label: "Shipping Policy" },
              { to: storefrontPath(store.slug, "terms"), label: "Terms & Conditions" },
              { to: storefrontPath(store.slug, "privacy-policy"), label: "Privacy Policy" },
            ].map((link) => (
              <Link key={link.label} to={link.to} className="block opacity-60 hover:opacity-100 transition-opacity text-[13px]">
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="pt-6 border-t border-white/10 text-center">
          <p className="text-[11px] opacity-40">© {year} {store.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default function StorefrontLayoutV12({ slugOverride }: { slugOverride?: string } = {}) {
  const { store, isLoading, slug } = useStorefront(slugOverride);
  const viewTracked = useRef(false);
  const queryClient = useQueryClient();

  useFacebookPixel((store as any)?.facebook_pixel_id);

  useMetaTags({
    title: (store as any)?.meta_title || (store ? `${store.name} — Store` : undefined),
    description: (store as any)?.meta_description || store?.description || undefined,
    ogImage: (store as any)?.og_image_url || store?.logo_url || undefined,
    storeSlug: store?.slug,
  });

  useEffect(() => {
    if (!store?.id || viewTracked.current) return;
    viewTracked.current = true;
    trackPageView(store.id);
  }, [store?.id]);

  const themeConfig = useStorefrontThemeConfig(store?.id);

  useEffect(() => {
    if (!themeConfig) return;
    const fonts = [themeConfig.heading_font, themeConfig.body_font].filter(Boolean);
    const families = fonts.map((f: string) => f.replace(/ /g, "+")).join("&family=");
    const linkId = "storefront-google-fonts";
    let link = document.getElementById(linkId) as HTMLLinkElement;
    if (!link) {
      link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = `https://fonts.googleapis.com/css2?family=${families}&display=swap`;
  }, [themeConfig?.heading_font, themeConfig?.body_font]);

  const previewOverride = useThemePreview(store?.id);

  if (isLoading) return <StorefrontV12Skeleton />;

  if (!store) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <Store className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-semibold text-foreground">Store not found</h1>
        <p className="text-muted-foreground">The store "{slug}" doesn't exist.</p>
        <Button asChild variant="outline"><Link to="/">Go home</Link></Button>
      </div>
    );
  }

  const isLightColor = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 160;
  };

  const computePrimaryLight = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lighten = (c: number) => Math.min(255, Math.round(c + (255 - c) * 0.35));
    return `#${lighten(r).toString(16).padStart(2, "0")}${lighten(g).toString(16).padStart(2, "0")}${lighten(b).toString(16).padStart(2, "0")}`;
  };

  const primaryColor = themeConfig?.primary_color || "#FF3F6C";
  const primaryLight = computePrimaryLight(primaryColor);
  const btnTextColor = isLightColor(primaryColor) ? "#1a1a1a" : "#ffffff";

  const themeStyle: React.CSSProperties = (previewOverride || (themeConfig
    ? {
        "--storefront-primary": themeConfig.primary_color,
        "--storefront-primary-light": primaryLight,
        "--storefront-accent": themeConfig.accent_color,
        "--storefront-text": themeConfig.text_color,
        "--storefront-bg": themeConfig.background_color,
        "--storefront-heading-font": themeConfig.heading_font,
        "--storefront-body-font": themeConfig.body_font,
        "--storefront-button-radius": themeConfig.button_style === "pill" ? "9999px" : themeConfig.button_style === "square" ? "0px" : "0.5rem",
        "--storefront-marquee-gradient": themeConfig.marquee_gradient,
        "--storefront-btn-text": btnTextColor,
      } as any
    : {})) as any;

  return (
    <CartProvider slug={store.slug}>
      <WishlistProvider slug={store.slug}>
        <StorefrontAuthProvider storeId={store.id}>
          <div
            className="storefront-font min-h-screen"
            style={{
              ...themeStyle,
              "--storefront-bottom-nav-height": "64px",
              backgroundColor: "var(--storefront-bg, #ffffff)",
              color: "var(--storefront-text, #1a1a1a)",
              fontFamily: "var(--storefront-body-font, 'Inter'), sans-serif",
            } as React.CSSProperties}
          >
            <V12Header store={store} />
            <DynamicPwaManifest storeName={store.name} logoUrl={store.logo_url} themeColor={primaryColor} />
            <SmartInstallPrompt appName={store.name} primaryColor={primaryColor} textColor={btnTextColor} />
            <main className="pb-16 md:pb-0">
              <Suspense fallback={<StorefrontContentSkeleton />}><Outlet context={store} /></Suspense>
            </main>
            
            <V12Footer store={store} />
            <V12TabBar store={store} />
            <SideCart store={store} />
            <FloatingWhatsApp store={store} />
          </div>
        </StorefrontAuthProvider>
      </WishlistProvider>
    </CartProvider>
  );
}
