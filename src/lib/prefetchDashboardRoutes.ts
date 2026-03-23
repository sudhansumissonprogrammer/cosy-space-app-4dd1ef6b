/**
 * Prefetch dashboard page chunks during idle time so navigation feels instant.
 * Called once when the dashboard sidebar mounts.
 */
const dashboardImports = [
  () => import("@/pages/Dashboard"),
  () => import("@/pages/ProductsList"),
  () => import("@/pages/StoreOrders"),
  () => import("@/pages/StoreSettings"),
  () => import("@/pages/StoreThemeSettings"),
  () => import("@/pages/CategoryManagement"),
  () => import("@/pages/MediaLibrary"),
  () => import("@/pages/StoreCustomers"),
  () => import("@/pages/StorePayments"),
  () => import("@/pages/StoreCoupons"),
  () => import("@/pages/StoreShipping"),
  () => import("@/pages/StoreTaxSettings"),
  () => import("@/pages/StoreAbandonedCarts"),
  () => import("@/pages/WhatsAppMarketing"),
  () => import("@/pages/StoreNotifications"),
  () => import("@/pages/StoreDomain"),
  () => import("@/pages/UserSettings"),
  () => import("@/pages/CustomerLeads"),
  () => import("@/pages/StoreAnalytics"),
  () => import("@/pages/StoreTracking"),
  () => import("@/pages/BulkUpload"),
];

let prefetched = false;

export function prefetchDashboardRoutes() {
  if (prefetched) return;
  prefetched = true;

  const schedule = typeof requestIdleCallback === "function"
    ? requestIdleCallback
    : (cb: () => void) => setTimeout(cb, 100);

  // Stagger imports to avoid blocking the main thread
  let idx = 0;
  function loadNext() {
    if (idx >= dashboardImports.length) return;
    const imp = dashboardImports[idx++];
    imp().catch(() => {}); // silently fail — will retry on actual navigation
    schedule(loadNext);
  }

  // Start after a short delay to let the current page finish rendering
  setTimeout(() => schedule(loadNext), 500);
}
