import { useState, Suspense, lazy } from "react";
import { useParams, Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Store, ShoppingCart, Home, Tag, Mail, Heart, RotateCcw, User, ArrowLeft, X } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import ShareStoreDialog from "@/components/ShareStoreDialog";
import { useMetaTags } from "@/hooks/useMetaTags";
import { CartProvider, useCart } from "@/contexts/CartContext";
import { WishlistProvider, useWishlist } from "@/contexts/WishlistContext";
import { StorefrontAuthProvider, useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import StorefrontMarquee from "@/components/storefront/StorefrontMarquee";
import StorefrontFooter from "@/components/storefront/StorefrontFooter";
import FloatingWhatsApp from "@/components/storefront/FloatingWhatsApp";
import { useFacebookPixel } from "@/hooks/useFacebookPixel";
import SideCart from "@/components/storefront/SideCart";
import { trackPageView } from "@/lib/trackPageView";

// Lazy-load non-critical components to reduce initial JS parse time
const SmartInstallPrompt = lazy(() => import("@/components/SmartInstallPrompt"));
const DynamicPwaManifest = lazy(() => import("@/components/storefront/DynamicPwaManifest"));
const ExitIntentPopup = lazy(() => import("@/components/storefront/ExitIntentPopup"));
import { Skeleton } from "@/components/ui/skeleton";
import { StorefrontContentSkeleton } from "@/components/ContentSkeleton";
import { storefrontPath } from "@/lib/subdomain";
import { useEffect, useRef } from "react";
import { useThemePreview } from "@/hooks/useThemePreview";
import { prefetchStorefrontRoutes } from "@/lib/prefetchStorefrontRoutes";

export type StoreData = Tables<"stores">;

/**
 * Single RPC call fetches store + products + categories in one roundtrip.
 * Individual caches are seeded immediately so child pages render instantly.
 */
/** Save storefront data to localStorage for instant future loads */
function cacheToLocalStorage(slug: string, result: any) {
  try {
    const store = result?.store;
    if (!store) return;
    // Cache theme separately for instant theme detection in App.tsx
    localStorage.setItem(`storefront_theme_${slug}`, store.theme || "theme-1");
    // Cache full data (compact — only essential fields) for SWR
    const compact = {
      store: result.store,
      products: (result.products || []).slice(0, 20), // first 20 for instant paint
      categories: result.categories || [],
      theme_config: result.theme_config || null,
      total_products: result.total_products || 0,
      _cachedAt: Date.now(),
    };
    localStorage.setItem(`storefront_data_${slug}`, JSON.stringify(compact));
  } catch {}
}

/** Read cached storefront data from localStorage (< 10 min old) */
function readLocalStorageCache(slug: string): any | null {
  try {
    const raw = localStorage.getItem(`storefront_data_${slug}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Accept cache up to 10 minutes old
    if (parsed._cachedAt && Date.now() - parsed._cachedAt < 10 * 60 * 1000) {
      return parsed;
    }
    localStorage.removeItem(`storefront_data_${slug}`);
  } catch {}
  return null;
}

export function useStorefront(slugOverride?: string) {
  const { slug: paramSlug } = useParams<{ slug: string }>();
  const slug = slugOverride || paramSlug;
  const queryClient = useQueryClient();

  // Consume injected data (from Cloudflare Worker OR main.tsx prefetch) as initialData
  // This is synchronous — no loading state, no skeleton flash
  const injectedRef = useRef<any>(null);
  if (!injectedRef.current && slug) {
    const injected = (window as any).__STOREFRONT_DATA__;
    if (injected?.store) {
      injectedRef.current = injected;
      delete (window as any).__STOREFRONT_DATA__;
      const store = injected.store as StoreData;
      queryClient.setQueryData(["storefront", slug], store);
      queryClient.setQueryData(["storefront-products", store.id], injected.products || []);
      queryClient.setQueryData(["storefront-categories", store.id], injected.categories || []);
      queryClient.setQueryData(["storefront-total-products", store.id], injected.total_products || 0);
      if (injected.theme_config) {
        queryClient.setQueryData(["storefront-theme-config", store.id], injected.theme_config);
      }
      try { localStorage.setItem(`store_id_${slug}`, store.id); } catch {}
      cacheToLocalStorage(slug!, injected);
    }
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ["storefront-bulk", slug],
    queryFn: async () => {
      // Fetch from API (fallback — only runs if no injected/cached data)
      const { data, error } = await supabase.rpc("get_storefront_data", { _slug: slug!, _product_limit: 20 });
      if (error) throw error;
      const result = data as any;
      const store = result?.store as StoreData | null;
      if (store) {
        queryClient.setQueryData(["storefront", slug], store);
        queryClient.setQueryData(["storefront-products", store.id], result.products || []);
        queryClient.setQueryData(["storefront-categories", store.id], result.categories || []);
        queryClient.setQueryData(["storefront-total-products", store.id], result.total_products || 0);
        if (result.theme_config) {
          queryClient.setQueryData(["storefront-theme-config", store.id], result.theme_config);
        }
        try { localStorage.setItem(`store_id_${slug}`, store.id); } catch {}
        cacheToLocalStorage(slug!, result);
      }
      return result;
    },
    // Use injected data or localStorage cache as initialData for instant render
    initialData: () => {
      if (!slug) return undefined;
      // Check injected data (set by main.tsx from prefetch or Cloudflare Worker)
      if (injectedRef.current) {
        return injectedRef.current;
      }
      // Check localStorage cache
      const cached = readLocalStorageCache(slug);
      if (cached) {
        const store = cached.store;
        if (store) {
          queryClient.setQueryData(["storefront", slug], store);
          queryClient.setQueryData(["storefront-products", store.id], cached.products || []);
          queryClient.setQueryData(["storefront-categories", store.id], cached.categories || []);
          queryClient.setQueryData(["storefront-total-products", store.id], cached.total_products || 0);
          if (cached.theme_config) {
            queryClient.setQueryData(["storefront-theme-config", store.id], cached.theme_config);
          }
        }
        return cached;
      }
      return undefined;
    },
    // Always treat cached/injected data as stale so a background refetch happens
    initialDataUpdatedAt: 1,
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const store = data?.store as StoreData | null ?? null;
  return { store, isLoading: isLoading && !data, error, slug };
}

function CartBadge() {
  const { cartCount, openCart } = useCart();
  return (
    <button onClick={openCart} className="relative" aria-label={`Shopping cart${cartCount > 0 ? `, ${cartCount} items` : ''}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-accent transition-colors">
        <ShoppingCart className="h-5 w-5" aria-hidden="true" />
      </div>
      {cartCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--foreground)))", color: "var(--storefront-btn-text, hsl(var(--background)))" }} aria-hidden="true">
          {cartCount > 99 ? "99+" : cartCount}
        </span>
      )}
    </button>
  );
}

