import { useEffect, useRef, useMemo, useState, Suspense, lazy, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useStorefront, type StoreData } from "@/layouts/StorefrontLayout.logic";
import { CartProvider } from "@/contexts/CartContext";
import { WishlistProvider } from "@/contexts/WishlistContext";
import { StorefrontAuthProvider } from "@/contexts/StorefrontAuthContext";
import StorefrontAutoLogin from "@/components/storefront/StorefrontAutoLogin";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { useThemePreview } from "@/hooks/useThemePreview";
import { useMetaTags } from "@/hooks/useMetaTags";
import { generateEventId, useFacebookPixel } from "@/hooks/useFacebookPixel";
import { ensureFbcPersisted, getOrCreateSfVid } from "@/lib/metaEnrichment";
import { useGA4 } from "@/hooks/useGA4";
import { usePageviewBeacon } from "@/hooks/usePageviewBeacon";
import { useScrollRestoration } from "@/hooks/useScrollRestoration";

import { buildThemeStyle, loadGoogleFonts } from "@/lib/themeUtils";
import StorefrontNotFound from "@/components/storefront/StorefrontNotFound";

// Lazy-load non-critical overlays
const SideCart = lazy(() => import("@/components/storefront/SideCart"));

/**
 * Single-skeleton policy: while React is loading the storefront,
 * we render `null` so the inline skeleton in the DOM stays visible.
 *  - Production: Cloudflare Worker injects #sf-skel before our JS loads
 *  - Preview / localhost: index.html ships an inline skeleton inside #root
 * React-level skeletons are intentionally REMOVED to avoid the
 * "double skeleton" flash and to ship less JS per theme.
 */
const FloatingWhatsApp = lazy(() => import("@/components/storefront/FloatingWhatsApp"));
const DynamicPwaManifest = lazy(() => import("@/components/storefront/DynamicPwaManifest"));
const SmartInstallPrompt = lazy(() => import("@/components/SmartInstallPrompt"));
const ExitIntentPopup = lazy(() => import("@/components/storefront/ExitIntentPopup"));
const BackToTop = lazy(() => import("@/components/storefront/BackToTop"));
const CartPlusOneOverlay = lazy(() => import("@/components/storefront/CartPlusOneOverlay"));

