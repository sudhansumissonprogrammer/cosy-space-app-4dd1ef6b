import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { getSubdomainSlug } from "@/lib/subdomain";

// Lazy-loaded pages & layouts
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
// Dashboard & admin — eager for instant transitions
import AdminLayout from "./layouts/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminStores from "./pages/admin/AdminStores";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminSubscriptions from "./pages/admin/AdminSubscriptions";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import DashboardLayout from "./layouts/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import StoresList from "./pages/StoresList";
import CreateStore from "./pages/CreateStore";
import ProductsList from "./pages/ProductsList";
import BulkUpload from "./pages/BulkUpload";
import StoreDomain from "./pages/StoreDomain";
import CreateProduct from "./pages/CreateProduct";
import EditProduct from "./pages/EditProduct";
import StoreOrders from "./pages/StoreOrders";
import StoreCustomers from "./pages/StoreCustomers";
import StoreSettings from "./pages/StoreSettings";
import StoreAnalytics from "./pages/StoreAnalytics";
import UserSettings from "./pages/UserSettings";
import CustomerLeads from "./pages/CustomerLeads";
import StorePayments from "./pages/StorePayments";
import StoreCoupons from "./pages/StoreCoupons";
import StoreShipping from "./pages/StoreShipping";
import StoreTaxSettings from "./pages/StoreTaxSettings";
import StoreAbandonedCarts from "./pages/StoreAbandonedCarts";

// Storefront & less-used — lazy for smaller initial bundle
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
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 3 * 60 * 1000, // 3 minutes — prevents refetch on every navigation
      refetchOnWindowFocus: false,
    },
  },
});

const LoadingSpinner = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

/** Routes that need auth context (dashboard, admin, login, etc.) */
function AuthRoutes() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Admin */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<AdminOverview />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="stores" element={<AdminStores />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="subscriptions" element={<AdminSubscriptions />} />
          <Route path="analytics" element={<AdminAnalytics />} />
        </Route>

        {/* User Dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="stores" element={<StoresList />} />
          <Route path="stores/create" element={<CreateStore />} />
          <Route path="stores/:storeId/products" element={<ProductsList />} />
          <Route path="stores/:storeId/products/create" element={<CreateProduct />} />
          <Route path="stores/:storeId/products/:productId/edit" element={<EditProduct />} />
          <Route path="stores/:storeId/products/bulk-upload" element={<BulkUpload />} />
          <Route path="stores/:storeId/orders" element={<StoreOrders />} />
          <Route path="stores/:storeId/customers" element={<StoreCustomers />} />
          <Route path="stores/:storeId/settings" element={<StoreSettings />} />
          <Route path="stores/:storeId/domain" element={<StoreDomain />} />
          <Route path="stores/:storeId/leads" element={<CustomerLeads />} />
          <Route path="stores/:storeId/payments" element={<StorePayments />} />
          <Route path="stores/:storeId/coupons" element={<StoreCoupons />} />
          <Route path="stores/:storeId/shipping" element={<StoreShipping />} />
          <Route path="stores/:storeId/tax" element={<StoreTaxSettings />} />
          <Route path="stores/:storeId/abandoned-carts" element={<StoreAbandonedCarts />} />
          <Route path="analytics" element={<StoreAnalytics />} />
          <Route path="settings" element={<UserSettings />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}

/** Router that splits storefront (no auth) from everything else */
function AppRouter() {
  const location = useLocation();
  const subdomainSlug = getSubdomainSlug();

  // Subdomain-based storefront (e.g. brand.storivo.in)
  if (subdomainSlug) {
    return (
      <Routes>
        <Route path="/" element={<StorefrontLayout slugOverride={subdomainSlug} />}>
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

  // Path-based storefront (/store/:slug)
  const isStorefront = location.pathname.startsWith("/store/");
  if (isStorefront) {
    return (
      <Routes>
        <Route path="/store/:slug" element={<StorefrontLayout />}>
          <Route index element={<StorefrontHome />} />
          <Route path="best-sellers" element={<StorefrontBestSellers />} />
          <Route path="contact" element={<StorefrontContact />} />
          <Route path="return-policy" element={<StorefrontReturnPolicy />} />
          <Route path="shipping-policy" element={<StorefrontShippingPolicy />} />
          <Route path="terms" element={<StorefrontTerms />} />
          <Route path="privacy-policy" element={<StorefrontPrivacyPolicy />} />
          <Route path="category/:categorySlug" element={<CategoryDetail />} />
          <Route path="product/:productSlug" element={<ProductDetail />} />
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
