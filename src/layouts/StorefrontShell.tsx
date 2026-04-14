import { useEffect, useRef, useMemo, useState, useLayoutEffect, Suspense, lazy, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useStorefront, type StoreData } from "@/layouts/StorefrontLayout.logic";
import { CartProvider } from "@/contexts/CartContext";
import { WishlistProvider } from "@/contexts/WishlistContext";
import { StorefrontAuthProvider } from "@/contexts/StorefrontAuthContext";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { useThemePreview } from "@/hooks/useThemePreview";
import { useMetaTags } from "@/hooks/useMetaTags";
import { useFacebookPixel } from "@/hooks/useFacebookPixel";
import { trackPageView } from "@/lib/trackPageView";
import { buildThemeStyle, ensureThemeFontsLoaded, loadGoogleFonts } from "@/lib/themeUtils";
import StorefrontNotFound from "@/components/storefront/StorefrontNotFound";

// Lazy-load non-critical overlays
const SideCart = lazy(() => import("@/components/storefront/SideCart"));
const FloatingWhatsApp = lazy(() => import("@/components/storefront/FloatingWhatsApp"));
const DynamicPwaManifest = lazy(() => import("@/components/storefront/DynamicPwaManifest"));
const SmartInstallPrompt = lazy(() => import("@/components/SmartInstallPrompt"));
const ExitIntentPopup = lazy(() => import("@/components/storefront/ExitIntentPopup"));
const BackToTop = lazy(() => import("@/components/storefront/BackToTop"));

/** Defers ExitIntentPopup mounting by 5 seconds to keep initial load fast */
function DeferredExitIntent({ storeId, storeName }: { storeId: string; storeName: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 5000);
    return () => clearTimeout(timer);
  }, []);
  if (!show) return null;
  return (
    <Suspense fallback={null}>
      <ExitIntentPopup storeId={storeId} storeName={storeName} />
    </Suspense>
  );
}

export interface ShellRenderProps {
  store: StoreData;
  slug: string;
  themeConfig: Record<string, any> | null;
  primaryColor: string;
  btnTextColor: string;
}

interface StorefrontShellProps {
  slugOverride?: string;
  /** Set false for themes that don't use WishlistProvider (e.g. V13 restaurant) */
  showWishlist?: boolean;
  /** Set false for themes that render their own cart (e.g. V13 WhatsApp order) */
  showSideCart?: boolean;
  /** Set false to hide floating WhatsApp icon (e.g. Theme 18) */
  showWhatsApp?: boolean;
  /** Show ExitIntentPopup — only theme-1 uses this */
  showExitIntent?: boolean;
  /** Default primary color if no theme config */
  defaultPrimary?: string;
  /** Default button radius if no theme config */
  defaultButtonRadius?: string;
  /** Additional CSS properties to merge into the wrapper */
  wrapperStyle?: React.CSSProperties;
  /** Additional className for the wrapper div */
  wrapperClassName?: string;
  /** Label for not-found page (e.g. "Restaurant" for V13) */
  notFoundLabel?: string;
  /** Custom skeleton component */
  skeleton?: ReactNode;
  children: (props: ShellRenderProps) => ReactNode;
}

/** Minimal fallback skeleton for preview/localhost (Worker provides the real one) */
function DefaultSkeleton() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <nav className="sticky top-0 z-30 border-b bg-card/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <div className="h-10 w-10 rounded-lg bg-muted/60" />
          <div className="h-10 w-24 rounded-lg bg-muted/60" />
          <div className="flex-1" />
          <div className="h-9 w-9 rounded-full bg-muted/60" />
        </div>
      </nav>
    </div>
  );
}

/**
 * StorefrontShell — centralizes ALL shared storefront logic:
 * - Data loading (useStorefront)
 * - Loading / not-found states
 * - Provider wrapping (Cart, Wishlist, Auth)
 * - Theme CSS variable computation
 * - Google Fonts loading
 * - Analytics (Facebook Pixel, page view tracking, meta tags)
 * - Live theme preview (useThemePreview)
 * - Lazy overlays (SideCart, FloatingWhatsApp, DynamicPwaManifest, SmartInstallPrompt, ExitIntentPopup)
 *
 * Themes only render their unique header/nav via children render prop.
 */
