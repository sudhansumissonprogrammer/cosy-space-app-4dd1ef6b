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

/* ── Cart Badge ── */
function CartBadgeV6() {
  const { cartCount, openCart } = useCart();
  return (
    <button onClick={openCart} className="relative group">
      <ShoppingCart className="h-5 w-5 transition-colors" style={{ color: "var(--storefront-text, #1e293b)" }} />
      {cartCount > 0 && (
        <span
          className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
          style={{ backgroundColor: "var(--storefront-primary, #2563EB)", color: "#fff" }}
        >
          {cartCount > 99 ? "99+" : cartCount}
        </span>
      )}
    </button>
  );
}

function WishlistBadgeV6({ slug }: { slug: string }) {
  const { wishlistCount } = useWishlist();
  return (
    <Link to={storefrontPath(slug, "wishlist")} className="relative group">
      <Heart className="h-5 w-5 transition-colors" style={{ color: "var(--storefront-text, #1e293b)" }} />
      {wishlistCount > 0 && (
        <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
          {wishlistCount > 99 ? "99+" : wishlistCount}
        </span>
      )}
    </Link>
  );
}

function AccountBadgeV6({ slug }: { slug: string }) {
  const { user, loading } = useStorefrontAuth();
  if (loading) return null;
  return (
    <Link to={storefrontPath(slug, user ? "account" : "login")} className="group">
      <User className="h-5 w-5 transition-colors" style={{ color: "var(--storefront-text, #1e293b)" }} />
    </Link>
  );
}

