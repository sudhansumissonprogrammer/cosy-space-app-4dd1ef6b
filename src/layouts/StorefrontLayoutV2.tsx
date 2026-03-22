import { useState, useEffect, useRef, Suspense } from "react";
import { useThemePreview } from "@/hooks/useThemePreview";
import { Link, Outlet, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { Store, ShoppingCart, Heart, User, Search, Menu, X } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/integrations/supabase/types";
import { useStorefront, type StoreData } from "@/layouts/StorefrontLayout";
import { CartProvider, useCart } from "@/contexts/CartContext";
import { WishlistProvider, useWishlist } from "@/contexts/WishlistContext";
import { StorefrontAuthProvider, useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import StorefrontMarquee from "@/components/storefront/StorefrontMarquee";
import StorefrontFooter from "@/components/storefront/StorefrontFooter";
import StorefrontInstagramSection from "@/components/storefront/StorefrontInstagramSection";
import FloatingWhatsApp from "@/components/storefront/FloatingWhatsApp";
import SideCart from "@/components/storefront/SideCart";
import DynamicPwaManifest from "@/components/storefront/DynamicPwaManifest";
import { trackPageView } from "@/lib/trackPageView";
import SmartInstallPrompt from "@/components/SmartInstallPrompt";
import ShareStoreDialog from "@/components/ShareStoreDialog";
import { useMetaTags } from "@/hooks/useMetaTags";
import { useFacebookPixel } from "@/hooks/useFacebookPixel";
import { Skeleton } from "@/components/ui/skeleton";
import { StorefrontContentSkeleton } from "@/components/ContentSkeleton";
import { storefrontPath } from "@/lib/subdomain";

function CartBadgeV2() {
  const { cartCount, openCart } = useCart();
  return (
    <button onClick={openCart} className="relative">
      <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-md transition-colors hover:bg-white/20">
        <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>
      {cartCount > 0 && (
        <span
          className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
          style={{ backgroundColor: "var(--storefront-primary, hsl(var(--foreground)))", color: "var(--storefront-btn-text, hsl(var(--background)))" }}
        >
          {cartCount > 99 ? "99+" : cartCount}
        </span>
      )}
    </button>
  );
}

function WishlistBadgeV2({ slug }: { slug: string }) {
  const { wishlistCount } = useWishlist();
  return (
    <Link to={storefrontPath(slug, "wishlist")} className="relative">
      <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-md transition-colors hover:bg-white/20">
        <Heart className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>
      {wishlistCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
          {wishlistCount > 99 ? "99+" : wishlistCount}
        </span>
      )}
    </Link>
  );
}

function AccountBadgeV2({ slug }: { slug: string }) {
  const { user, loading } = useStorefrontAuth();
  if (loading) return null;
  return (
    <Link to={storefrontPath(slug, user ? "account" : "login")}>
      <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-md transition-colors hover:bg-white/20">
        <User className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>
    </Link>
  );
}

function TransparentNav({ store, scrolled }: { store: StoreData; scrolled: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const queryClient = useQueryClient();
  const categories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-30 transition-all duration-300"
      style={{
        backgroundColor: scrolled ? "var(--storefront-bg, hsl(var(--background)))" : "transparent",
        color: scrolled ? "var(--storefront-text, hsl(var(--foreground)))" : "#ffffff",
        borderBottom: scrolled ? "1px solid var(--storefront-text, hsl(var(--foreground)))10" : "none",
        backdropFilter: scrolled ? "blur(12px)" : "none",
      }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        {/* Hamburger */}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-md transition-colors hover:bg-white/20">
              <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
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

        {/* Logo */}
        <Link to={storefrontPath(store.slug)} className="flex-shrink-0">
          {store.logo_url ? (
            <img
              src={store.logo_url}
              alt={store.name}
              className="h-10 w-auto max-w-[140px] object-contain"
              style={{ filter: scrolled ? "none" : "brightness(0) invert(1)" }}
            />
          ) : (
            <span className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--storefront-heading-font, inherit)" }}>
              {store.name}
            </span>
          )}
        </Link>

        <div className="flex-1" />

        {/* Icons */}
        <div className="flex items-center gap-1.5">
          <AccountBadgeV2 slug={store.slug} />
          <WishlistBadgeV2 slug={store.slug} />
          <CartBadgeV2 />
          <ShareStoreDialog storeSlug={store.slug} storeName={store.name} iconOnly />
        </div>
      </div>
    </nav>
  );
}

function StorefrontV2Skeleton() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <Skeleton className="h-screen w-full" />
    </div>
  );
}

export default function StorefrontLayoutV2({ slugOverride }: { slugOverride?: string } = {}) {
  const { store, isLoading, slug } = useStorefront(slugOverride);
  const viewTracked = useRef(false);
  const queryClient = useQueryClient();
  const [scrolled, setScrolled] = useState(false);

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

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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

  if (isLoading) return <StorefrontV2Skeleton />;

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

  const primaryColor = themeConfig?.primary_color || "#b8873c";
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
          themeConfig.button_style === "pill" ? "9999px" : themeConfig.button_style === "square" ? "0px" : "0.5rem",
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
              backgroundColor: "var(--storefront-bg, hsl(var(--background)))",
              color: "var(--storefront-text, hsl(var(--foreground)))",
            }}
          >
            <TransparentNav store={store} scrolled={scrolled} />
            <DynamicPwaManifest storeName={store.name} logoUrl={store.logo_url} themeColor={primaryColor} />
            <SmartInstallPrompt appName={store.name} primaryColor={primaryColor} textColor={btnTextColor} />
            <main><Suspense fallback={<StorefrontContentSkeleton />}><Outlet context={store} /></Suspense></main>
            
            <StorefrontFooter store={store} />
            <SideCart store={store} />
            <FloatingWhatsApp store={store} />
          </div>
        </StorefrontAuthProvider>
      </WishlistProvider>
    </CartProvider>
  );
}
