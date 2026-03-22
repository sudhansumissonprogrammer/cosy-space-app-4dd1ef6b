import { useState, useEffect, useRef, Suspense } from "react";
import { useThemePreview } from "@/hooks/useThemePreview";
import { Link, Outlet, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { Store, ShoppingCart, Heart, User, Menu, X } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useStorefront, type StoreData } from "@/layouts/StorefrontLayout";
import { CartProvider, useCart } from "@/contexts/CartContext";
import { WishlistProvider, useWishlist } from "@/contexts/WishlistContext";
import { StorefrontAuthProvider, useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import FloatingWhatsApp from "@/components/storefront/FloatingWhatsApp";
import StorefrontInstagramSection from "@/components/storefront/StorefrontInstagramSection";
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

/* ── Cart Badge ── */
function CartBadgeV7() {
  const { cartCount, openCart } = useCart();
  return (
    <button onClick={openCart} className="relative">
      <ShoppingCart className="h-[18px] w-[18px]" style={{ color: "var(--storefront-text, #1a1a1a)" }} />
      {cartCount > 0 && (
        <span
          className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
          style={{ backgroundColor: "var(--storefront-primary, #1a1a1a)", color: "var(--storefront-btn-text, #fff)" }}
        >
          {cartCount}
        </span>
      )}
    </button>
  );
}

function WishlistBadgeV7({ slug }: { slug: string }) {
  const { wishlistCount } = useWishlist();
  return (
    <Link to={storefrontPath(slug, "wishlist")} className="relative">
      <Heart className="h-[18px] w-[18px]" style={{ color: "var(--storefront-text, #1a1a1a)" }} />
      {wishlistCount > 0 && (
        <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
          {wishlistCount}
        </span>
      )}
    </Link>
  );
}

function AccountBadgeV7({ slug }: { slug: string }) {
  const { user, loading } = useStorefrontAuth();
  if (loading) return null;
  return (
    <Link to={storefrontPath(slug, user ? "account" : "login")}>
      <User className="h-[18px] w-[18px]" style={{ color: "var(--storefront-text, #1a1a1a)" }} />
    </Link>
  );
}

/* ── Category Ticker ── */
function CategoryTicker({ store }: { store: StoreData }) {
  const queryClient = useQueryClient();
  const categories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]);

  if (!categories || categories.length === 0) return null;

  const items = categories.map((c) => c.name.toUpperCase());
  const repeated = [...items, ...items];

  return (
    <div
      className="w-full overflow-hidden border-b py-2"
      style={{
        backgroundColor: "var(--storefront-bg, #ffffff)",
        borderColor: "var(--storefront-text, #1a1a1a)08",
      }}
    >
      <div className="flex w-max animate-marquee items-center gap-8">
        {repeated.map((name, i) => (
          <Link
            key={`${name}-${i}`}
            to={storefrontPath(store.slug, `category/${categories[i % categories.length]?.slug || ""}`)}
            className="whitespace-nowrap text-[10px] font-semibold tracking-[0.2em] transition-opacity hover:opacity-60"
            style={{ color: "var(--storefront-text, #1a1a1a)", opacity: 0.5 }}
          >
            {name}
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── Ultra-thin Editorial Header ── */
function EditorialHeader({ store }: { store: StoreData }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const queryClient = useQueryClient();
  const categories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]);

  return (
    <>
      <header
        className="sticky top-0 z-30 border-b"
        style={{
          height: "56px",
          backgroundColor: "var(--storefront-bg, #ffffff)",
          borderColor: "var(--storefront-text, #1a1a1a)10",
        }}
      >
        <div className="mx-auto flex h-full max-w-7xl items-center px-4 lg:px-8">
          {/* Left: Hamburger */}
          <div className="lg:hidden mr-4">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <button className="p-1">
                  <Menu className="h-5 w-5" style={{ color: "var(--storefront-text, #1a1a1a)" }} />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="storefront-font w-[280px] p-0 border-r-0">
                <div
                  className="flex flex-col h-full"
                  style={{ backgroundColor: "var(--storefront-bg, #fff)", color: "var(--storefront-text, #1a1a1a)" }}
                >
                  <div className="border-b p-6" style={{ borderColor: "var(--storefront-text, #1a1a1a)08" }}>
                    <span
                      className="text-lg font-bold tracking-tight uppercase"
                      style={{ fontFamily: "var(--storefront-heading-font, 'Playfair Display')" }}
                    >
                      {store.name}
                    </span>
                  </div>
                  <nav className="flex flex-col p-4">
                    {[
                      { to: storefrontPath(store.slug), label: "Home" },
                      { to: storefrontPath(store.slug, "best-sellers"), label: "Collection" },
                      { to: storefrontPath(store.slug, "contact"), label: "Contact" },
                      { to: storefrontPath(store.slug, "wishlist"), label: "Wishlist" },
                      { to: storefrontPath(store.slug, "account"), label: "Account" },
                    ].map((link) => (
                      <Link
                        key={link.label}
                        to={link.to}
                        onClick={() => setMenuOpen(false)}
                        className="py-3 text-sm font-medium tracking-wide uppercase opacity-70 transition-opacity hover:opacity-100"
                      >
                        {link.label}
                      </Link>
                    ))}
                    {categories && categories.length > 0 && (
                      <>
                        <div className="mt-4 mb-2 text-[9px] font-bold tracking-[0.25em] uppercase opacity-30">Categories</div>
                        {categories.map((cat: any) => (
                          <Link
                            key={cat.id}
                            to={storefrontPath(store.slug, `category/${cat.slug}`)}
                            onClick={() => setMenuOpen(false)}
                            className="py-2.5 text-sm opacity-60 transition-opacity hover:opacity-100"
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

          {/* Desktop left nav */}
          <nav className="hidden lg:flex items-center gap-8 mr-auto">
            {[
              { to: storefrontPath(store.slug, "best-sellers"), label: "Collection" },
              { to: storefrontPath(store.slug, "contact"), label: "About" },
            ].map((link) => (
              <Link
                key={link.label}
                to={link.to}
                className="text-[11px] font-semibold tracking-[0.15em] uppercase transition-opacity hover:opacity-60"
                style={{ color: "var(--storefront-text, #1a1a1a)", opacity: 0.6 }}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Center: Logo/Name */}
          <Link
            to={storefrontPath(store.slug)}
            className="absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0 lg:mx-auto"
          >
            {store.logo_url ? (
              <img src={store.logo_url} alt={store.name} className="h-7 w-auto max-w-[130px] object-contain" />
            ) : (
              <span
                className="text-xl font-bold tracking-[0.05em] uppercase"
                style={{
                  fontFamily: "var(--storefront-heading-font, 'Playfair Display')",
                  color: "var(--storefront-text, #1a1a1a)",
                }}
              >
                {store.name}
              </span>
            )}
          </Link>

          {/* Right icons */}
          <div className="flex items-center gap-4 ml-auto">
            <AccountBadgeV7 slug={store.slug} />
            <WishlistBadgeV7 slug={store.slug} />
            <CartBadgeV7 />
            <ShareStoreDialog storeSlug={store.slug} storeName={store.name} iconOnly />
          </div>
        </div>
      </header>

      {/* Category Ticker */}
      <CategoryTicker store={store} />
    </>
  );
}

/* ── Editorial Footer ── */
function EditorialFooter({ store }: { store: StoreData }) {
  const year = new Date().getFullYear();

  return (
    <footer
      className="border-t mt-0"
      style={{
        backgroundColor: "var(--storefront-accent, #1a1a1a)",
        color: "var(--storefront-bg, #ffffff)",
        borderColor: "transparent",
      }}
    >
      <div className="mx-auto max-w-7xl px-4 py-12 sm:py-16 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
          {/* Left: Brand */}
          <div>
            <h3
              className="text-2xl font-bold tracking-[0.05em] uppercase mb-4"
              style={{ fontFamily: "var(--storefront-heading-font, 'Playfair Display')" }}
            >
              {store.name}
            </h3>
            <p className="text-sm leading-relaxed opacity-50 max-w-md">
              {store.description || "Curated products with editorial excellence. Every piece tells a story."}
            </p>
          </div>

          {/* Right: Links */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h4 className="text-[10px] font-bold tracking-[0.25em] uppercase opacity-40 mb-4">Navigate</h4>
              <div className="flex flex-col gap-2.5">
                {[
                  { to: storefrontPath(store.slug), label: "Home" },
                  { to: storefrontPath(store.slug, "best-sellers"), label: "Collection" },
                  { to: storefrontPath(store.slug, "contact"), label: "Contact" },
                ].map((l) => (
                  <Link key={l.label} to={l.to} className="text-sm opacity-50 hover:opacity-80 transition-opacity">
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-[10px] font-bold tracking-[0.25em] uppercase opacity-40 mb-4">Legal</h4>
              <div className="flex flex-col gap-2.5">
                {[
                  { to: storefrontPath(store.slug, "return-policy"), label: "Returns" },
                  { to: storefrontPath(store.slug, "shipping-policy"), label: "Shipping" },
                  { to: storefrontPath(store.slug, "terms"), label: "Terms" },
                  { to: storefrontPath(store.slug, "privacy-policy"), label: "Privacy" },
                ].map((l) => (
                  <Link key={l.label} to={l.to} className="text-sm opacity-50 hover:opacity-80 transition-opacity">
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t pt-8 text-center" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <p className="text-xs opacity-30">© {year} {store.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

function StorefrontV7Skeleton() {
  return (
    <div className="min-h-screen bg-background">
      <Skeleton className="h-[56px] w-full" />
      <Skeleton className="h-[32px] w-full" />
      <Skeleton className="h-[500px] w-full mt-1" />
    </div>
  );
}

export default function StorefrontLayoutV7({ slugOverride }: { slugOverride?: string } = {}) {
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

  if (isLoading) return <StorefrontV7Skeleton />;

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

  const primaryColor = themeConfig?.primary_color || "#1a1a1a";
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
            className="storefront-font min-h-screen"
            style={{
              ...themeStyle,
              backgroundColor: "var(--storefront-bg, #ffffff)",
              color: "var(--storefront-text, #1a1a1a)",
              fontFamily: "var(--storefront-body-font, 'Inter')",
            }}
          >
            <EditorialHeader store={store} />
            <DynamicPwaManifest storeName={store.name} logoUrl={store.logo_url} themeColor={primaryColor} />
            <SmartInstallPrompt appName={store.name} primaryColor={primaryColor} textColor={btnTextColor} />
            <main><Suspense fallback={<StorefrontContentSkeleton />}><Outlet context={store} /></Suspense></main>
            
            <EditorialFooter store={store} />
            <SideCart store={store} />
            <FloatingWhatsApp store={store} />
          </div>
        </StorefrontAuthProvider>
      </WishlistProvider>
    </CartProvider>
  );
}