function WishlistBadge({ slug }: { slug: string }) {
  const { wishlistCount } = useWishlist();
  return (
    <Link to={storefrontPath(slug, "wishlist")} className="relative" aria-label={`Wishlist${wishlistCount > 0 ? `, ${wishlistCount} items` : ''}`}>
      <Button variant="ghost" size="icon" className="h-9 w-9" aria-hidden="true" tabIndex={-1}>
        <Heart className="h-5 w-5" />
      </Button>
      {wishlistCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground" aria-hidden="true">
          {wishlistCount > 99 ? "99+" : wishlistCount}
        </span>
      )}
    </Link>
  );
}

function AccountBadge({ slug }: { slug: string }) {
  const { user, loading } = useStorefrontAuth();
  if (loading) return null;
  return (
    <Link to={storefrontPath(slug, user ? "account" : "login")} aria-label={user ? "My account" : "Login"}>
      <Button variant="ghost" size="icon" className="h-9 w-9" aria-hidden="true" tabIndex={-1}>
        <User className="h-5 w-5" />
      </Button>
    </Link>
  );
}

function HamburgerMenu({ store }: { store: StoreData }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  // Read from pre-seeded cache — no extra fetch
  const categories = queryClient.getQueryData<any[]>(["storefront-categories", store.id]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10 p-0" aria-label="Open menu">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--foreground))" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="6" y1="7" x2="18" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="6" y1="17" x2="18" y2="17" />
          </svg>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="storefront-font w-[280px] p-0">
        <div className="flex flex-col">
          <div className="border-b bg-card p-4">
            {store.logo_url ? (
              <img src={store.logo_url} alt={store.name} width={160} height={40} className="h-10 w-auto max-w-[160px] object-contain" loading="eager" />
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                  <Store className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="text-lg font-bold text-foreground">{store.name}</span>
              </div>
            )}
          </div>
          <nav className="flex flex-col gap-1 p-4">
            <Link
              to={storefrontPath(store.slug)}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Home className="h-4 w-4" />
              Home
            </Link>
            <Link
              to={storefrontPath(store.slug, "account")}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <User className="h-4 w-4" />
              My Account
            </Link>
            <Link
              to={storefrontPath(store.slug, "wishlist")}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Heart className="h-4 w-4" />
              Wishlist
            </Link>
            <Link
              to={storefrontPath(store.slug, "contact")}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Mail className="h-4 w-4" />
              Contact Us
            </Link>
            <Link
              to={storefrontPath(store.slug, "return-policy")}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <RotateCcw className="h-4 w-4" />
              Return, Refund & Cancellation
            </Link>
            {categories && categories.length > 0 && (
              <>
                <div className="mt-3 mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Categories
                </div>
                {categories.map((cat: any) => (
                  <Link
                    key={cat.id}
                    to={storefrontPath(store.slug, `category/${cat.slug}`)}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    <Tag className="h-4 w-4" />
                    {cat.name}
                  </Link>
                ))}
              </>
            )}
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Skeleton shell shown instantly while store data loads */
function StorefrontSkeleton() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <div className="h-8 bg-muted/50" />
      <nav className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
          <div className="flex-1" />
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </nav>
      <div className="border-b bg-card px-4 py-3">
        <div className="mx-auto max-w-6xl">
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>
      <div className="border-b bg-card px-4 py-3">
        <div className="mx-auto flex max-w-6xl gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-20 flex-shrink-0 rounded-full" />
          ))}
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Skeleton className="mb-5 h-7 w-40" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
              <Skeleton className="w-full" style={{ aspectRatio: "4/5" }} />
              <div className="px-2.5 pb-2.5 pt-2 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function StorefrontLayout({ slugOverride }: { slugOverride?: string } = {}) {
  const { store, isLoading, slug } = useStorefront(slugOverride);
  const viewTracked = useRef(false);
  const queryClient = useQueryClient();

  // Prefetch storefront route chunks during idle time
  useEffect(() => { prefetchStorefrontRoutes(); }, []);

  useFacebookPixel((store as any)?.facebook_pixel_id);

  useMetaTags({
    title: (store as any)?.meta_title || (store ? `${store.name} — Store` : undefined),
    description: (store as any)?.meta_description || store?.description || undefined,
    ogImage: (store as any)?.og_image_url || store?.logo_url || undefined,
    storeSlug: store?.slug,
  });

  // Track page view — fire once
  useEffect(() => {
    if (!store?.id || viewTracked.current) return;
    viewTracked.current = true;
    trackPageView(store.id);
  }, [store?.id]);

  const themeConfig = useStorefrontThemeConfig(store?.id);

  // Load Google Font dynamically
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

  // Listen for live theme preview messages from admin dashboard iframe parent
  const previewOverride = useThemePreview(store?.id);

  if (isLoading) {
    return <StorefrontSkeleton />;
  }

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

  // Compute a lighter tint of the primary color for gradients
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

  // Build CSS variable style object from theme config
  const themeStyle: React.CSSProperties = (previewOverride || (themeConfig
    ? {
        "--storefront-primary": themeConfig.primary_color,
        "--storefront-primary-light": primaryLight,
        "--storefront-accent": themeConfig.accent_color,
        "--storefront-text": themeConfig.text_color,
        "--storefront-bg": themeConfig.background_color,
        "--storefront-heading-font": `'${themeConfig.heading_font}'`,
        "--storefront-body-font": `'${themeConfig.body_font}'`,
        "--storefront-button-radius":
          themeConfig.button_style === "pill" ? "9999px" : themeConfig.button_style === "square" ? "0px" : "0.5rem",
        "--storefront-marquee-gradient": themeConfig.marquee_gradient,
        "--storefront-btn-text": btnTextColor,
      }
    : {})) as any;

  return (
    <CartProvider slug={store.slug}>
      <WishlistProvider slug={store.slug}>
        <StorefrontAuthProvider storeId={store.id}>
          <CheckoutAwareLayout store={store} themeStyle={themeStyle} primaryColor={primaryColor} btnTextColor={btnTextColor} marqueeText={themeConfig?.marquee_text} marqueeEnabled={themeConfig?.marquee_enabled ?? true} />
        </StorefrontAuthProvider>
      </WishlistProvider>
    </CartProvider>
  );
}

