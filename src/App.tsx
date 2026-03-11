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
import StorefrontLayoutV3 from "./layouts/StorefrontLayoutV3";
import StorefrontLayoutV4 from "./layouts/StorefrontLayoutV4";
import StorefrontLayoutV5 from "./layouts/StorefrontLayoutV5";
import StorefrontHome from "./pages/StorefrontHome";
import StorefrontHomeV2 from "./pages/StorefrontHomeV2";
import StorefrontHomeV3 from "./pages/StorefrontHomeV3";
const StorefrontHomeV4 = lazy(() => import("./pages/StorefrontHomeV4"));
const StorefrontHomeV5 = lazy(() => import("./pages/StorefrontHomeV5"));
const StorefrontHomeV6 = lazy(() => import("./pages/StorefrontHomeV6"));
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

/** Shared child routes for all layout themes */
const storefrontChildRoutes = (theme: string) => {
  const HomeComponent = theme === "theme-5" ? StorefrontHomeV5 : theme === "theme-4" ? StorefrontHomeV4 : theme === "theme-3" ? StorefrontHomeV3 : theme === "theme-2" ? StorefrontHomeV2 : StorefrontHome;
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
    </>
  );
};

import { useStorefront } from "./layouts/StorefrontLayout";

function ThemeAwareStorefront({ slugOverride }: { slugOverride?: string }) {
  const { store, isLoading } = useStorefront(slugOverride);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const theme = (store as any)?.theme || "theme-1";
  const basePath = slugOverride ? "/" : "/store/:slug";

  const LayoutComponent = theme === "theme-5"
    ? StorefrontLayoutV5
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
