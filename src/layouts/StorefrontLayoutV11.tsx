import { useState, useEffect, useRef } from "react";
import { useThemePreview } from "@/hooks/useThemePreview";
import { Link, Outlet, useParams, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { Store, ShoppingCart, Heart, Search, Menu, Home, Bell } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/integrations/supabase/types";
import { useStorefront, type StoreData } from "@/layouts/StorefrontLayout";
import { CartProvider, useCart } from "@/contexts/CartContext";
import { WishlistProvider, useWishlist } from "@/contexts/WishlistContext";
import { StorefrontAuthProvider, useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import StorefrontFooter from "@/components/storefront/StorefrontFooter";
import StorefrontInstagramSection from "@/components/storefront/StorefrontInstagramSection";
import FloatingWhatsApp from "@/components/storefront/FloatingWhatsApp";
import StorefrontSearchOverlay from "@/components/storefront/StorefrontSearchOverlay";
import SideCart from "@/components/storefront/SideCart";
import DynamicPwaManifest from "@/components/storefront/DynamicPwaManifest";
import StorefrontOrderNotification from "@/components/storefront/StorefrontOrderNotification";
import SmartInstallPrompt from "@/components/SmartInstallPrompt";
import { useMetaTags } from "@/hooks/useMetaTags";
import { useFacebookPixel } from "@/hooks/useFacebookPixel";
import { Skeleton } from "@/components/ui/skeleton";
import { storefrontPath } from "@/lib/subdomain";

/* ── App-style sticky header (same as Theme 3) ── */
function AppHeader({ store }: { store: StoreData }) {
  const { cartCount, openCart } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const queryClient = useQueryClient();
  const categories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]);
  const products = queryClient.getQueryData<any[]>(["storefront-products", store.id]);

  return (
    <>
    <header className="sticky top-0 z-30 border-b" style={{ backgroundColor: "var(--storefront-bg, hsl(var(--background)))", borderColor: "var(--storefront-text, hsl(var(--foreground)))10" }}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))10" }}>
              <Menu className="h-5 w-5" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }} />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="storefront-font w-[280px] p-0">
            <div className="flex flex-col">
              <div className="border-b bg-card p-4">
                {store.logo_url ? (
                  <img src={store.logo_url} alt={store.name} className="h-10 w-auto max-w-[160px] object-contain" />
                ) : (
                  <span className="text-lg font-bold text-foreground">{store.name}</span>
                )}
              </div>
              <nav className="flex flex-col gap-1 p-4">
                {[
                  { to: storefrontPath(store.slug), label: "Home" },
                  { to: storefrontPath(store.slug, "account"), label: "My Account" },
                  { to: storefrontPath(store.slug, "wishlist"), label: "Wishlist" },
                  { to: storefrontPath(store.slug, "contact"), label: "Contact Us" },
                  { to: storefrontPath(store.slug, "return-policy"), label: "Return Policy" },
                ].map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    {link.label}
                  </Link>
                ))}
                {categories && categories.length > 0 && (
                  <>
                    <div className="mt-3 mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categories</div>
                    {categories.map((cat: any) => (
                      <Link
                        key={cat.id}
                        to={storefrontPath(store.slug, `category/${cat.slug}`)}
                        onClick={() => setMenuOpen(false)}
                        className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                      >
                        {cat.name}
                      </Link>
                    ))}
                  </>
                )}
              </nav>
            </div>
          </SheetContent>
        </Sheet>

        {/* Store Logo / Name */}
        <Link to={storefrontPath(store.slug)} className="flex items-center shrink-0">
          {store.logo_url ? (
            <img src={store.logo_url} alt={store.name} className="h-8 w-auto max-w-[120px] object-contain" />
          ) : (
            <span className="text-base font-bold" style={{ color: "var(--storefront-text, hsl(var(--foreground)))", fontFamily: "var(--storefront-heading-font, inherit)" }}>{store.name}</span>
          )}
        </Link>

        {/* Search pill */}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex flex-1 items-center gap-2 rounded-full px-3.5 py-2 text-sm transition-all active:scale-[0.98]"
          style={{
            backgroundColor: "var(--storefront-text, hsl(var(--foreground)))08",
            border: "1px solid var(--storefront-text, hsl(var(--foreground)))12",
          }}
        >
          <Search className="h-4 w-4 shrink-0" style={{ color: "var(--storefront-text, hsl(var(--foreground)))50" }} />
          <span style={{ color: "var(--storefront-text, hsl(var(--foreground)))40" }}>Search products...</span>
        </button>
      </div>
    </header>

    <StorefrontSearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} products={products} slug={store.slug} initialFiltersOpen={false} />
    </>
  );
}

