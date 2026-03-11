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

/* ── Glassmorphism Cart Badge ── */
function CartBadgeV5() {
  const { cartCount, openCart } = useCart();
  return (
    <button onClick={openCart} className="relative group">
      <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md border border-white/10 transition-all duration-300 hover:bg-white/20 hover:border-white/20 hover:scale-105">
        <ShoppingCart className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
      </div>
      {cartCount > 0 && (
        <span
          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold animate-scale-in"
          style={{ background: "linear-gradient(135deg, var(--storefront-primary, #6366F1), var(--storefront-accent, #22C55E))", color: "#fff" }}
        >
          {cartCount > 99 ? "99+" : cartCount}
        </span>
      )}
    </button>
  );
}

function WishlistBadgeV5({ slug }: { slug: string }) {
  const { wishlistCount } = useWishlist();
  return (
    <Link to={storefrontPath(slug, "wishlist")} className="relative group">
      <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md border border-white/10 transition-all duration-300 hover:bg-white/20 hover:border-white/20 hover:scale-105">
        <Heart className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
      </div>
      {wishlistCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
          {wishlistCount > 99 ? "99+" : wishlistCount}
        </span>
      )}
    </Link>
  );
}

function AccountBadgeV5({ slug }: { slug: string }) {
  const { user, loading } = useStorefrontAuth();
  if (loading) return null;
  return (
    <Link to={storefrontPath(slug, user ? "account" : "login")} className="group">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md border border-white/10 transition-all duration-300 hover:bg-white/20 hover:border-white/20 hover:scale-105">
        <User className="h-4.5 w-4.5" />
      </div>
    </Link>
  );
}

/* ── Glassmorphism Navbar ── */
function GlassNav({ store, scrolled }: { store: StoreData; scrolled: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const queryClient = useQueryClient();
  const categories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-30 transition-all duration-500"
      style={{
        backgroundColor: scrolled ? "var(--storefront-bg, #0F172A)e8" : "transparent",
        backdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "none",
      }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 lg:px-8">
        {/* Menu */}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md border border-white/10 transition-all duration-300 hover:bg-white/20">
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="storefront-font w-[300px] p-0 border-r-0">
            <div
              className="flex flex-col h-full"
              style={{ backgroundColor: "var(--storefront-bg, #0F172A)", color: "var(--storefront-text, #e2e8f0)" }}
            >
              <div className="border-b border-white/10 p-6">
                {store.logo_url ? (
                  <img src={store.logo_url} alt={store.name} className="h-8 w-auto max-w-[160px] object-contain" />
                ) : (
                  <span className="text-lg font-bold" style={{ fontFamily: "var(--storefront-heading-font, 'Space Grotesk')" }}>
                    {store.name}
                  </span>
                )}
              </div>
              <nav className="flex flex-col gap-0.5 p-4">
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
                    className="rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 hover:bg-white/10"
                  >
                    {link.label}
                  </Link>
                ))}
                {categories && categories.length > 0 && (
                  <>
                    <div className="mt-4 mb-2 px-4 text-[10px] font-semibold tracking-[0.2em] uppercase opacity-40">Categories</div>
                    {categories.map((cat: any) => (
                      <Link
                        key={cat.id}
                        to={storefrontPath(store.slug, `category/${cat.slug}`)}
                        onClick={() => setMenuOpen(false)}
                        className="rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 hover:bg-white/10"
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
              className="h-8 w-auto max-w-[140px] object-contain"
              style={{ filter: scrolled ? "none" : "brightness(0) invert(1)" }}
            />
          ) : (
            <span
              className="text-lg font-bold tracking-tight"
              style={{ fontFamily: "var(--storefront-heading-font, 'Space Grotesk')" }}
            >
              {store.name}
            </span>
          )}
        </Link>

        <div className="flex-1" />

        {/* Icons */}
        <div className="flex items-center gap-2">
          <AccountBadgeV5 slug={store.slug} />
          <WishlistBadgeV5 slug={store.slug} />
          <CartBadgeV5 />
          <ShareStoreDialog storeSlug={store.slug} storeName={store.name} iconOnly />
        </div>
      </div>
    </nav>
  );
}

/* ── Dark Mode Footer Override ── */
function DarkFooter({ store }: { store: StoreData }) {
  return (
    <footer
      className="border-t border-white/5 px-6 py-12 lg:px-12"
      style={{
        backgroundColor: "var(--storefront-accent, #0F172A)",
        color: "var(--storefront-text, #e2e8f0)",
      }}
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <h3 className="text-lg font-bold mb-3" style={{ fontFamily: "var(--storefront-heading-font, 'Space Grotesk')" }}>
              {store.name}
            </h3>
            <p className="text-sm opacity-50 leading-relaxed">{store.description || "Modern products for modern people."}</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3 opacity-70">Quick Links</h4>
            <div className="flex flex-col gap-2">
              {["Home", "Best Sellers", "Contact", "Returns"].map((l) => (
                <span key={l} className="text-sm opacity-40 hover:opacity-80 transition-opacity cursor-pointer">{l}</span>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3 opacity-70">Legal</h4>
            <div className="flex flex-col gap-2">
              {["Privacy Policy", "Terms & Conditions", "Shipping Policy"].map((l) => (
                <span key={l} className="text-sm opacity-40 hover:opacity-80 transition-opacity cursor-pointer">{l}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-10 border-t border-white/5 pt-6 text-center">
          <p className="text-xs opacity-30">© 2026 {store.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

function StorefrontV5Skeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0F172A" }}>
      <Skeleton className="h-screen w-full opacity-20" />
    </div>
  );
}

export default function StorefrontLayoutV5({ slugOverride }: { slugOverride?: string } = {}) {
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
    const handleScroll = () => setScrolled(window.scrollY > 60);
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

  if (isLoading) return <StorefrontV5Skeleton />;

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

  const primaryColor = themeConfig?.primary_color || "#6366F1";
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
          themeConfig.button_style === "pill" ? "9999px" : themeConfig.button_style === "square" ? "0px" : "0.75rem",
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
              backgroundColor: "var(--storefront-bg, #0F172A)",
              color: "var(--storefront-text, #e2e8f0)",
              fontFamily: "var(--storefront-body-font, 'Inter')",
            }}
          >
            <GlassNav store={store} scrolled={scrolled} />
            <Outlet context={store} />
            <DarkFooter store={store} />
            <SideCart store={store} />
            <FloatingWhatsApp store={store} />
          </div>
        </StorefrontAuthProvider>
      </WishlistProvider>
    </CartProvider>
  );
}