const OrderConfettiOverlay = lazy(() => import("@/components/storefront/OrderConfettiOverlay"));
const StorefrontApps = lazy(() => import("@/components/storefront/apps/StorefrontApps"));

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
  children: (props: ShellRenderProps) => ReactNode;
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
  wrapperClassName = "storefront-font min-h-screen font-sans overflow-x-hidden",
  notFoundLabel = "Store",
  children,
}: StorefrontShellProps) {
  const { store, isLoading, slug, themeConfig: shellThemeConfig } = useStorefront(slugOverride);
  const viewTracked = useRef(false);

  // Analytics hooks — safe to call even when store is null
  useFacebookPixel((store as any)?.facebook_pixel_id, store?.id);

  useMetaTags({
    title: (store as any)?.meta_title || (store ? `${store.name} — ${notFoundLabel}` : undefined),
    description: (store as any)?.meta_description || store?.description || undefined,
    ogImage: (store as any)?.og_image_url || (store as any)?.banner_url || store?.logo_url || undefined,
    storeSlug: store?.slug,
    customDomain: (store as any)?.custom_domain,
  });

  // Page view tracking is now handled server-side by the Cloudflare Worker on
  // the original HTML response. This eliminates ~5,000 frontend ingest
  // requests/day with zero impact on analytics fidelity (the Worker has the
  // same store_id + path information and applies edge-level dedup).

  // Theme config (reactive — updates when cache changes via live preview)
  const themeConfig = useStorefrontThemeConfig(store?.id, shellThemeConfig);

  // Load Google Fonts eagerly but don't block paint — display=swap handles FOUT gracefully.
  useEffect(() => {
    if (!store?.id) return;
    loadGoogleFonts(themeConfig);
  }, [store?.id, themeConfig?.heading_font, themeConfig?.body_font]);

  // Publish the store's "auto-hide header/nav on scroll" preference globally so
  // useSmartChrome can read it without prop-threading through 20 layouts.
  useEffect(() => {
    const on = (themeConfig as any)?.auto_hide_chrome !== false;
    document.documentElement.dataset.autoHideChrome = on ? "1" : "0";
  }, [(themeConfig as any)?.auto_hide_chrome]);


  // Listen for live theme preview messages
  const previewOverride = useThemePreview(store?.id);

  // Fire storefront:content-ready AFTER React has committed and painted the
  // storefront content. Using a post-mount effect + double rAF ensures the
  // browser has actually painted at least one frame of the real storefront
  // before the Worker kills the skeleton. This eliminates the white-blank
  // gap users saw between skeleton fade and product grid paint.
  //
  // BAN-FIX A6: also remove the Worker-injected `#seo-content` block AFTER
  // React commits. That block ships an H1 identical to the React one, so
  // leaving it in the DOM permanently creates a duplicate <h1> which Meta's
  // ad-quality crawler compares against Googlebot's version → cross-crawler
  // divergence → cloaking flag. React-hydrated content is now the sole H1.
  useEffect(() => {
    if (!store?.id) return;
    if ((window as any).__SF_READY_FIRED__) return;
    let cancelled = false;
    requestAnimationFrame(() => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        (window as any).__SF_READY_FIRED__ = true;
        window.dispatchEvent(new Event("storefront:content-ready"));
        try {
          const seo = document.getElementById("seo-content");
          if (seo && seo.parentNode) seo.parentNode.removeChild(seo);
        } catch { /* non-fatal */ }
      });
    });
    return () => { cancelled = true; };
  }, [store?.id]);

  // Hydrogen-style scroll restoration:
  //  - PUSH  → top
  //  - POP   → restore previous scrollY (waits for content height)
  //  - REPLACE → untouched (PDP variant tab switches keep scroll)
  const { pathname } = useLocation();
  useScrollRestoration();

  // SPA route-change PageView for Meta Pixel (Shopify-style).
  // BAN-FIX B7: dedup uses `localStorage` (cross-tab) + a 3s TTL and a
  // `BroadcastChannel` fan-out. Previous sessionStorage impl only deduped
  // within a single tab, so two tabs opened simultaneously (WhatsApp shopper
  // clicks a link twice) fired two initial PageViews per visit → Meta EMQ
  // flagged the pixel as "anomalous dedup ratio".
  useEffect(() => {
    const pixelId = (store as any)?.facebook_pixel_id;
    if (!pixelId) return;
    const storeId = store?.id;
    if (!storeId) return;
    const dedupKey = `__sf_pv_dedup_${storeId}_${pathname}`;
    const now = Date.now();
    let last = 0;
    try {
      const raw = localStorage.getItem(dedupKey);
      if (raw) last = Number(raw) || 0;
    } catch {}
    if (now - last < 3000) return;
    try { localStorage.setItem(dedupKey, String(now)); } catch {}
    try {
      const bc = new BroadcastChannel("sf-pv");
      bc.postMessage({ k: dedupKey, t: now });
      bc.close();
    } catch {}
    // Skip if the inline pixel (index.html) already fired the initial PageView
    // for THIS path — it stamps __SF_PV_EVENT_ID__ once at boot.
    const inlineFired = (window as any).__SF_PV_EVENT_ID__ && !(window as any).__SF_PV_SPA_STARTED__;
    if (inlineFired) {
      (window as any).__SF_PV_SPA_STARTED__ = true;
      return;
    }
    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      const eid = generateEventId();
      try { window.fbq("track", "PageView", {}, { eventID: eid }); } catch {}
      import("@/lib/metaCapi").then((m) => {
        m.fireMetaCAPI({ storeId, eventName: "PageView", eventId: eid });
      }).catch(() => {});
    }
  }, [pathname, store?.id, (store as any)?.facebook_pixel_id]);

  // Persist ?fbclid → _fbc cookie + expose store id globally for tracking helpers
  useEffect(() => {
    ensureFbcPersisted();
    getOrCreateSfVid(); // stable anon external_id for Pixel + CAPI
    if (store?.id) (window as any).__SF_STORE_ID__ = store.id;
    // Anti-ban: purge any legacy cookies scoped to the shared `.shopbanao.in`
    // platform domain. On platform subdomains this isolates each merchant
    // (fresh host-only `_fbp` per subdomain); on custom domains it prevents
    // cross-store contamination from prior visits to other shopbanao stores.
    import("@/lib/purgeSharedDomainCookies")
      .then((m) => m.purgeSharedDomainCookies())
      .catch(() => {});
  }, [store?.id]);

  // Durable Purchase outbox replay. Orders confirmed by the payment webhook
  // after the shopper's tab died (Android UPI hand-off) never got a browser
  // Purchase. On any later storefront visit we verify those staged orders and
  // fire the pixel with the original event_id, so browser coverage matches CAPI.
  useEffect(() => {
    const storeId = store?.id;
    if (!storeId) return;
    const run = () => {
      import("@/lib/pixelOutbox")
        .then((m) => m.flushPendingPurchases(storeId))
        .catch(() => {});
    };
    const t = window.setTimeout(run, 2500);
    return () => window.clearTimeout(t);
  }, [store?.id]);



  // GA4 tag — read measurement ID from store.features.ga4_measurement_id
  // (jsonb on stores). Stores without GA4 set up: hook is a no-op.
  const ga4Id = (store as any)?.features?.ga4_measurement_id || null;
  useGA4(ga4Id, pathname);

  // v8.44.1: client-side pageview beacon → page_views.
  // The Worker can't see ~95% of visits (Cloudflare CDN serves cached
  // HTML directly), so analytics dashboard sessions/conversion would
  // otherwise stay at zero. This insert fires once per route change.
  usePageviewBeacon(store?.id);

  // Capture ?coupon=CODE from any storefront URL into sessionStorage so it survives
  // navigation through product → cart → checkout (where it auto-applies).
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const c = params.get("coupon");
      if (c) {
        const code = c.toUpperCase();
        sessionStorage.setItem("pending_coupon", code);
        localStorage.setItem("pending_coupon", code);
        console.log("[coupon] captured from URL:", code);
      }
    } catch {}
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

  // Defer non-critical overlay chunk loads until the browser is idle.
  // FloatingWhatsApp/SideCart/BackToTop/CartPlusOneOverlay are all `lazy()`
  // but their `import()` would fire the moment Suspense renders them. Gating
  // behind requestIdleCallback keeps those ~30-60KB extra chunks off the
  // first-paint network/parse window.
  const [overlaysReady, setOverlaysReady] = useState(false);
  useEffect(() => {
    if (overlaysReady) return;
    const cb = () => setOverlaysReady(true);
    const idle: any = (window as any).requestIdleCallback;
    const handle = idle
      ? idle(cb, { timeout: 3000 })
      : window.setTimeout(cb, 1500);
    return () => {
      if (idle && (window as any).cancelIdleCallback) {
        (window as any).cancelIdleCallback(handle);
      } else {
        clearTimeout(handle);
      }
    };
  }, [overlaysReady]);

  // Single-skeleton policy: while data loads, render `null`.
  // The inline skeleton (Worker #sf-skel in production, index.html fallback in preview)
  // remains visible until storefront:content-ready fires.
  if (isLoading) {
    return null;
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
    <div className={wrapperClassName} style={mergedStyle} data-storefront-ready="true">
      {children(renderProps)}

      {/* Lazy overlays — shared across all themes */}
      {/* PWA install prompts temporarily disabled */}
      {/*
      <Suspense fallback={null}>
        <DynamicPwaManifest storeName={store.name} logoUrl={store.logo_url} themeColor={primaryColor} />
        <SmartInstallPrompt appName={store.name} primaryColor={primaryColor} textColor={btnTextColor} />
      </Suspense>
      */}
      {/* Overlay chunks gated behind requestIdleCallback to keep them off first-paint */}
      {overlaysReady && showSideCart && (
        <Suspense fallback={null}>
          <SideCart store={store} />
        </Suspense>
      )}
      {/* WhatsApp now lives in the header. This slot hosts the trust-video reel
          launcher — it self-hides when the store has no active trust videos and
          only fetches the player chunk + media on tap. */}
      {overlaysReady && showWhatsApp && !/\/checkout(\/|$)/.test(pathname) && (
        <Suspense fallback={null}>
          <TrustVideoLauncher storeId={store.id} storeSlug={store.slug} />
        </Suspense>
      )}

      {/* ExitIntentPopup permanently disabled — SAVE100 reserved for WhatsApp recovery links only.
          Coupon auto-applies at checkout via ?coupon=SAVE100 in the recovery link. */}
      {overlaysReady && (
        <Suspense fallback={null}>
          <BackToTop />
        </Suspense>
      )}
      {overlaysReady && (
        <Suspense fallback={null}>
          <CartPlusOneOverlay />
        </Suspense>
      )}
      {overlaysReady && (
        <Suspense fallback={null}>
          <OrderConfettiOverlay />
        </Suspense>
      )}
      {overlaysReady && (
        <Suspense fallback={null}>
          <StorefrontApps store={store} primaryColor={primaryColor} />
        </Suspense>
      )}
    </div>
  );

  // Wrap with providers
  if (showWishlist) {
    return (
      <CartProvider slug={store.slug} storeId={store.id} currency={store.currency || "INR"}>
        <WishlistProvider slug={store.slug}>
          <StorefrontAuthProvider storeId={store.id}>
            <StorefrontAutoLogin storeId={store.id} />
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
        <StorefrontAutoLogin storeId={store.id} />
        {content}
      </StorefrontAuthProvider>
    </CartProvider>
  );
}
