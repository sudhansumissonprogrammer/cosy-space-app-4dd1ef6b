import { lazy, Suspense, useMemo } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { getSubdomainSlug, ROOT_DOMAIN } from "@/lib/subdomain";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { logError } from "@/lib/logError";

// Theme registry — each theme lazy-loaded independently; only the active theme is ever downloaded
const themeRegistry: Record<string, {
  layout: React.LazyExoticComponent<any>;
  home: React.LazyExoticComponent<any>;
}> = {
  "theme-1": {
    layout: lazy(() => import("./layouts/StorefrontLayout")),
    home: lazy(() => import("./pages/StorefrontHome")),
  },
  "theme-2": {
    layout: lazy(() => import("./layouts/StorefrontLayoutV2")),
    home: lazy(() => import("./pages/StorefrontHomeV2")),
  },
  "theme-3": {
    layout: lazy(() => import("./layouts/StorefrontLayoutV3")),
    home: lazy(() => import("./pages/StorefrontHomeV3")),
  },
  "theme-4": {
    layout: lazy(() => import("./layouts/StorefrontLayoutV4")),
    home: lazy(() => import("./pages/StorefrontHomeV4")),
  },
  "theme-6": {
    layout: lazy(() => import("./layouts/StorefrontLayoutV6")),
    home: lazy(() => import("./pages/StorefrontHomeV6")),
  },
  "theme-7": {
    layout: lazy(() => import("./layouts/StorefrontLayoutV7")),
    home: lazy(() => import("./pages/StorefrontHomeV7")),
  },
  "theme-8": {
    layout: lazy(() => import("./layouts/StorefrontLayoutV8")),
    home: lazy(() => import("./pages/StorefrontHomeV8")),
  },
  "theme-10": {
    layout: lazy(() => import("./layouts/StorefrontLayoutV10")),
    home: lazy(() => import("./pages/StorefrontHomeV10")),
  },
  "theme-11": {
    layout: lazy(() => import("./layouts/StorefrontLayoutV11")),
    home: lazy(() => import("./pages/StorefrontHomeV11")),
  },
  "theme-12": {
    layout: lazy(() => import("./layouts/StorefrontLayoutV12")),
    home: lazy(() => import("./pages/StorefrontHomeV12")),
  },
  "theme-13": {
    layout: lazy(() => import("./layouts/StorefrontLayoutV13")),
    home: lazy(() => import("./pages/StorefrontHomeV13")),
  },
};

const defaultThemeEntry = themeRegistry["theme-1"];

function getThemeEntry(theme: string) {
  return themeRegistry[theme] || defaultThemeEntry;
}
const StorefrontBestSellers = lazy(() => import("./pages/StorefrontBestSellers"));
const StorefrontContact = lazy(() => import("./pages/StorefrontContact"));
const StorefrontReturnPolicy = lazy(() => import("./pages/StorefrontReturnPolicy"));
const StorefrontShippingPolicy = lazy(() => import("./pages/StorefrontShippingPolicy"));
const StorefrontTerms = lazy(() => import("./pages/StorefrontTerms"));
const StorefrontPrivacyPolicy = lazy(() => import("./pages/StorefrontPrivacyPolicy"));
const WishlistPage = lazy(() => import("./pages/WishlistPage"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
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
const CategoryDetail = lazy(() => import("./pages/CategoryDetail"));
const StorefrontLogin = lazy(() => import("./pages/StorefrontLogin"));
const StorefrontSignup = lazy(() => import("./pages/StorefrontSignup"));
const StorefrontAccount = lazy(() => import("./pages/StorefrontAccount"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const InstallApp = lazy(() => import("./pages/InstallApp"));

// Auth + Admin + Dashboard — fully lazy, never loaded on storefront
const LazyAuthRoutes = lazy(() => import("./routes/AuthRoutes"));

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

const OrderTrackingPage = lazy(() => import("./pages/OrderTrackingPage"));

/** Shared child routes for all layout themes */
const storefrontChildRoutes = (HomeComponent: React.ComponentType) => {
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
};

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


/**
 * Renders storefront directly using cached/injected theme — NO spinner, NO waterfall.
 * The layout itself handles data fetching and shows its own skeleton if needed.
 */
function ThemeAwareStorefront({ slugOverride }: { slugOverride?: string }) {
  const location = useLocation();
  const pathSlug = !slugOverride ? location.pathname.split("/store/")[1]?.split("/")[0] : undefined;
  const effectiveSlug = slugOverride || pathSlug;
  
  // Get theme INSTANTLY from cache/injected data — no API call, no spinner
  const theme = useMemo(() => getInstantTheme(effectiveSlug), [effectiveSlug]);
  const basePath = slugOverride ? "/" : "/store/:slug";
  const { layout: LayoutComponent, home: HomeComponent } = getThemeEntry(theme);

  return (
    <Routes>
      <Route path={basePath} element={<LayoutComponent slugOverride={slugOverride} />}>
        {storefrontChildRoutes(HomeComponent)}
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
