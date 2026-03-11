import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { getSubdomainSlug } from "@/lib/subdomain";

// Storefront — eagerly loaded for fast storefront rendering
import StorefrontLayout from "./layouts/StorefrontLayout";
import StorefrontLayoutV2 from "./layouts/StorefrontLayoutV2";
import StorefrontHome from "./pages/StorefrontHome";
import StorefrontHomeV2 from "./pages/StorefrontHomeV2";
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

/** Shared child routes used by both layout themes */
const storefrontChildRoutes = (isV2: boolean) => (
  <>
    <Route index element={isV2 ? <StorefrontHomeV2 /> : <StorefrontHome />} />
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
  </>
);

function StorefrontRoutes({ slugOverride }: { slugOverride?: string }) {
  const basePath = slugOverride ? "/" : "/store/:slug";
  return (
    <Routes>
      {/* Theme 1 — Classic */}
      <Route path={basePath} element={<StorefrontLayout slugOverride={slugOverride} />}>
        {storefrontChildRoutes(false)}
      </Route>
    </Routes>
  );
}

/**
 * Theme-aware storefront router.
 * Both layouts are registered; the store's `theme` field in DB determines which layout renders.
 * StorefrontLayout handles theme-1, StorefrontLayoutV2 handles theme-2.
 * Since we can't know the theme before fetching, both layouts internally check and redirect isn't needed —
 * instead we use a wrapper that picks the right layout.
 */
function StorefrontRoutesV2({ slugOverride }: { slugOverride?: string }) {
  const basePath = slugOverride ? "/" : "/store/:slug";
  return (
    <Routes>
      <Route path={basePath} element={<StorefrontLayoutV2 slugOverride={slugOverride} />}>
        {storefrontChildRoutes(true)}
      </Route>
    </Routes>
  );
}

/**
 * Smart storefront router — renders both sets of routes.
 * The layout components internally check the store's theme and only render if matching.
 * We use a simpler approach: render both layouts at different paths and let StorefrontLayout
 * redirect to V2 if needed. But actually, the simplest approach is:
 * Both layouts are rendered — but only one matches since they share the same path.
 * 
 * Instead, we use a ThemeAwareStorefront that fetches store data first, then picks the layout.
 */
import { useStorefront } from "./layouts/StorefrontLayout";

function ThemeAwareStorefront({ slugOverride }: { slugOverride?: string }) {
  const { store, isLoading } = useStorefront(slugOverride);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const theme = (store as any)?.theme || "theme-1";
  const basePath = slugOverride ? "/" : "/store/:slug";
  const isV2 = theme === "theme-2";
  const LayoutComponent = isV2 ? StorefrontLayoutV2 : StorefrontLayout;

  return (
    <Routes>
      <Route path={basePath} element={<LayoutComponent slugOverride={slugOverride} />}>
        {storefrontChildRoutes(isV2)}
      </Route>
    </Routes>
  );
}

function AppRouter() {
  const location = useLocation();
  const subdomainSlug = getSubdomainSlug();

  // Subdomain storefront — zero admin code downloaded
  if (subdomainSlug) {
    return <ThemeAwareStorefront slugOverride={subdomainSlug} />;
  }

  // Path-based storefront — zero admin code downloaded
  if (location.pathname.startsWith("/store/")) {
    return <ThemeAwareStorefront />;
  }

  // Everything else — lazy-load the entire auth/admin/dashboard bundle
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
