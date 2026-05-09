import { lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
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
const AdminWhatsApp = lazy(() => import("@/pages/admin/AdminWhatsApp"));
const AdminUsageMonitoring = lazy(() => import("@/pages/admin/AdminUsageMonitoring"));
const AdminErrorLogs = lazy(() => import("@/pages/admin/AdminErrorLogs"));
const AdminMenuConfig = lazy(() => import("@/pages/admin/AdminMenuConfig"));
const AdminPartners = lazy(() => import("@/pages/admin/AdminPartners"));
const AdminPartnerPayouts = lazy(() => import("@/pages/admin/AdminPartnerPayouts"));
const AdminPartnerAudit = lazy(() => import("@/pages/admin/AdminPartnerAudit"));
const AdminPartnerExports = lazy(() => import("@/pages/admin/AdminPartnerExports"));

// Partner program
const PartnerLanding = lazy(() => import("@/pages/partner/PartnerLanding"));
const PartnerSignup = lazy(() => import("@/pages/partner/PartnerSignup"));
const PartnerLogin = lazy(() => import("@/pages/partner/PartnerLogin"));
const PartnerLayout = lazy(() => import("@/layouts/PartnerLayout"));
const PartnerOverview = lazy(() => import("@/pages/partner/PartnerOverview"));
const PartnerWallet = lazy(() => import("@/pages/partner/PartnerWallet"));
const PartnerWithdrawals = lazy(() => import("@/pages/partner/PartnerWithdrawals"));
const PartnerAnalytics = lazy(() => import("@/pages/partner/PartnerAnalytics"));

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
const StoreTracking = lazy(() => import("@/pages/StoreTracking"));

const CategoryManagement = lazy(() => import("@/pages/CategoryManagement"));
const MediaLibrary = lazy(() => import("@/pages/MediaLibrary"));
const StorePages = lazy(() => import("@/pages/StorePages"));
const StorePageEditor = lazy(() => import("@/pages/StorePageEditor"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const BestSellerManagement = lazy(() => import("@/pages/BestSellerManagement"));
const SpacingCheck = lazy(() => import("@/pages/SpacingCheck"));
const InstallApp = lazy(() => import("@/pages/InstallApp"));
const Index = lazy(() => import("@/pages/Index"));

export default function AuthRoutes() {
  return (
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/install" element={<InstallApp />} />

        {/* Partner Program */}
        <Route path="/partners" element={<PartnerLanding />} />
        <Route path="/partners/signup" element={<PartnerSignup />} />
        <Route path="/partners/login" element={<PartnerLogin />} />
        <Route
          path="/partners/dashboard"
          element={
            <ProtectedRoute>
              <PartnerLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<PartnerOverview />} />
          <Route path="wallet" element={<PartnerWallet />} />
          <Route path="withdrawals" element={<PartnerWithdrawals />} />
          <Route path="analytics" element={<PartnerAnalytics />} />
        </Route>

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
          <Route path="whatsapp" element={<AdminWhatsApp />} />
          <Route path="subscriptions" element={<AdminSubscriptions />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="usage" element={<AdminUsageMonitoring />} />
          <Route path="error-logs" element={<AdminErrorLogs />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="menu-config" element={<AdminMenuConfig />} />
          <Route path="partners" element={<AdminPartners />} />
          <Route path="partners/payouts" element={<AdminPartnerPayouts />} />
          <Route path="partners/audit" element={<AdminPartnerAudit />} />
          <Route path="partners/exports" element={<AdminPartnerExports />} />
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
          <Route path="stores/:storeSlug/products" element={<ProductsList />} />
          <Route path="stores/:storeSlug/products/create" element={<CreateProduct />} />
          <Route path="stores/:storeSlug/products/:productId/edit" element={<EditProduct />} />
          <Route path="stores/:storeSlug/products/bulk-upload" element={<BulkUpload />} />
          <Route path="stores/:storeSlug/categories" element={<CategoryManagement />} />
          <Route path="stores/:storeSlug/media" element={<MediaLibrary />} />
          <Route path="stores/:storeSlug/orders" element={<StoreOrders />} />
          <Route path="stores/:storeSlug/customers" element={<StoreCustomers />} />
          <Route path="stores/:storeSlug/settings" element={<StoreSettings />} />
          <Route path="stores/:storeSlug/domain" element={<StoreDomain />} />
          <Route path="stores/:storeSlug/leads" element={<CustomerLeads />} />
          <Route path="stores/:storeSlug/payments" element={<StorePayments />} />
          <Route path="stores/:storeSlug/coupons" element={<StoreCoupons />} />
          <Route path="stores/:storeSlug/shipping" element={<StoreShipping />} />
          <Route path="stores/:storeSlug/tax" element={<StoreTaxSettings />} />
          <Route path="stores/:storeSlug/abandoned-carts" element={<StoreAbandonedCarts />} />
          <Route path="stores/:storeSlug/theme" element={<StoreThemeSettings />} />
          <Route path="stores/:storeSlug/pages" element={<StorePages />} />
          <Route path="stores/:storeSlug/pages/new" element={<StorePageEditor />} />
          <Route path="stores/:storeSlug/pages/:pageId/edit" element={<StorePageEditor />} />
          <Route path="stores/:storeSlug/whatsapp" element={<WhatsAppMarketing />} />
          <Route path="stores/:storeSlug/tracking" element={<StoreTracking />} />
          <Route path="stores/:storeSlug/best-sellers" element={<BestSellerManagement />} />
          <Route path="stores/:storeSlug/spacing-check" element={<SpacingCheck />} />
          
          <Route path="analytics" element={<StoreAnalytics />} />
          <Route path="settings" element={<UserSettings />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
  );
}