export default function StorefrontShell({
  slugOverride,
  showWishlist = true,
  showSideCart = true,
  showWhatsApp = true,
  showExitIntent = false,
  defaultPrimary = "#004643",
  defaultButtonRadius = "0.5rem",
  wrapperStyle,
  wrapperClassName = "storefront-font min-h-screen font-sans",
  notFoundLabel = "Store",
  skeleton,
  children,
}: StorefrontShellProps) {
  const { store, isLoading, slug } = useStorefront(slugOverride);
  const viewTracked = useRef(false);

  // Analytics hooks — safe to call even when store is null
  useFacebookPixel((store as any)?.facebook_pixel_id);

  useMetaTags({
    title: (store as any)?.meta_title || (store ? `${store.name} — ${notFoundLabel}` : undefined),
    description: (store as any)?.meta_description || store?.description || undefined,
    ogImage: (store as any)?.og_image_url || store?.logo_url || undefined,
    storeSlug: store?.slug,
    customDomain: (store as any)?.custom_domain,
  });

  // Track page view — deferred to idle time to avoid blocking LCP
  useEffect(() => {
    if (!store?.id || viewTracked.current) return;
    viewTracked.current = true;
    const schedule =
      typeof requestIdleCallback !== "undefined"
        ? (cb: () => void) => requestIdleCallback(cb, { timeout: 5000 })
        : (cb: () => void) => setTimeout(cb, 2000);
    schedule(() => trackPageView(store.id));
  }, [store?.id]);

  // Theme config (reactive — updates when cache changes via live preview)
  const themeConfig = useStorefrontThemeConfig(store?.id);

  // Hold the first storefront paint until the selected theme fonts are ready.
  const fontsLoadedRef = useRef(false);
  const activeStoreIdRef = useRef<string | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  useLayoutEffect(() => {
    const storeId = store?.id ?? null;

    if (activeStoreIdRef.current !== storeId) {
      activeStoreIdRef.current = storeId;
      fontsLoadedRef.current = false;
      setFontsReady(false);
    }

    if (!storeId) return;

    let cancelled = false;

    const syncFonts = async () => {
      if (!fontsLoadedRef.current) {
        setFontsReady(false);
        await ensureThemeFontsLoaded(themeConfig, 1800);
        if (cancelled) return;
        fontsLoadedRef.current = true;
        setFontsReady(true);
        return;
      }

      loadGoogleFonts(themeConfig);
      if (!cancelled) setFontsReady(true);
    };

    void syncFonts();

    return () => {
      cancelled = true;
    };
  }, [store?.id, themeConfig?.heading_font, themeConfig?.body_font]);

  // Listen for live theme preview messages
  const previewOverride = useThemePreview(store?.id);

  // Scroll to top on every route change — centralised fix for all mobile navbars
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  // Build theme style before early returns so hooks stay in stable order
  const { themeStyle, primaryColor, btnTextColor } = buildThemeStyle(
    themeConfig,
    previewOverride,
    defaultPrimary,
    defaultButtonRadius
  );

  const mergedStyle: React.CSSProperties = {
    ...themeStyle,
    fontFamily: "var(--storefront-body-font, 'Inter'), system-ui, sans-serif",
    backgroundColor: "var(--storefront-bg, hsl(var(--background)))",
    color: "var(--storefront-text, hsl(var(--foreground)))",
    ...wrapperStyle,
  };

  // Sync theme CSS vars to document.body so portal-rendered components (Sheet, Dialog) inherit them
  const appliedVarsRef = useRef<string[]>([]);
  const themeVarsKey = useMemo(() => JSON.stringify(themeStyle), [themeStyle]);
  useEffect(() => {
    // Clean up previous vars first
    appliedVarsRef.current.forEach((key) => {
      document.body.style.removeProperty(key);
    });

    const newVars = Object.entries(themeStyle).filter(
      ([key, value]) => key.startsWith("--") && typeof value === "string"
    ) as Array<[string, string]>;

    newVars.forEach(([key, value]) => {
      document.body.style.setProperty(key, value);
    });
    appliedVarsRef.current = newVars.map(([k]) => k);

    return () => {
      appliedVarsRef.current.forEach((key) => {
        document.body.style.removeProperty(key);
      });
      appliedVarsRef.current = [];
    };
  }, [themeVarsKey]);

  // Keep the Worker skeleton visible until store data and the first font pass are ready.
  if (isLoading || !fontsReady) {
    return <div className="min-h-screen" />;
  }

  // Not found
  if (!store) {
    return <StorefrontNotFound slug={slug} label={notFoundLabel} />;
  }

  const renderProps: ShellRenderProps = {
    store,
    slug: slug!,
    themeConfig,
    primaryColor,
    btnTextColor,
  };

  // Build provider tree — conditionally include WishlistProvider
  const content = (
    <div className={wrapperClassName} style={mergedStyle}>
      {children(renderProps)}

      {/* Lazy overlays — shared across all themes */}
      {/* PWA install prompts temporarily disabled */}
      {/*
      <Suspense fallback={null}>
        <DynamicPwaManifest storeName={store.name} logoUrl={store.logo_url} themeColor={primaryColor} />
        <SmartInstallPrompt appName={store.name} primaryColor={primaryColor} textColor={btnTextColor} />
      </Suspense>
      */}
      {showSideCart && (
        <Suspense fallback={null}>
          <SideCart store={store} />
        </Suspense>
      )}
      {showWhatsApp && (
        <Suspense fallback={null}>
          <FloatingWhatsApp store={store} />
        </Suspense>
      )}
      {showExitIntent && <DeferredExitIntent storeId={store.id} storeName={store.name} />}
      <Suspense fallback={null}>
        <BackToTop />
      </Suspense>
    </div>
  );

  // Wrap with providers
  if (showWishlist) {
    return (
      <CartProvider slug={store.slug} storeId={store.id} currency={store.currency || "INR"}>
        <WishlistProvider slug={store.slug}>
          <StorefrontAuthProvider storeId={store.id}>
            {content}
          </StorefrontAuthProvider>
        </WishlistProvider>
      </CartProvider>
    );
  }

  // V13 restaurant mode — no wishlist
  return (
    <CartProvider slug={store.slug} storeId={store.id} currency={store.currency || "INR"}>
      <StorefrontAuthProvider storeId={store.id}>
        {content}
      </StorefrontAuthProvider>
    </CartProvider>
  );
}