function CheckoutAwareLayout({ store, themeStyle, primaryColor, btnTextColor, marqueeText, marqueeEnabled }: { store: StoreData; themeStyle: React.CSSProperties; primaryColor: string; btnTextColor: string; marqueeText?: string; marqueeEnabled?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isCheckout = location.pathname.includes("/checkout");
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  useEffect(() => {
    const handler = () => setOrderPlaced(true);
    window.addEventListener("order-placed", handler);
    return () => window.removeEventListener("order-placed", handler);
  }, []);

  // Reset orderPlaced when leaving checkout
  useEffect(() => {
    if (!isCheckout) setOrderPlaced(false);
  }, [isCheckout]);

  const handleBackClick = () => {
    if (orderPlaced) {
      navigate(storefrontPath(store.slug));
      return;
    }
    setShowExitDialog(true);
  };

  const handleExitConfirm = () => {
    setShowExitDialog(false);
    navigate(storefrontPath(store.slug, "cart"));
  };

  return (
    <div className="storefront-font min-h-screen font-sans" style={{ ...themeStyle, backgroundColor: "var(--storefront-bg, hsl(var(--background)))", color: "var(--storefront-text, hsl(var(--foreground)))" }}>
      {marqueeEnabled !== false && <StorefrontMarquee text={marqueeText} />}
      
      <nav className="sticky top-0 z-30 bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-1.5 sm:gap-3 px-2 sm:px-4">
          {isCheckout ? (
            <Button variant="ghost" size="icon" className="h-10 w-10 p-0" onClick={handleBackClick} aria-label="Go back">
              <ArrowLeft className="h-5 w-5 text-foreground" strokeWidth={2.5} aria-hidden="true" />
            </Button>
          ) : (
            <HamburgerMenu store={store} />
          )}
          <Link to={storefrontPath(store.slug)} className="flex-shrink-0 min-w-0" aria-label={`${store.name} home`}>
            {store.logo_url ? (
              <img src={store.logo_url} alt={store.name} width={160} height={48} className="h-10 sm:h-12 w-auto max-w-[120px] sm:max-w-[160px] object-contain" loading="eager" decoding="sync" fetchPriority="high" />
            ) : (
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary">
                <Store className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" aria-hidden="true" />
              </div>
            )}
          </Link>
          {isCheckout && (
            <span className="text-sm font-semibold text-foreground" style={{ fontFamily: "'Montserrat', sans-serif" }}>Checkout</span>
          )}
          <div className="flex-1" />
          {!isCheckout && (
            <div className="flex items-center gap-0 sm:gap-1">
              <AccountBadge slug={store.slug} />
              <WishlistBadge slug={store.slug} />
              <CartBadge />
              <ShareStoreDialog storeSlug={store.slug} storeName={store.name} iconOnly />
            </div>
          )}
        </div>
      </nav>

      <Suspense fallback={null}>
        <DynamicPwaManifest storeName={store.name} logoUrl={store.logo_url} themeColor={primaryColor} />
        <SmartInstallPrompt appName={store.name} primaryColor={primaryColor} textColor={btnTextColor} />
      </Suspense>
      <main>
        <Suspense fallback={<StorefrontContentSkeleton />}>
          <Outlet context={store} />
        </Suspense>
      </main>
      
      <StorefrontFooter store={store} />
      <SideCart store={store} />
      <FloatingWhatsApp store={store} />
      <Suspense fallback={null}>
        <ExitIntentPopup storeId={store.id} storeName={store.name} />
      </Suspense>

      {/* Exit Checkout Confirmation Dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent className="max-w-[320px] rounded-2xl p-0 overflow-hidden">
          <button
            onClick={() => setShowExitDialog(false)}
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-accent/80 text-muted-foreground hover:text-foreground hover:scale-110 active:scale-95 transition-all"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          </button>
          <div className="p-6 pt-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
              <ArrowLeft className="h-5 w-5 text-warning" />
            </div>
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base font-bold text-foreground">Exit checkout?</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Are you sure you want to leave? Your order details won't be saved.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-5 flex flex-col gap-2">
              <Button
                variant="outline"
                className="w-full border-destructive/30 text-destructive hover:bg-destructive/5 font-semibold text-xs"
                onClick={handleExitConfirm}
              >
                Yes, exit checkout
              </Button>
              <Button
                className="w-full font-semibold text-xs"
                onClick={() => setShowExitDialog(false)}
              >
                No, continue checkout
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}