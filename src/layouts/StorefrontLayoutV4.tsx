import { useState, useEffect, useRef } from "react";
import { Link, Outlet, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Store, ShoppingCart, Heart, User, Search, Menu, X } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/integrations/supabase/types";
import { useStorefront, type StoreData } from "@/layouts/StorefrontLayout";
import { CartProvider, useCart } from "@/contexts/CartContext";
import { WishlistProvider, useWishlist } from "@/contexts/WishlistContext";
import { StorefrontAuthProvider, useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import StorefrontFooter from "@/components/storefront/StorefrontFooter";
import FloatingWhatsApp from "@/components/storefront/FloatingWhatsApp";
import SideCart from "@/components/storefront/SideCart";
import ShareStoreDialog from "@/components/ShareStoreDialog";
import { useMetaTags } from "@/hooks/useMetaTags";
import { useFacebookPixel } from "@/hooks/useFacebookPixel";
import { Skeleton } from "@/components/ui/skeleton";
import { storefrontPath } from "@/lib/subdomain";

/* ── Luxury Cart Badge ── */
function CartBadgeV4() {
  const { cartCount, openCart } = useCart();
  return (
    <button onClick={openCart} className="relative group">
      <ShoppingCart className="h-[18px] w-[18px] transition-opacity group-hover:opacity-70" />
      {cartCount > 0 && (
        <span
          className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-medium"
          style={{ backgroundColor: "var(--storefront-primary, #C8A96A)", color: "var(--storefront-btn-text, #fff)" }}
        >
          {cartCount > 99 ? "99+" : cartCount}
        </span>
      )}
    </button>
  );
}

function WishlistBadgeV4({ slug }: { slug: string }) {
  const { wishlistCount } = useWishlist();
  return (
    <Link to={storefrontPath(slug, "wishlist")} className="relative group">
      <Heart className="h-[18px] w-[18px] transition-opacity group-hover:opacity-70" />
      {wishlistCount > 0 && (
        <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-medium text-destructive-foreground">
          {wishlistCount > 99 ? "99+" : wishlistCount}
        </span>
      )}
    </Link>
  );
}

function AccountBadgeV4({ slug }: { slug: string }) {
  const { user, loading } = useStorefrontAuth();
  if (loading) return null;
  return (
    <Link to={storefrontPath(slug, user ? "account" : "login")} className="group">
      <User className="h-[18px] w-[18px] transition-opacity group-hover:opacity-70" />
    </Link>
  );
}

/* ── Luxury Minimal Nav ── */
function LuxuryNav({ store, scrolled }: { store: StoreData; scrolled: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const queryClient = useQueryClient();
  const categories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-30 transition-all duration-500"
      style={{
        backgroundColor: scrolled
          ? "var(--storefront-bg, #F8F5F0)"
          : "transparent",
        color: scrolled
          ? "var(--storefront-text, #1C1C1C)"
          : "#ffffff",
        borderBottom: scrolled
          ? "1px solid var(--storefront-text, #1C1C1C)15"
          : "none",
      }}
    >
      {/* Top line accent */}
      <div className="h-[2px] w-full" style={{ backgroundColor: "var(--storefront-primary, #C8A96A)" }} />

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-12">
        {/* Left: Menu */}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button className="tracking-[0.2em] text-[11px] font-light uppercase transition-opacity hover:opacity-60">
              Menu
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="storefront-font w-[320px] p-0 border-r-0">
            <div className="flex flex-col h-full" style={{ backgroundColor: "var(--storefront-bg, #F8F5F0)" }}>
              <div className="border-b px-8 py-6" style={{ borderColor: "var(--storefront-text, #1C1C1C)10" }}>
                <span className="text-lg tracking-[0.15em] uppercase" style={{ fontFamily: "var(--storefront-heading-font, 'Playfair Display')", color: "var(--storefront-text, #1C1C1C)" }}>
                  {store.name}
                </span>
              </div>
              <nav className="flex flex-col gap-0 px-8 py-6">
                {[
                  { to: storefrontPath(store.slug), label: "Home" },
                  { to: storefrontPath(store.slug, "best-sellers"), label: "Best Sellers" },
                  { to: storefrontPath(store.slug, "account"), label: "Account" },
                  { to: storefrontPath(store.slug, "wishlist"), label: "Wishlist" },
                  { to: storefrontPath(store.slug, "contact"), label: "Contact" },
                  { to: storefrontPath(store.slug, "return-policy"), label: "Returns" },
                ].map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMenuOpen(false)}
                    className="border-b py-3.5 text-[13px] font-light tracking-[0.1em] uppercase transition-opacity hover:opacity-60"
                    style={{ borderColor: "var(--storefront-text, #1C1C1C)08", color: "var(--storefront-text, #1C1C1C)" }}
                  >
                    {link.label}
                  </Link>
                ))}
                {categories && categories.length > 0 && (
                  <>
                    <div className="mt-6 mb-3 text-[10px] font-medium tracking-[0.25em] uppercase" style={{ color: "var(--storefront-primary, #C8A96A)" }}>
                      Collections
                    </div>
                    {categories.map((cat: any) => (
                      <Link
                        key={cat.id}
                        to={storefrontPath(store.slug, `category/${cat.slug}`)}
                        onClick={() => setMenuOpen(false)}
                        className="border-b py-3 text-[13px] font-light tracking-[0.1em] uppercase transition-opacity hover:opacity-60"
                        style={{ borderColor: "var(--storefront-text, #1C1C1C)08", color: "var(--storefront-text, #1C1C1C)" }}
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

        {/* Center: Logo */}
        <Link to={storefrontPath(store.slug)} className="absolute left-1/2 -translate-x-1/2">
          {store.logo_url ? (
            <img
              src={store.logo_url}
              alt={store.name}
              className="h-8 w-auto max-w-[160px] object-contain"
              style={{ filter: scrolled ? "none" : "brightness(0) invert(1)" }}
            />
          ) : (
            <span
              className="text-xl tracking-[0.15em] uppercase"
              style={{ fontFamily: "var(--storefront-heading-font, 'Playfair Display')" }}
            >
              {store.name}
            </span>
          )}
        </Link>

        {/* Right: Icons */}
        <div className="flex items-center gap-5">
          <AccountBadgeV4 slug={store.slug} />
          <WishlistBadgeV4 slug={store.slug} />
          <CartBadgeV4 />
          <ShareStoreDialog storeSlug={store.slug} storeName={store.name} iconOnly />
        </div>
      </div>
    </nav>
  );
}

function StorefrontV4Skeleton() {
  return (
    <div className="min-h-screen bg-background">
      <Skeleton className="h-screen w-full" />
    </div>
  );
}

export default function StorefrontLayoutV4({ slugOverride }: { slugOverride?: string } = {}) {
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

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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

  if (isLoading) return <StorefrontV4Skeleton />;

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

  const primaryColor = themeConfig?.primary_color || "#C8A96A";
  const primaryLight = computePrimaryLight(primaryColor);
  const btnTextColor = isLightColor(primaryColor) ? "#1a1a1a" : "#ffffff";

  const themeStyle: React.CSSProperties = themeConfig
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
    : {};

  return (
    <CartProvider slug={store.slug}>
      <WishlistProvider slug={store.slug}>
        <StorefrontAuthProvider storeId={store.id}>
          <div
            className="storefront-font min-h-screen"
            style={{
              ...themeStyle,
              backgroundColor: "var(--storefront-bg, #F8F5F0)",
              color: "var(--storefront-text, #1C1C1C)",
              fontFamily: "var(--storefront-body-font, 'Inter')",
            }}
          >
            <LuxuryNav store={store} scrolled={scrolled} />
            <Outlet context={store} />
            <StorefrontFooter store={store} />
            <SideCart store={store} />
            <FloatingWhatsApp store={store} />
          </div>
        </StorefrontAuthProvider>
      </WishlistProvider>
    </CartProvider>
  );
}
