import { lazy, Suspense, useMemo, useState, useEffect, ComponentType } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { getSubdomainSlug, ROOT_DOMAIN } from "@/lib/subdomain";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { logError } from "@/lib/logError";

// ─── ONLY V1 is eagerly imported (most common default) ───
import StorefrontLayout from "./layouts/StorefrontLayout";
import StorefrontHome from "./pages/StorefrontHome";

// Auth + Admin + Dashboard — fully lazy, never loaded on storefront
const LazyAuthRoutes = lazy(() => import("./routes/AuthRoutes"));

// Shared storefront child pages — lazy loaded once (theme-independent)
const StorefrontBestSellers = lazy(() => import("./pages/StorefrontBestSellers"));
const StorefrontContact = lazy(() => import("./pages/StorefrontContact"));
const StorefrontReturnPolicy = lazy(() => import("./pages/StorefrontReturnPolicy"));
const StorefrontShippingPolicy = lazy(() => import("./pages/StorefrontShippingPolicy"));
const StorefrontTerms = lazy(() => import("./pages/StorefrontTerms"));
const StorefrontPrivacyPolicy = lazy(() => import("./pages/StorefrontPrivacyPolicy"));
const WishlistPage = lazy(() => import("./pages/WishlistPage"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const CategoryDetail = lazy(() => import("./pages/CategoryDetail"));
const StorefrontLogin = lazy(() => import("./pages/StorefrontLogin"));
const StorefrontSignup = lazy(() => import("./pages/StorefrontSignup"));
const StorefrontAccount = lazy(() => import("./pages/StorefrontAccount"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const InstallApp = lazy(() => import("./pages/InstallApp"));
const OrderTrackingPage = lazy(() => import("./pages/OrderTrackingPage"));

const ProductDetailSkeleton = () => (
  <div className="mx-auto max-w-6xl px-4 py-8 space-y-4">
    <div className="h-8 w-48 animate-pulse rounded bg-muted" />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="aspect-square animate-pulse rounded-xl bg-muted" />
      <div className="space-y-4">
        <div className="h-6 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-10 w-32 animate-pulse rounded bg-muted" />
      </div>
    </div>
  </div>
);

// ─── THEME REGISTRY: Strict isolation via dynamic import() ───
// Each theme is a separate chunk. Only the active theme is ever imported.
// No shared import paths, no group registries, no cross-theme leakage.

type ThemeModule = { layout: ComponentType<any>; home: ComponentType<any> };

const themeImporters: Record<string, () => Promise<ThemeModule>> = {
  "theme-2": () =>
    Promise.all([
      import("./layouts/StorefrontLayoutV2"),
      import("./pages/StorefrontHomeV2"),
    ]).then(([l, h]) => ({ layout: l.default, home: h.default })),
  "theme-3": () =>
    Promise.all([
      import("./layouts/StorefrontLayoutV3"),
      import("./pages/StorefrontHomeV3"),
    ]).then(([l, h]) => ({ layout: l.default, home: h.default })),
  "theme-4": () =>
    Promise.all([
      import("./layouts/StorefrontLayoutV4"),
      import("./pages/StorefrontHomeV4"),
    ]).then(([l, h]) => ({ layout: l.default, home: h.default })),
  "theme-6": () =>
    Promise.all([
      import("./layouts/StorefrontLayoutV6"),
      import("./pages/StorefrontHomeV6"),
    ]).then(([l, h]) => ({ layout: l.default, home: h.default })),
  "theme-7": () =>
    Promise.all([
      import("./layouts/StorefrontLayoutV7"),
      import("./pages/StorefrontHomeV7"),
    ]).then(([l, h]) => ({ layout: l.default, home: h.default })),
  "theme-8": () =>
    Promise.all([
      import("./layouts/StorefrontLayoutV8"),
      import("./pages/StorefrontHomeV8"),
    ]).then(([l, h]) => ({ layout: l.default, home: h.default })),
  "theme-10": () =>
    Promise.all([
      import("./layouts/StorefrontLayoutV10"),
      import("./pages/StorefrontHomeV10"),
    ]).then(([l, h]) => ({ layout: l.default, home: h.default })),
  "theme-11": () =>
    Promise.all([
      import("./layouts/StorefrontLayoutV11"),
      import("./pages/StorefrontHomeV11"),
    ]).then(([l, h]) => ({ layout: l.default, home: h.default })),
  "theme-12": () =>
    Promise.all([
      import("./layouts/StorefrontLayoutV12"),
      import("./pages/StorefrontHomeV12"),
    ]).then(([l, h]) => ({ layout: l.default, home: h.default })),
  "theme-13": () =>
    Promise.all([
      import("./layouts/StorefrontLayoutV13"),
      import("./pages/StorefrontHomeV13"),
    ]).then(([l, h]) => ({ layout: l.default, home: h.default })),
};

// Cache loaded theme modules in memory so re-renders don't re-import
const loadedThemes = new Map<string, ThemeModule>();

function useThemeModule(theme: string): ThemeModule {
  const [mod, setMod] = useState<ThemeModule | null>(() => {
    if (theme === "theme-1" || !themeImporters[theme]) {
      return { layout: StorefrontLayout, home: StorefrontHome };
    }
    return loadedThemes.get(theme) || null;
  });

  useEffect(() => {
    // V1 is already imported eagerly
    if (theme === "theme-1" || !themeImporters[theme]) {
      setMod({ layout: StorefrontLayout, home: StorefrontHome });
      return;
    }

    // Already cached in memory
    const cached = loadedThemes.get(theme);
    if (cached) {
      setMod(cached);
      return;
    }

    // Dynamic import — only this theme's chunk is requested
    let cancelled = false;
    themeImporters[theme]()
      .then((loaded) => {
        loadedThemes.set(theme, loaded);
        if (!cancelled) setMod(loaded);
      })
      .catch((err) => {
        logError({ message: `Failed to load theme ${theme}`, stack: err?.stack, context: "theme-loader" });
        // Failsafe: fall back to default theme
        const fallback = { layout: StorefrontLayout, home: StorefrontHome };
        if (!cancelled) setMod(fallback);
      });

    return () => { cancelled = true; };
  }, [theme]);

  // Failsafe: always return a valid module (V1 default)
  return mod || { layout: StorefrontLayout, home: StorefrontHome };
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      onError: (error: Error) => {
        logError({
          message: error.message,
          stack: error.stack,
          context: "mutation",
        });
      },
    },
  },
});

const LoadingSpinner = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

/**
 * Get the theme instantly from injected data or localStorage cache.
 * This avoids needing a full API call just to determine which layout to render.
 */
function getInstantTheme(slug: string | undefined): string {
  if (!slug) return "theme-1";

  // 1. Check Cloudflare Worker injected data (instant, no API call)
  const injected = (window as any).__STOREFRONT_DATA__;
  if (injected?.store?.theme) {
    return injected.store.theme;
  }

  // 2. Check localStorage cache (instant, from previous visit)
  try {
    const cached = localStorage.getItem(`storefront_theme_${slug}`);
    if (cached) return cached;
  } catch {}

  return "theme-1";
}

/** Shared child routes for all layout themes */
function StorefrontChildRoutes({ HomeComponent }: { HomeComponent: ComponentType }) {
  return (
    <>
      <Route index element={<HomeComponent />} />
      <Route path="best-sellers" element={<StorefrontBestSellers />} />
      <Route path="contact" element={<StorefrontContact />} />
      <Route path="return-policy" element={<StorefrontReturnPolicy />} />
      <Route path="shipping-policy" element={<StorefrontShippingPolicy />} />
      <Route path="terms" element={<StorefrontTerms />} />
      <Route path="privacy-policy" element={<StorefrontPrivacyPolicy />} />
      <Route path="category/:categorySlug" element={<CategoryDetail />} />
      <Route path="product/:productSlug" element={<Suspense fallback={<ProductDetailSkeleton />}><ProductDetail /></Suspense>} />
      <Route path="cart" element={<CartPage />} />
      <Route path="wishlist" element={<WishlistPage />} />
      <Route path="checkout" element={<CheckoutPage />} />
      <Route path="login" element={<StorefrontLogin />} />
      <Route path="signup" element={<StorefrontSignup />} />
      <Route path="account" element={<StorefrontAccount />} />
      <Route path="install" element={<InstallApp />} />
      <Route path="track-order" element={<OrderTrackingPage />} />
    </>
  );
}

/**
 * Renders storefront directly using cached/injected theme — NO spinner, NO waterfall.
 * Only the active theme's JS chunk is loaded. All other themes stay untouched.
 */
function ThemeAwareStorefront({ slugOverride }: { slugOverride?: string }) {
  const location = useLocation();
  const pathSlug = !slugOverride ? location.pathname.split("/store/")[1]?.split("/")[0] : undefined;
  const effectiveSlug = slugOverride || pathSlug;

  // Get theme INSTANTLY from cache/injected data — no API call, no spinner
  const theme = useMemo(() => getInstantTheme(effectiveSlug), [effectiveSlug]);
  const basePath = slugOverride ? "/" : "/store/:slug";

  // Dynamic theme loading: only active theme chunk is fetched
  const { layout: LayoutComponent, home: HomeComponent } = useThemeModule(theme);

  return (
    <Routes>
      <Route path={basePath} element={<LayoutComponent slugOverride={slugOverride} />}>
        <StorefrontChildRoutes HomeComponent={HomeComponent} />
      </Route>
    </Routes>
  );
}

function AppRouter() {
  const location = useLocation();
  const subdomainSlug = getSubdomainSlug();

  if (subdomainSlug) {
    return <ThemeAwareStorefront slugOverride={subdomainSlug} />;
  }

  if (location.pathname.startsWith("/store/")) {
    const hostname = window.location.hostname;
    const isProduction = hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`;

    if (isProduction) {
      const rest = location.pathname.replace(/^\/store\//, "");
      const slug = rest.split("/")[0];
      const remainingPath = rest.slice(slug.length);
      const search = window.location.search;
      const hash = window.location.hash;
      window.location.replace(`https://${slug}.${ROOT_DOMAIN}${remainingPath}${search}${hash}`);
      return <LoadingSpinner />;
    }

    return <ThemeAwareStorefront />;
  }

  return <LazyAuthRoutes />;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<LoadingSpinner />}>
            <ErrorBoundary fallbackMessage="This page encountered an error">
              <AppRouter />
            </ErrorBoundary>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
