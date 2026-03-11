import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { getSubdomainSlug } from "@/lib/subdomain";

// Storefront — eagerly loaded for fast storefront rendering
import StorefrontLayout from "./layouts/StorefrontLayout";
import StorefrontHome from "./pages/StorefrontHome";
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

function StorefrontRoutes({ slugOverride }: { slugOverride?: string }) {
  return (
    <Routes>
      <Route path={slugOverride ? "/" : "/store/:slug"} element={<StorefrontLayout slugOverride={slugOverride} />}>
        <Route index element={<StorefrontHome />} />
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
      </Route>
    </Routes>
  );
}

function AppRouter() {
  const location = useLocation();
  const subdomainSlug = getSubdomainSlug();

  // Subdomain storefront — zero admin code downloaded
  if (subdomainSlug) {
    return <StorefrontRoutes slugOverride={subdomainSlug} />;
  }

  // Path-based storefront — zero admin code downloaded
  if (location.pathname.startsWith("/store/")) {
    return <StorefrontRoutes />;
  }

  // Everything else — lazy-load the entire auth/admin/dashboard bundle
  return <AuthRoutes />;
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