/* ── Clean Sticky Header ── */
function CleanHeader({ store }: { store: StoreData }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const queryClient = useQueryClient();
  const categories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { to: storefrontPath(store.slug), label: "Home" },
    { to: storefrontPath(store.slug, "best-sellers"), label: "Shop" },
    { to: storefrontPath(store.slug, "contact"), label: "About" },
  ];

  return (
    <header
      className="sticky top-0 z-30 transition-shadow duration-300"
      style={{
        height: "72px",
        backgroundColor: "var(--storefront-bg, #F8FAFC)",
        borderBottom: "1px solid",
        borderColor: scrolled ? "var(--storefront-text, #1e293b)10" : "var(--storefront-text, #1e293b)08",
        boxShadow: scrolled ? "0 1px 3px rgba(0,0,0,0.04)" : "none",
      }}
    >
      <div className="mx-auto flex h-full max-w-7xl items-center px-4 lg:px-8">
        {/* Mobile menu */}
        <div className="lg:hidden mr-3">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button className="p-1">
                <Menu className="h-5 w-5" style={{ color: "var(--storefront-text, #1e293b)" }} />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="storefront-font w-[300px] p-0 border-r-0">
              <div
                className="flex flex-col h-full"
                style={{ backgroundColor: "var(--storefront-bg, #F8FAFC)", color: "var(--storefront-text, #1e293b)" }}
              >
                <div className="border-b p-6" style={{ borderColor: "var(--storefront-text, #1e293b)10" }}>
                  {store.logo_url ? (
                    <img src={store.logo_url} alt={store.name} className="h-8 w-auto max-w-[160px] object-contain" />
                  ) : (
                    <span className="text-lg font-bold" style={{ fontFamily: "var(--storefront-heading-font, 'Poppins')" }}>
                      {store.name}
                    </span>
                  )}
                </div>
                <nav className="flex flex-col gap-0.5 p-4">
                  {[
                    ...navLinks,
                    { to: storefrontPath(store.slug, "wishlist"), label: "Wishlist" },
                    { to: storefrontPath(store.slug, "account"), label: "Account" },
                    { to: storefrontPath(store.slug, "return-policy"), label: "Returns" },
                    { to: storefrontPath(store.slug, "contact"), label: "Contact" },
                  ].map((link) => (
                    <Link
                      key={link.to + link.label}
                      to={link.to}
                      onClick={() => setMenuOpen(false)}
                      className="rounded-xl px-4 py-3 text-sm font-medium transition-colors"
                      style={{ color: "var(--storefront-text, #1e293b)" }}
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
                          className="rounded-xl px-4 py-3 text-sm font-medium transition-colors"
                          style={{ color: "var(--storefront-text, #1e293b)" }}
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
        </div>

        {/* Logo */}
        <Link to={storefrontPath(store.slug)} className="flex-shrink-0">
          {store.logo_url ? (
            <img src={store.logo_url} alt={store.name} className="h-8 w-auto max-w-[140px] object-contain" />
          ) : (
            <span
              className="text-xl font-bold tracking-tight"
              style={{ fontFamily: "var(--storefront-heading-font, 'Poppins')", color: "var(--storefront-text, #1e293b)" }}
            >
              {store.name}
            </span>
          )}
        </Link>

        {/* Center nav (desktop) */}
        <nav className="hidden lg:flex items-center gap-8 mx-auto">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--storefront-text, #1e293b)" }}
            >
              {link.label}
            </Link>
          ))}
          {categories && categories.length > 0 && (
            <div className="relative group">
              <span className="text-sm font-medium cursor-pointer transition-opacity hover:opacity-70" style={{ color: "var(--storefront-text, #1e293b)" }}>
                Categories
              </span>
              <div className="absolute top-full left-0 mt-2 min-w-[180px] rounded-xl border p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-lg"
                style={{ backgroundColor: "var(--storefront-bg, #F8FAFC)", borderColor: "var(--storefront-text, #1e293b)10" }}>
                {categories.map((cat: any) => (
                  <Link
                    key={cat.id}
                    to={storefrontPath(store.slug, `category/${cat.slug}`)}
                    className="block rounded-lg px-3 py-2 text-sm transition-colors hover:opacity-70"
                    style={{ color: "var(--storefront-text, #1e293b)" }}
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </nav>

        <div className="flex-1 lg:hidden" />

        {/* Right icons */}
        <div className="flex items-center gap-3 sm:gap-5">
          <AccountBadgeV6 slug={store.slug} />
          <WishlistBadgeV6 slug={store.slug} />
          <CartBadgeV6 />
          <ShareStoreDialog storeSlug={store.slug} storeName={store.name} iconOnly />
        </div>
      </div>
    </header>
  );
}

/* ── Clean Footer ── */
function CleanFooter({ store }: { store: StoreData }) {
  const year = new Date().getFullYear();
  return (
    <footer
      className="border-t mt-20"
      style={{
        backgroundColor: "var(--storefront-accent, #1e293b)",
        color: "var(--storefront-bg, #F8FAFC)",
        borderColor: "transparent",
      }}
    >
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h3 className="text-base font-bold mb-3" style={{ fontFamily: "var(--storefront-heading-font, 'Poppins')" }}>
              {store.name}
            </h3>
            <p className="text-sm opacity-60 leading-relaxed">{store.description || "Premium quality products for modern living."}</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-4 uppercase tracking-wider opacity-70">Shop</h4>
            <div className="flex flex-col gap-2.5">
              {[
                { to: storefrontPath(store.slug), label: "Home" },
                { to: storefrontPath(store.slug, "best-sellers"), label: "Best Sellers" },
              ].map((l) => (
                <Link key={l.label} to={l.to} className="text-sm opacity-50 hover:opacity-80 transition-opacity">{l.label}</Link>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-4 uppercase tracking-wider opacity-70">Support</h4>
            <div className="flex flex-col gap-2.5">
              {[
                { to: storefrontPath(store.slug, "contact"), label: "Contact Us" },
                { to: storefrontPath(store.slug, "return-policy"), label: "Returns" },
                { to: storefrontPath(store.slug, "shipping-policy"), label: "Shipping" },
              ].map((l) => (
                <Link key={l.label} to={l.to} className="text-sm opacity-50 hover:opacity-80 transition-opacity">{l.label}</Link>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-4 uppercase tracking-wider opacity-70">Legal</h4>
            <div className="flex flex-col gap-2.5">
              {[
                { to: storefrontPath(store.slug, "terms"), label: "Terms" },
                { to: storefrontPath(store.slug, "privacy-policy"), label: "Privacy" },
              ].map((l) => (
                <Link key={l.label} to={l.to} className="text-sm opacity-50 hover:opacity-80 transition-opacity">{l.label}</Link>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-12 border-t pt-8 text-center" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <p className="text-xs opacity-40">© {year} {store.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

function StorefrontV6Skeleton() {
  return (
    <div className="min-h-screen bg-background">
      <Skeleton className="h-[72px] w-full" />
      <Skeleton className="h-[500px] w-full mt-1" />
    </div>
  );
}

export default function StorefrontLayoutV6({ slugOverride }: { slugOverride?: string } = {}) {
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

  if (isLoading) return <StorefrontV6Skeleton />;

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

  const primaryColor = themeConfig?.primary_color || "#2563EB";
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
              backgroundColor: "var(--storefront-bg, #F8FAFC)",
              color: "var(--storefront-text, #1e293b)",
              fontFamily: "var(--storefront-body-font, 'Inter')",
            }}
          >
            <CleanHeader store={store} />
            <Outlet context={store} />
            <CleanFooter store={store} />
            <SideCart store={store} />
            <FloatingWhatsApp store={store} />
          </div>
        </StorefrontAuthProvider>
      </WishlistProvider>
    </CartProvider>
  );
}
