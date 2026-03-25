import { useEffect, useRef, Suspense, lazy, type ReactNode } from "react";
import { useStorefront, type StoreData } from "@/layouts/StorefrontLayout.logic";
import { CartProvider } from "@/contexts/CartContext";
import { WishlistProvider } from "@/contexts/WishlistContext";
import { StorefrontAuthProvider } from "@/contexts/StorefrontAuthContext";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { useThemePreview } from "@/hooks/useThemePreview";
import { useMetaTags } from "@/hooks/useMetaTags";
import { useFacebookPixel } from "@/hooks/useFacebookPixel";
import { trackPageView } from "@/lib/trackPageView";
import { buildThemeStyle, loadGoogleFonts } from "@/lib/themeUtils";
import StorefrontNotFound from "@/components/storefront/StorefrontNotFound";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy-load non-critical overlays
const SideCart = lazy(() => import("@/components/storefront/SideCart"));
const FloatingWhatsApp = lazy(() => import("@/components/storefront/FloatingWhatsApp"));
const DynamicPwaManifest = lazy(() => import("@/components/storefront/DynamicPwaManifest"));
const SmartInstallPrompt = lazy(() => import("@/components/SmartInstallPrompt"));
const ExitIntentPopup = lazy(() => import("@/components/storefront/ExitIntentPopup"));

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

/** Default skeleton — shows generic storefront loading state */
function DefaultSkeleton() {
  return (
    <div className="min-h-screen bg-background font-sans">
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
  showExitIntent = false,
  defaultPrimary = "#b8873c",
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
  });

  // Track page view — fire once per store
  useEffect(() => {
    if (!store?.id || viewTracked.current) return;
    viewTracked.current = true;
    trackPageView(store.id);
  }, [store?.id]);

  // Theme config (reactive — updates when cache changes via live preview)
  const themeConfig = useStorefrontThemeConfig(store?.id);

  // Defer Google Fonts loading to idle time so it doesn't block first paint
  useEffect(() => {
    if (!themeConfig) return;
    const schedule =
      typeof requestIdleCallback !== "undefined"
        ? (cb: () => void) => requestIdleCallback(cb, { timeout: 3000 })
        : (cb: () => void) => setTimeout(cb, 1000);
    schedule(() => loadGoogleFonts(themeConfig));
  }, [themeConfig?.heading_font, themeConfig?.body_font]);

  // Listen for live theme preview messages
  const previewOverride = useThemePreview(store?.id);

  // Loading state
  if (isLoading) {
    return <>{skeleton || <DefaultSkeleton />}</>;
  }

  // Not found
  if (!store) {
    return <StorefrontNotFound slug={slug} label={notFoundLabel} />;
  }

  // Build theme style
  const { themeStyle, primaryColor, btnTextColor } = buildThemeStyle(
    themeConfig,
    previewOverride,
    defaultPrimary,
    defaultButtonRadius
  );

  const mergedStyle: React.CSSProperties = {
    ...themeStyle,
    backgroundColor: "var(--storefront-bg, hsl(var(--background)))",
    color: "var(--storefront-text, hsl(var(--foreground)))",
    ...wrapperStyle,
  };

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
      <Suspense fallback={null}>
        <DynamicPwaManifest storeName={store.name} logoUrl={store.logo_url} themeColor={primaryColor} />
        <SmartInstallPrompt appName={store.name} primaryColor={primaryColor} textColor={btnTextColor} />
      </Suspense>
      {showSideCart && (
        <Suspense fallback={null}>
          <SideCart store={store} />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <FloatingWhatsApp store={store} />
      </Suspense>
      {showExitIntent && (
        <Suspense fallback={null}>
          <ExitIntentPopup storeId={store.id} storeName={store.name} />
        </Suspense>
      )}
    </div>
  );

  // Wrap with providers
  if (showWishlist) {
    return (
      <CartProvider slug={store.slug}>
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
    <CartProvider slug={store.slug}>
      <StorefrontAuthProvider storeId={store.id}>
        {content}
      </StorefrontAuthProvider>
    </CartProvider>
  );
}