/* ── Shopping App Bottom Nav Bar ── */
function ShoppingAppBottomNav({ store }: { store: StoreData }) {
  const location = useLocation();
  const { wishlistCount } = useWishlist();
  const { cartCount, openCart } = useCart();
  const { user } = useStorefrontAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const queryClient = useQueryClient();
  const products = queryClient.getQueryData<any[]>(["storefront-products", store.id]);

  const basePath = storefrontPath(store.slug);
  const isHome = location.pathname === basePath || location.pathname === basePath + "/";
  const isWishlist = location.pathname.includes("wishlist");
  const isAccount = location.pathname.includes("account");

  const navItems = [
    { icon: Home, label: "Home", isActive: isHome && !searchOpen, type: "link" as const, to: basePath },
    { icon: Search, label: "Search", isActive: searchOpen, type: "search" as const, to: "" },
    { icon: Heart, label: "Wishlist", isActive: isWishlist && !searchOpen, type: "link" as const, to: storefrontPath(store.slug, "wishlist"), badge: wishlistCount },
    { icon: Bell, label: "Alerts", isActive: isAccount && !searchOpen, type: "link" as const, to: storefrontPath(store.slug, user ? "account" : "login") },
  ];

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-3 mb-2 flex items-center gap-2">
          {/* Left pill with nav items */}
          <div
            className="flex flex-1 items-center justify-around rounded-[28px] px-1.5 py-2"
            style={{
              backgroundColor: "var(--storefront-bg, hsl(var(--background)))",
              boxShadow: "0 2px 20px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
            }}
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const handleClick = item.type === "search"
                ? () => setSearchOpen((prev) => !prev)
                : undefined;

              const content = (
                <>
                  <div
                    className="absolute inset-0 rounded-full transition-all duration-300 ease-out"
                    style={{
                      backgroundColor: item.isActive ? "var(--storefront-text, hsl(var(--foreground)))" : "transparent",
                      transform: item.isActive ? "scale(1)" : "scale(0.8)",
                      opacity: item.isActive ? 1 : 0,
                    }}
                  />
                  <Icon
                    className="relative z-10 h-[22px] w-[22px] transition-all duration-300"
                    style={{
                      color: item.isActive ? "var(--storefront-bg, hsl(var(--background)))" : "var(--storefront-text, hsl(var(--foreground)))45",
                    }}
                    strokeWidth={1.8}
                    fill={item.isActive ? "var(--storefront-bg, hsl(var(--background)))" : "none"}
                  />
                  <span
                    className="relative z-10 text-xs font-semibold overflow-hidden transition-all duration-300 ease-out"
                    style={{
                      color: item.isActive ? "var(--storefront-bg, hsl(var(--background)))" : "transparent",
                      maxWidth: item.isActive ? "80px" : "0px",
                      opacity: item.isActive ? 1 : 0,
                      marginLeft: item.isActive ? "6px" : "0px",
                    }}
                  >
                    {item.label}
                  </span>
                  {!item.isActive && item.badge && item.badge > 0 && (
                    <span
                      className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold z-20"
                      style={{ backgroundColor: "#EF4444", color: "#fff" }}
                    >
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </>
              );

              if (item.type === "search") {
                return (
                  <button
                    key={item.label}
                    onClick={handleClick}
                    className="relative flex items-center justify-center rounded-full px-3 py-2.5 transition-all duration-300 active:scale-95"
                  >
                    {content}
                  </button>
                );
              }

              return (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={() => setSearchOpen(false)}
                  className="relative flex items-center justify-center rounded-full px-3 py-2.5 transition-all duration-300 active:scale-95"
                >
                  {content}
                </Link>
              );
            })}
          </div>

          {/* Separated cart circle */}
          <button
            onClick={openCart}
            className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95"
            style={{
              backgroundColor: "var(--storefront-bg, hsl(var(--background)))",
              boxShadow: "0 2px 20px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
            }}
          >
            <ShoppingCart
              className="h-[22px] w-[22px]"
              style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}
              strokeWidth={1.8}
            />
            {cartCount > 0 && (
              <span
                className="absolute -right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                style={{ backgroundColor: "#EF4444", color: "#fff" }}
              >
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      <StorefrontSearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} products={products} slug={store.slug} initialFiltersOpen={false} />
    </>
  );
}

