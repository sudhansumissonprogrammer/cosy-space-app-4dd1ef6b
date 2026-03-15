import { lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";

// Auth pages
const Login = lazy(() => import("@/pages/Login"));
const Signup = lazy(() => import("@/pages/Signup"));
const AuthCallback = lazy(() => import("@/pages/AuthCallback"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const AdminLogin = lazy(() => import("@/pages/AdminLogin"));

// Admin
const AdminLayout = lazy(() => import("@/layouts/AdminLayout"));
const AdminOverview = lazy(() => import("@/pages/admin/AdminOverview"));
const AdminUsersStores = lazy(() => import("@/pages/admin/AdminUsersStores"));
const AdminOrders = lazy(() => import("@/pages/admin/AdminOrders"));
const AdminSubscriptions = lazy(() => import("@/pages/admin/AdminSubscriptions"));
const AdminAnalytics = lazy(() => import("@/pages/admin/AdminAnalytics"));
const AdminSettings = lazy(() => import("@/pages/admin/AdminSettings"));

// Dashboard
const DashboardLayout = lazy(() => import("@/layouts/DashboardLayout"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const StoresList = lazy(() => import("@/pages/StoresList"));
const CreateStore = lazy(() => import("@/pages/CreateStore"));
const ProductsList = lazy(() => import("@/pages/ProductsList"));
const BulkUpload = lazy(() => import("@/pages/BulkUpload"));
const StoreDomain = lazy(() => import("@/pages/StoreDomain"));
const CreateProduct = lazy(() => import("@/pages/CreateProduct"));
const EditProduct = lazy(() => import("@/pages/EditProduct"));
const StoreOrders = lazy(() => import("@/pages/StoreOrders"));
const StoreCustomers = lazy(() => import("@/pages/StoreCustomers"));
const StoreSettings = lazy(() => import("@/pages/StoreSettings"));
const StoreAnalytics = lazy(() => import("@/pages/StoreAnalytics"));
const UserSettings = lazy(() => import("@/pages/UserSettings"));
const CustomerLeads = lazy(() => import("@/pages/CustomerLeads"));
const StorePayments = lazy(() => import("@/pages/StorePayments"));
const StoreCoupons = lazy(() => import("@/pages/StoreCoupons"));
const StoreShipping = lazy(() => import("@/pages/StoreShipping"));
const StoreTaxSettings = lazy(() => import("@/pages/StoreTaxSettings"));
const StoreAbandonedCarts = lazy(() => import("@/pages/StoreAbandonedCarts"));
const StoreThemeSettings = lazy(() => import("@/pages/StoreThemeSettings"));
const WhatsAppMarketing = lazy(() => import("@/pages/WhatsAppMarketing"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const InstallApp = lazy(() => import("@/pages/InstallApp"));

export default function AuthRoutes() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/install" element={<InstallApp />} />

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
          <Route path="users-stores" element={<AdminUsersStores />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="subscriptions" element={<AdminSubscriptions />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

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
          <Route path="stores/:storeId/theme" element={<StoreThemeSettings />} />
          <Route path="analytics" element={<StoreAnalytics />} />
          <Route path="settings" element={<UserSettings />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}
