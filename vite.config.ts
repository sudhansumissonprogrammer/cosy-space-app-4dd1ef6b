import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      includeAssets: ["favicon.ico", "pwa-192x192.png", "pwa-512x512.png"],
      manifest: {
        name: "Storivo — Online Store",
        short_name: "Storivo",
        description: "Create your online store with WhatsApp ordering",
        theme_color: "#4361ee",
        background_color: "#f5f6fa",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
      navigateFallback: null,
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-pages",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "images",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Tree-shaking: ensure dead code is removed
    target: "es2020",
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // Prevent Rollup from pulling transitive/shared helpers into unrelated manual chunks.
        // This avoids runtime cycles like vendor-react -> admin -> vendor-router -> vendor-react
        // that can crash with "createContext of undefined" on storefront hosts.
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          // Keep stable route-level chunking only; let Vite handle vendor splitting.
          // This avoids brittle vendor cross-import cycles in production caches.

          // Theme-specific chunks — each theme layout+home isolated
          if (id.includes("/layouts/StorefrontLayoutV13") || id.includes("/pages/StorefrontHomeV13")) return "theme-13";
          if (id.includes("/layouts/StorefrontLayoutV12") || id.includes("/pages/StorefrontHomeV12")) return "theme-12";
          if (id.includes("/layouts/StorefrontLayoutV11") || id.includes("/pages/StorefrontHomeV11")) return "theme-11";
          if (id.includes("/layouts/StorefrontLayoutV10") || id.includes("/pages/StorefrontHomeV10")) return "theme-10";
          if (id.includes("/layouts/StorefrontLayoutV8") || id.includes("/pages/StorefrontHomeV8")) return "theme-8";
          if (id.includes("/layouts/StorefrontLayoutV7") || id.includes("/pages/StorefrontHomeV7")) return "theme-7";
          if (id.includes("/layouts/StorefrontLayoutV6") || id.includes("/pages/StorefrontHomeV6")) return "theme-6";
          if (id.includes("/layouts/StorefrontLayoutV4") || id.includes("/pages/StorefrontHomeV4")) return "theme-4";
          if (id.includes("/layouts/StorefrontLayoutV3") || id.includes("/pages/StorefrontHomeV3")) return "theme-3";
          if (id.includes("/layouts/StorefrontLayoutV2") || id.includes("/pages/StorefrontHomeV2")) return "theme-2";
          if (id.includes("/layouts/StorefrontLayout.") || id.includes("/pages/StorefrontHome.")) return "theme-1";

          // Admin/Dashboard isolation — keep all dashboard code out of storefront bundles
          if (
            id.includes("/layouts/AdminLayout") ||
            id.includes("/layouts/DashboardLayout") ||
            id.includes("/pages/admin/") ||
            id.includes("/pages/Dashboard") ||
            id.includes("/pages/ProductsList") ||
            id.includes("/pages/CreateProduct") ||
            id.includes("/pages/EditProduct") ||
            id.includes("/pages/BulkUpload") ||
            id.includes("/pages/StoreSettings") ||
            id.includes("/pages/StoreOrders") ||
            id.includes("/pages/StorePayments") ||
            id.includes("/pages/StoreShipping") ||
            id.includes("/pages/StoreTaxSettings") ||
            id.includes("/pages/StoreThemeSettings") ||
            id.includes("/pages/StoreDomain") ||
            id.includes("/pages/StoreTracking") ||
            id.includes("/pages/StoreAnalytics") ||
            id.includes("/pages/StoreCoupons") ||
            id.includes("/pages/StoreCustomers") ||
            id.includes("/pages/StoreAbandonedCarts") ||
            id.includes("/pages/StoresList") ||
            id.includes("/pages/CustomerLeads") ||
            id.includes("/pages/CategoryManagement") ||
            id.includes("/pages/MediaLibrary") ||
            id.includes("/pages/UserSettings") ||
            id.includes("/pages/WhatsAppMarketing") ||
            id.includes("/pages/CreateStore") ||
            id.includes("/components/ProductForm") ||
            id.includes("/components/AdminSidebar") ||
            id.includes("/components/AppSidebar") ||
            id.includes("/components/BulkEditDialog") ||
            id.includes("/components/OrderInvoice") ||
            id.includes("/components/AdminRoute") ||
            id.includes("/components/ProtectedRoute") ||
            id.includes("/contexts/AuthContext")
          ) return "admin";
        },
      },
    },
  },
}));