function StorefrontV11Skeleton() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <div className="sticky top-0 z-30 border-b bg-card px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-9 flex-1 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-xl" />
        </div>
      </div>
      <div className="px-3 py-3">
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
      <div className="px-3">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function StorefrontLayoutV11({ slugOverride }: { slugOverride?: string } = {}) {
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
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    if (!projectId) return;
    setTimeout(() => {
      fetch(`https://${projectId}.supabase.co/functions/v1/track-view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_id: store.id, path: window.location.pathname }),
      }).catch(() => {});
    }, 3000);
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

  if (isLoading) return <StorefrontV11Skeleton />;

  if (!store) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <Store className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-semibold text-foreground">Store not found</h1>
        <p className="text-muted-foreground">The store "{slug}" doesn't exist.</p>
        <Button asChild variant="outline">
          <Link to="/">Go home</Link>
        </Button>
      </div>
    );
  }

  const computePrimaryLight = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lighten = (c: number) => Math.min(255, Math.round(c + (255 - c) * 0.35));
    return `#${lighten(r).toString(16).padStart(2, "0")}${lighten(g).toString(16).padStart(2, "0")}${lighten(b).toString(16).padStart(2, "0")}`;
  };

  const isLightColor = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 160;
  };

  const primaryColor = themeConfig?.primary_color || "#3B82F6";
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
        "--storefront-button-radius":
          themeConfig.button_style === "pill" ? "9999px" : themeConfig.button_style === "square" ? "0px" : "0.75rem",
        "--storefront-marquee-gradient": themeConfig.marquee_gradient,
        "--storefront-btn-text": btnTextColor,
      } as any
    : {})) as any;

  return (
    <CartProvider slug={store.slug}>
      <WishlistProvider slug={store.slug}>
        <StorefrontAuthProvider storeId={store.id}>
          <div
            className="storefront-font min-h-screen font-sans"
            style={{
              ...themeStyle,
              "--storefront-bottom-nav-height": "80px",
              backgroundColor: "var(--storefront-bg, hsl(var(--background)))",
              color: "var(--storefront-text, hsl(var(--foreground)))",
            } as React.CSSProperties}
          >
            <AppHeader store={store} />
            <DynamicPwaManifest storeName={store.name} logoUrl={store.logo_url} themeColor={primaryColor} />
            <StorefrontOrderNotification storeName={store.name} />
            <SmartInstallPrompt appName={store.name} primaryColor={primaryColor} textColor={btnTextColor} />
            <div className="pb-24 md:pb-0">
              <Outlet context={store} />
            </div>
            <StorefrontInstagramSection store={store} />
            <div className="pb-24 md:pb-0">
              <StorefrontFooter store={store} />
            </div>
            <ShoppingAppBottomNav store={store} />
            <SideCart store={store} />
            <FloatingWhatsApp store={store} />
          </div>
        </StorefrontAuthProvider>
      </WishlistProvider>
    </CartProvider>
  );
}
