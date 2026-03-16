import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { getSubdomainSlug, ROOT_DOMAIN } from "@/lib/subdomain";

// Storefront — eagerly loaded for fast storefront rendering
import StorefrontLayout from "./layouts/StorefrontLayout";
import StorefrontLayoutV2 from "./layouts/StorefrontLayoutV2";
import StorefrontLayoutV3 from "./layouts/StorefrontLayoutV3";
import StorefrontLayoutV4 from "./layouts/StorefrontLayoutV4";
import StorefrontLayoutV6 from "./layouts/StorefrontLayoutV6";
import StorefrontLayoutV7 from "./layouts/StorefrontLayoutV7";
const StorefrontLayoutV8 = lazy(() => import("./layouts/StorefrontLayoutV8"));
const StorefrontLayoutV10 = lazy(() => import("./layouts/StorefrontLayoutV10"));
const StorefrontLayoutV12 = lazy(() => import("./layouts/StorefrontLayoutV12"));
import StorefrontLayoutV11 from "./layouts/StorefrontLayoutV11";
import StorefrontHome from "./pages/StorefrontHome";
import StorefrontHomeV2 from "./pages/StorefrontHomeV2";
import StorefrontHomeV3 from "./pages/StorefrontHomeV3";
const StorefrontHomeV4 = lazy(() => import("./pages/StorefrontHomeV4"));
const StorefrontHomeV6 = lazy(() => import("./pages/StorefrontHomeV6"));
const StorefrontHomeV7 = lazy(() => import("./pages/StorefrontHomeV7"));
const StorefrontHomeV8 = lazy(() => import("./pages/StorefrontHomeV8"));
const StorefrontHomeV10 = lazy(() => import("./pages/StorefrontHomeV10"));
const StorefrontHomeV12 = lazy(() => import("./pages/StorefrontHomeV12"));
import StorefrontHomeV11 from "./pages/StorefrontHomeV11";
const StorefrontBestSellers = lazy(() => import("./pages/StorefrontBestSellers"));
const StorefrontContact = lazy(() => import("./pages/StorefrontContact"));
const StorefrontReturnPolicy = lazy(() => import("./pages/StorefrontReturnPolicy"));
const StorefrontShippingPolicy = lazy(() => import("./pages/StorefrontShippingPolicy"));
const StorefrontTerms = lazy(() => import("./pages/StorefrontTerms"));
const StorefrontPrivacyPolicy = lazy(() => import("./pages/StorefrontPrivacyPolicy"));
const WishlistPage = lazy(() => import("./pages/WishlistPage"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
import { ProductDetailSkeleton } from "./pages/ProductDetail";
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
      staleTime: 3 * 60 * 1000,
      refetchOnWindowFocus: false,
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
const storefrontChildRoutes = (theme: string) => {
  const HomeComponent = theme === "theme-11" ? StorefrontHomeV11 : theme === "theme-10" ? StorefrontHomeV10 : theme === "theme-8" ? StorefrontHomeV8 : theme === "theme-7" ? StorefrontHomeV7 : theme === "theme-6" ? StorefrontHomeV6 : theme === "theme-4" ? StorefrontHomeV4 : theme === "theme-3" ? StorefrontHomeV3 : theme === "theme-2" ? StorefrontHomeV2 : StorefrontHome;
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

import { useStorefront } from "./layouts/StorefrontLayout";

function ThemeAwareStorefront({ slugOverride }: { slugOverride?: string }) {
  // Extract slug from URL path when not using subdomain
  const location = useLocation();
  const pathSlug = !slugOverride ? location.pathname.split("/store/")[1]?.split("/")[0] : undefined;
  const effectiveSlug = slugOverride || pathSlug;
  const { store, isLoading } = useStorefront(effectiveSlug);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const theme = (store as any)?.theme || "theme-1";
  const basePath = slugOverride ? "/" : "/store/:slug";

  const LayoutComponent = theme === "theme-11"
    ? StorefrontLayoutV11
    : theme === "theme-10"
    ? StorefrontLayoutV10
    : theme === "theme-8"
    ? StorefrontLayoutV8
    : theme === "theme-7"
    ? StorefrontLayoutV7
    : theme === "theme-6"
    ? StorefrontLayoutV6
    : theme === "theme-4"
    ? StorefrontLayoutV4
    : theme === "theme-3"
    ? StorefrontLayoutV3
    : theme === "theme-2"
    ? StorefrontLayoutV2
    : StorefrontLayout;

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
      // Redirect /store/{slug}/... → {slug}.storivo.in/...
      const rest = location.pathname.replace(/^\/store\//, "");
      const slug = rest.split("/")[0];
      const remainingPath = rest.slice(slug.length); // e.g. "/product/xyz"
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
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<LoadingSpinner />}>
          <AppRouter />
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
