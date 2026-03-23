import { lazy, Suspense, useMemo, useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { getSubdomainSlug, ROOT_DOMAIN } from "@/lib/subdomain";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { logError } from "@/lib/logError";

// Storefront layouts — lazy load all except V1 (most common default)
import StorefrontLayout from "./layouts/StorefrontLayout";
const StorefrontLayoutV2 = lazy(() => import("./layouts/StorefrontLayoutV2"));
const StorefrontLayoutV3 = lazy(() => import("./layouts/StorefrontLayoutV3"));
const StorefrontLayoutV4 = lazy(() => import("./layouts/StorefrontLayoutV4"));
const StorefrontLayoutV6 = lazy(() => import("./layouts/StorefrontLayoutV6"));
const StorefrontLayoutV7 = lazy(() => import("./layouts/StorefrontLayoutV7"));
const StorefrontLayoutV8 = lazy(() => import("./layouts/StorefrontLayoutV8"));
const StorefrontLayoutV10 = lazy(() => import("./layouts/StorefrontLayoutV10"));
const StorefrontLayoutV11 = lazy(() => import("./layouts/StorefrontLayoutV11"));
const StorefrontLayoutV12 = lazy(() => import("./layouts/StorefrontLayoutV12"));
const StorefrontLayoutV13 = lazy(() => import("./layouts/StorefrontLayoutV13"));

// Storefront home pages — lazy load all except V1
import StorefrontHome from "./pages/StorefrontHome";
const StorefrontHomeV2 = lazy(() => import("./pages/StorefrontHomeV2"));
const StorefrontHomeV3 = lazy(() => import("./pages/StorefrontHomeV3"));
const StorefrontHomeV4 = lazy(() => import("./pages/StorefrontHomeV4"));
const StorefrontHomeV6 = lazy(() => import("./pages/StorefrontHomeV6"));
const StorefrontHomeV7 = lazy(() => import("./pages/StorefrontHomeV7"));
const StorefrontHomeV8 = lazy(() => import("./pages/StorefrontHomeV8"));
const StorefrontHomeV10 = lazy(() => import("./pages/StorefrontHomeV10"));
const StorefrontHomeV11 = lazy(() => import("./pages/StorefrontHomeV11"));
const StorefrontHomeV12 = lazy(() => import("./pages/StorefrontHomeV12"));
const StorefrontHomeV13 = lazy(() => import("./pages/StorefrontHomeV13"));
const StorefrontBestSellers = lazy(() => import("./pages/StorefrontBestSellers"));
const StorefrontShop = lazy(() => import("./pages/StorefrontShop"));
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

const StorefrontSkeleton = () => (
  <div className="min-h-screen bg-background">
    <div className="h-14 border-b border-border flex items-center px-4 gap-3">
      <div className="h-7 w-24 rounded-lg bg-muted animate-pulse" />
      <div className="flex-1" />
      <div className="h-7 w-7 rounded-full bg-muted animate-pulse" />
    </div>
    <div className="w-full bg-muted animate-pulse" style={{ aspectRatio: "16/7" }} />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl overflow-hidden">
          <div className="w-full bg-muted animate-pulse" style={{ aspectRatio: "4/5" }} />
          <div className="pt-2 space-y-1.5">
            <div className="h-2.5 w-3/5 rounded bg-muted animate-pulse" />
            <div className="h-2.5 w-2/5 rounded bg-muted animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const LoadingSpinner = () => <StorefrontSkeleton />;

const OrderTrackingPage = lazy(() => import("./pages/OrderTrackingPage"));

/** Shared child routes for all layout themes */
const storefrontChildRoutes = (theme: string) => {
  const HomeComponent = theme === "theme-13" ? StorefrontHomeV13 : theme === "theme-12" ? StorefrontHomeV12 : theme === "theme-11" ? StorefrontHomeV11 : theme === "theme-10" ? StorefrontHomeV10 : theme === "theme-8" ? StorefrontHomeV8 : theme === "theme-7" ? StorefrontHomeV7 : theme === "theme-6" ? StorefrontHomeV6 : theme === "theme-4" ? StorefrontHomeV4 : theme === "theme-3" ? StorefrontHomeV3 : theme === "theme-2" ? StorefrontHomeV2 : StorefrontHome;
  return (
    <>
      <Route index element={<HomeComponent />} />
      <Route path="shop" element={<StorefrontShop />} />
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

function getLayoutComponent(theme: string) {
  switch (theme) {
    case "theme-13": return StorefrontLayoutV13;
    case "theme-12": return StorefrontLayoutV12;
    case "theme-11": return StorefrontLayoutV11;
    case "theme-10": return StorefrontLayoutV10;
    case "theme-8": return StorefrontLayoutV8;
    case "theme-7": return StorefrontLayoutV7;
    case "theme-6": return StorefrontLayoutV6;
    case "theme-4": return StorefrontLayoutV4;
    case "theme-3": return StorefrontLayoutV3;
    case "theme-2": return StorefrontLayoutV2;
    default: return StorefrontLayout;
  }
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
  const LayoutComponent = getLayoutComponent(theme);

  return (
    <Routes>
      <Route path={basePath} element={<LayoutComponent slugOverride={slugOverride} />}>
        {storefrontChildRoutes(theme)}
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
