import { useState, useEffect, useRef } from "react";
import { useThemePreview } from "@/hooks/useThemePreview";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Store, ShoppingCart, Heart, User, Search, Menu, Home, LayoutGrid, X } from "lucide-react";
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
import StorefrontOrderNotification from "@/components/storefront/StorefrontOrderNotification";
import SmartInstallPrompt from "@/components/SmartInstallPrompt";
import StorefrontSearchOverlay from "@/components/storefront/StorefrontSearchOverlay";
import { useMetaTags } from "@/hooks/useMetaTags";
import { useFacebookPixel } from "@/hooks/useFacebookPixel";
import { Skeleton } from "@/components/ui/skeleton";
import { storefrontPath } from "@/lib/subdomain";

/* ── Compact Sticky Header ── */
function MobileAppHeader({ store }: { store: StoreData }) {
  const { cartCount, openCart } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const queryClient = useQueryClient();
  const categories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]);
  const products = queryClient.getQueryData<any[]>(["storefront-products", store.id]);
  const location = useLocation();
  const slug = store.slug;

  return (
    <>
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-md"
        style={{
          backgroundColor: "var(--storefront-bg, hsl(var(--background)))ee",
          borderColor: "var(--storefront-text, hsl(var(--foreground)))08",
        }}
      >
        <div className="flex items-center gap-2 px-3 py-2">
          {/* Hamburger */}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button className="flex h-9 w-9 items-center justify-center rounded-2xl transition-all active:scale-95" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))10" }}>
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
                    { to: storefrontPath(slug), label: "Home" },
                    { to: storefrontPath(slug, "account"), label: "My Account" },
                    { to: storefrontPath(slug, "wishlist"), label: "Wishlist" },
                    { to: storefrontPath(slug, "contact"), label: "Contact Us" },
                    { to: storefrontPath(slug, "return-policy"), label: "Return Policy" },
                  ].map((link) => (
                    <Link key={link.to} to={link.to} onClick={() => setMenuOpen(false)} className="rounded-2xl px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent">
                      {link.label}
                    </Link>
                  ))}
                  {categories && categories.length > 0 && (
                    <>
                      <div className="mt-3 mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categories</div>
                      {categories.map((cat: any) => (
                        <Link key={cat.id} to={storefrontPath(slug, `category/${cat.slug}`)} onClick={() => setMenuOpen(false)} className="rounded-2xl px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent">
                          {cat.name}
                        </Link>
                      ))}
                    </>
                  )}
                </nav>
              </div>
            </SheetContent>
          </Sheet>

          {/* Pill Search Bar */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex flex-1 items-center gap-2 rounded-full px-4 py-2 text-sm transition-all active:scale-[0.98]"
            style={{
              backgroundColor: "var(--storefront-text, hsl(var(--foreground)))06",
              border: "1.5px solid var(--storefront-text, hsl(var(--foreground)))10",
            }}
          >
            <Search className="h-4 w-4 shrink-0" style={{ color: "var(--storefront-text, hsl(var(--foreground)))40" }} />
            <span style={{ color: "var(--storefront-text, hsl(var(--foreground)))35" }}>Search products...</span>
          </button>

          {/* Cart */}
          <button onClick={openCart} className="relative flex h-9 w-9 items-center justify-center rounded-2xl transition-all active:scale-95" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))10" }}>
            <ShoppingCart className="h-5 w-5" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }} />
            {cartCount > 0 && (
              <span
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                style={{ backgroundColor: "var(--storefront-primary, hsl(var(--foreground)))", color: "var(--storefront-btn-text, hsl(var(--background)))" }}
              >
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <StorefrontSearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} products={products} slug={slug} initialFiltersOpen={false} />
    </>
  );
}

