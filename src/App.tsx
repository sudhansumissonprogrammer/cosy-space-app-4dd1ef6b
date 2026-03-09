import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AuthCallback from "./pages/AuthCallback";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AdminLogin from "./pages/AdminLogin";
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
import CreateProduct from "./pages/CreateProduct";
import EditProduct from "./pages/EditProduct";
import StorefrontLayout from "./layouts/StorefrontLayout";
import StorefrontHome from "./pages/StorefrontHome";
import StorefrontContact from "./pages/StorefrontContact";
import ProductDetail from "./pages/ProductDetail";
import CategoryDetail from "./pages/CategoryDetail";
import StoreOrders from "./pages/StoreOrders";
import StoreCustomers from "./pages/StoreCustomers";
import StoreSettings from "./pages/StoreSettings";
import StoreAnalytics from "./pages/StoreAnalytics";
import UserSettings from "./pages/UserSettings";
import CouponsPage from "./pages/CouponsPage";
import CustomerLeads from "./pages/CustomerLeads";
import CheckoutPage from "./pages/CheckoutPage";
import CartPage from "./pages/CartPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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

            {/* Public Storefront */}
            <Route path="/store/:slug" element={<StorefrontLayout />}>
              <Route index element={<StorefrontHome />} />
              <Route path="contact" element={<StorefrontContact />} />
              <Route path="category/:categorySlug" element={<CategoryDetail />} />
              <Route path="product/:productSlug" element={<ProductDetail />} />
              <Route path="cart" element={<CartPage />} />
              <Route path="checkout" element={<CheckoutPage />} />
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
              <Route path="stores/:storeId/orders" element={<StoreOrders />} />
              <Route path="stores/:storeId/customers" element={<StoreCustomers />} />
              <Route path="stores/:storeId/settings" element={<StoreSettings />} />
              <Route path="stores/:storeId/coupons" element={<CouponsPage />} />
              <Route path="stores/:storeId/leads" element={<CustomerLeads />} />
              <Route path="analytics" element={<StoreAnalytics />} />
              <Route path="settings" element={<UserSettings />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
