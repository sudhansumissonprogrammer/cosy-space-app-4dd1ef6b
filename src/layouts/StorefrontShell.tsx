import { useEffect, useRef, useMemo, useState, Suspense, lazy, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { isKalingaStore } from "@/lib/kalingaStore";
import { useStorefront, type StoreData } from "@/layouts/StorefrontLayout.logic";
import { CartProvider } from "@/contexts/CartContext";
import { WishlistProvider } from "@/contexts/WishlistContext";
import { StorefrontAuthProvider } from "@/contexts/StorefrontAuthContext";
import StorefrontAutoLogin from "@/components/storefront/StorefrontAutoLogin";
const AutoFreeGift = lazy(() => import("@/components/storefront/AutoFreeGift"));
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import { useThemePreview } from "@/hooks/useThemePreview";
import { useMetaTags } from "@/hooks/useMetaTags";
import { generateEventId, useFacebookPixel } from "@/hooks/useFacebookPixel";
import { claimPageView, registerPageViewFired } from "@/lib/pixelPageView";

import { ensureFbcPersisted, getOrCreateSfVid, seedCapiUserFromStorage } from "@/lib/metaEnrichment";
import { useGA4 } from "@/hooks/useGA4";
import { useGoogleAds } from "@/hooks/useGoogleAds";
import { usePageviewBeacon } from "@/hooks/usePageviewBeacon";
import { useLiveHeartbeat } from "@/hooks/useLiveHeartbeat";
import { usePaymentResumeGuard } from "@/hooks/usePaymentResumeGuard";
import { useScrollRestoration } from "@/hooks/useScrollRestoration";

import { buildThemeStyle, loadGoogleFonts } from "@/lib/themeUtils";
import StorefrontNotFound from "@/components/storefront/StorefrontNotFound";
import { initSfGlass } from "@/lib/sfGlassRuntime";
import "@/styles/sf-glass.css";
import "@/styles/sf-kalinga-mobile.css";

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
const TrustVideoLauncher = lazy(() => import("@/components/storefront/trust/TrustVideoLauncher"));
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
  // `overflow-x-hidden` creates a vertical scroll container per the CSS
  // overflow spec, which traps descendant `position: sticky` headers.
  // `overflow-x-clip` prevents horizontal bleed without becoming a scroller.
  wrapperClassName = "storefront-font min-h-screen font-sans overflow-x-clip",
  notFoundLabel = "Store",
  children,
}: StorefrontShellProps) {
  const { store, isLoading, slug, themeConfig: shellThemeConfig } = useStorefront(slugOverride);
  const viewTracked = useRef(false);

  // Analytics hooks — safe to call even when store is null
  useFacebookPixel((store as any)?.facebook_pixel_id, store?.id);

  const seoLocation = useLocation();
  const isSeoHome = seoLocation.pathname === "/" || seoLocation.pathname.replace(/\/$/, "") === `/store/${store?.slug}`;
  useMetaTags({
    enabled: isSeoHome,
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

  // Decide once whether this device can afford live backdrop-blur glass, then
  // upgrade those surfaces to real refraction (Chromium) once idle.
  useEffect(() => {
    document.documentElement.classList.add("sf-storefront");
    return () => document.documentElement.classList.remove("sf-storefront");
  }, []);

  useEffect(() => {
    initSfGlass();
    const run = () => import("@/lib/sfGlassRefraction").then((m) => m.initSfGlassRefraction());
    const ric = (window as any).requestIdleCallback;
    if (typeof ric === "function") ric(run, { timeout: 2000 });
    else setTimeout(run, 600);
  }, []);


  // Cache brand identity for the black branded splash screen (index.html reads
  // this at T+0 on the next visit so the splash shows the real logo instantly).
  useEffect(() => {
    if (!store?.name) return;
    try {
      const identity = store.slug || window.location.hostname;
      localStorage.setItem(
        `sb_splash:${identity}`,
        JSON.stringify({ logo: store.logo_url || "", name: store.name })
      );
    } catch { /* storage blocked — splash falls back to the favicon/monogram */ }
  }, [store?.slug, store?.name, store?.logo_url]);

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
  // All PageView sources (inline bootstrap, useFacebookPixel, this effect) go
  // through claimPageView() — one cross-tab, per pixel+path, time-boxed gate.
  // Previously each had its own guard, so an extra shell mount (theme switch,
  // Suspense re-mount, bfcache restore) could emit a second byte-identical
  // PageView for the same path → Meta flagged "event fired twice".
  useEffect(() => {
    const pixelId = (store as any)?.facebook_pixel_id;
    if (!pixelId) return;
    const storeId = store?.id;
    if (!storeId) return;

    // The inline pixel (index.html) already fired the initial PageView for the
    // boot path — register that claim once so we never duplicate it.
    if ((window as any).__SF_PV_EVENT_ID__ && !(window as any).__SF_PV_SPA_STARTED__) {
      (window as any).__SF_PV_SPA_STARTED__ = true;
      registerPageViewFired(pixelId, (window as any).__SF_PV_BOOT_PATH__ || pathname);
      if (((window as any).__SF_PV_BOOT_PATH__ || pathname) === pathname) return;
    }

    if (!claimPageView(pixelId, pathname)) return;

    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      const eid = generateEventId();
      // STORE ISOLATION: trackSingle pins the SPA PageView to THIS store's pixel.
      try { window.fbq("trackSingle", pixelId, "PageView", {}, { eventID: eid }); } catch {}

      import("@/lib/metaCapi").then((m) => {
        m.fireMetaCAPI({ storeId, eventName: "PageView", eventId: eid });
      }).catch(() => {});
    }
  }, [pathname, store?.id, (store as any)?.facebook_pixel_id]);


  // Persist ?fbclid → _fbc cookie + expose store id globally for tracking helpers
  useEffect(() => {
    ensureFbcPersisted();
    getOrCreateSfVid(); // stable anon external_id for Pixel + CAPI
    // Replay the only PII this storefront collects (mobile + delivery
    // address) into Pixel Advanced Matching / CAPI on every page load.
    // Without this a returning shopper's PageView/ViewContent/AddToCart
    // carried zero match keys until they reached checkout.
    seedCapiUserFromStorage(store?.id);
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

  // Google Ads tag / GTM — per-store from store.features. Reuses the gtag.js
  // file GA4 already loads, so enabling Ads costs zero extra script download.
  const gadsId = (store as any)?.features?.google_ads_id || null;
  const gtmId = (store as any)?.features?.gtm_container_id || null;
  useGoogleAds(gadsId, gtmId);

  // v8.44.1: client-side pageview beacon → page_views.
  // The Worker can't see ~95% of visits (Cloudflare CDN serves cached
  // HTML directly), so analytics dashboard sessions/conversion would
  // otherwise stay at zero. This insert fires once per route change.
  usePageviewBeacon(store?.id);

  // Live visitors: 20s heartbeat while the tab is visible. Powers an accurate
  // "people browsing now" count (shoppers who leave age out within 60s).
  useLiveHeartbeat(store?.id);

  // Instagram/FB webviews often reload the ORIGINAL entry URL after a UPI
  // hand-off instead of /checkout. Verify any fresh payment wait marker and
  // bounce the shopper back into checkout so they see confirmation / retry.
  usePaymentResumeGuard(store?.id, store?.slug);

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

  // Hover/touch prefetch for every category link in the storefront.
  // Installed once at idle so it never competes with first paint.
  useEffect(() => {
    let dispose: (() => void) | undefined;
    const install = () => {
      import("@/lib/prefetchCategory")
        .then((m) => { dispose = m.installCategoryLinkPrefetch(); })
        .catch(() => {});
    };
    const idle: any = (window as any).requestIdleCallback;
    const h = idle ? idle(install, { timeout: 2500 }) : window.setTimeout(install, 1200);
    return () => {
      if (idle && (window as any).cancelIdleCallback) (window as any).cancelIdleCallback(h);
      else clearTimeout(h);
      dispose?.();
    };
  }, []);

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
    <div className={`${wrapperClassName}${isKalingaStore(store) ? " sf-kalinga-mobile" : ""}`} style={mergedStyle} data-storefront-ready="true">
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
      {overlaysReady && !/\/checkout(\/|$)/.test(pathname) && (
        <Suspense fallback={null}>
          <TrustVideoLauncher
            storeId={store.id}
            storeSlug={store.slug}
            storeName={store.name}
            whatsappNumber={(store as any).whatsapp_number}
          />
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
            <Suspense fallback={null}><AutoFreeGift storeSlug={store.slug} /></Suspense>
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
        <Suspense fallback={null}><AutoFreeGift storeSlug={store.slug} /></Suspense>
        {content}
      </StorefrontAuthProvider>
    </CartProvider>
  );
}