/* ── Bottom Tab Bar — Pill Active Indicator ── */
function BottomTabBar({ store }: { store: StoreData }) {
  const location = useLocation();
  const { wishlistCount } = useWishlist();
  const { user } = useStorefrontAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const queryClient = useQueryClient();
  const products = queryClient.getQueryData<any[]>(["storefront-products", store.id]);

  const basePath = storefrontPath(store.slug);
  const tabs = [
    { icon: Home, label: "Home", to: basePath, matchExact: true },
    { icon: LayoutGrid, label: "Categories", to: storefrontPath(store.slug, "best-sellers"), match: "best-sellers" },
    { icon: Search, label: "Search", to: "__search__", match: "__never__" },
    { icon: Heart, label: "Wishlist", to: storefrontPath(store.slug, "wishlist"), match: "wishlist", badge: wishlistCount },
    { icon: User, label: "Profile", to: storefrontPath(store.slug, user ? "account" : "login"), match: "account" },
  ];

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t md:hidden"
        style={{
          backgroundColor: "var(--storefront-bg, hsl(var(--background)))f8",
          borderColor: "var(--storefront-text, hsl(var(--foreground)))08",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <div className="flex items-center justify-around px-2" style={{ paddingBottom: "env(safe-area-inset-bottom)", minHeight: "60px" }}>
          {tabs.map((tab) => {
            const isActive = tab.matchExact
              ? location.pathname === basePath || location.pathname === basePath + "/"
              : location.pathname.includes(tab.match!);
            const TabIcon = tab.icon;
            const isSearch = tab.to === "__search__";
            return isSearch ? (
                <button
                  key={tab.label}
                  onClick={() => setSearchOpen(true)}
                  className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 transition-all relative"
                  style={{ minWidth: "48px" }}
                >
                  <div className="relative">
                    <div
                      className="flex items-center justify-center rounded-2xl transition-all"
                      style={{ width: "36px", height: "28px" }}
                    >
                      <TabIcon
                        className="h-[18px] w-[18px] transition-colors"
                        style={{ color: "var(--storefront-text, hsl(var(--foreground)))50" }}
                      />
                    </div>
                  </div>
                  <span
                    className="text-[10px] font-semibold"
                    style={{ color: "var(--storefront-text, hsl(var(--foreground)))45" }}
                  >
                    {tab.label}
                  </span>
                </button>
              ) : (
              <Link
                key={tab.label}
                to={tab.to}
                className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 transition-all relative"
                style={{ minWidth: "48px" }}
              >
                {isActive && (
                  <div
                    className="absolute -top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-full"
                    style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))" }}
                  />
                )}
                <div className="relative">
                  <div
                    className="flex items-center justify-center rounded-2xl transition-all"
                    style={{
                      width: "36px",
                      height: "28px",
                      backgroundColor: isActive ? "var(--storefront-primary, hsl(var(--primary)))15" : "transparent",
                    }}
                  >
                    <TabIcon
                      className="h-[18px] w-[18px] transition-colors"
                      style={{ color: isActive ? "var(--storefront-primary, hsl(var(--primary)))" : "var(--storefront-text, hsl(var(--foreground)))50" }}
                    />
                  </div>
                  {tab.badge && tab.badge > 0 && (
                    <span
                      className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold"
                      style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))", color: "var(--storefront-btn-text, #fff)" }}
                    >
                      {tab.badge > 9 ? "9+" : tab.badge}
                    </span>
                  )}
                </div>
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: isActive ? "var(--storefront-primary, hsl(var(--primary)))" : "var(--storefront-text, hsl(var(--foreground)))45" }}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <StorefrontSearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} products={products} slug={store.slug} initialFiltersOpen={false} />
    </>
  );
}

function StorefrontV8Skeleton() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <div className="sticky top-0 z-30 border-b bg-card px-3 py-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-2xl" />
          <Skeleton className="h-9 flex-1 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-2xl" />
        </div>
      </div>
      <div className="p-4">
        <Skeleton className="h-44 w-full rounded-2xl" />
      </div>
      <div className="px-4 flex gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <Skeleton className="h-14 w-14 rounded-full" />
            <Skeleton className="h-2 w-10" />
          </div>
        ))}
      </div>
      <div className="px-4 pt-4">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-60 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function StorefrontLayoutV8({ slugOverride }: { slugOverride?: string } = {}) {
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

  const themeConfig = store ? queryClient.getQueryData<any>(["storefront-theme-config", store.id]) : null;

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

  const previewOverride = useThemePreview();

  if (isLoading) return <StorefrontV8Skeleton />;

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

  const primaryColor = themeConfig?.primary_color || "#6C5CE7";
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
          themeConfig.button_style === "pill" ? "9999px" : themeConfig.button_style === "square" ? "0px" : "1rem",
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
              "--storefront-bottom-nav-height": "72px",
              backgroundColor: "var(--storefront-bg, hsl(var(--background)))",
              color: "var(--storefront-text, hsl(var(--foreground)))",
            } as React.CSSProperties}
          >
            <MobileAppHeader store={store} />
            <DynamicPwaManifest storeName={store.name} logoUrl={store.logo_url} themeColor={primaryColor} />
            <StorefrontOrderNotification storeName={store.name} />
            <SmartInstallPrompt appName={store.name} primaryColor={primaryColor} textColor={btnTextColor} />
            <div className="pb-20 md:pb-0">
              <Outlet context={store} />
            </div>
            <StorefrontInstagramSection store={store} />
            <div className="hidden md:block">
              <StorefrontFooter store={store} />
            </div>
            <BottomTabBar store={store} />
            <SideCart store={store} />
            <FloatingWhatsApp store={store} />
          </div>
        </StorefrontAuthProvider>
      </WishlistProvider>
    </CartProvider>
  );
}
