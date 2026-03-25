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
          // ── Storefront shared core — loaded ONCE for all themes ──
          // Includes Shell, data hooks, providers, and shared UI components
          // used across multiple theme home pages.
          if (
            id.includes("/layouts/StorefrontShell") ||
            id.includes("/layouts/StorefrontLayout.logic") ||
            id.includes("/lib/themeUtils") ||
            id.includes("/components/storefront/StorefrontFooter") ||
            id.includes("/components/storefront/SideCart") ||
            id.includes("/components/storefront/FloatingWhatsApp") ||
            id.includes("/components/storefront/StorefrontNotFound") ||
            id.includes("/components/storefront/StorefrontMarquee") ||
            id.includes("/components/storefront/ExitIntentPopup") ||
            id.includes("/components/storefront/DynamicPwaManifest") ||
            id.includes("/components/storefront/PwaInstallBanner") ||
            id.includes("/components/SmartInstallPrompt") ||
            id.includes("/components/storefront/UniversalProductCard") ||
            id.includes("/components/storefront/UniversalCategories") ||
            id.includes("/components/storefront/BestSellingCarousel") ||
            id.includes("/components/storefront/StorefrontSearchOverlay") ||
            id.includes("/components/storefront/StorefrontSearchBar") ||
            id.includes("/components/storefront/StorefrontMobileHero") ||
            id.includes("/components/storefront/StorefrontInstagramSection") ||
            id.includes("/components/storefront/LazyRender") ||
            id.includes("/components/storefront/StorefrontHero") ||
            id.includes("/components/storefront/HeroBannerCarousel") ||
            id.includes("/components/storefront/StorefrontAbout") ||
            id.includes("/components/storefront/StorefrontCategories") ||
            id.includes("/components/storefront/ProductCardStyle") ||
            id.includes("/components/storefront/OptimizedImage") ||
            id.includes("/components/storefront/StarRating") ||
            id.includes("/components/ShareStoreDialog") ||
            id.includes("/components/ContentSkeleton") ||
            id.includes("/contexts/CartContext") ||
            id.includes("/contexts/WishlistContext") ||
            id.includes("/contexts/StorefrontAuthContext") ||
            id.includes("/hooks/useStorefrontThemeConfig") ||
            id.includes("/hooks/useThemePreview") ||
            id.includes("/hooks/useFacebookPixel") ||
            id.includes("/hooks/useMetaTags") ||
            id.includes("/hooks/useJsonLd") ||
            id.includes("/hooks/useProductCardActions") ||
            id.includes("/lib/trackPageView") ||
            id.includes("/lib/subdomain") ||
            id.includes("/lib/prefetchStorefrontRoutes") ||
            id.includes("/lib/productUtils")
          ) {
            return "storefront-core";
          }

          // ── Theme-specific chunks — each theme layout+home isolated ──
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
          // theme-1: match layout + home but NOT .logic (already in storefront-core)
          if (id.includes("/layouts/StorefrontLayout.tsx") || id.includes("/pages/StorefrontHome.tsx")) return "theme-1";

          // ── Admin/Dashboard isolation ──
          if (id.includes("/layouts/AdminLayout") || id.includes("/layouts/DashboardLayout") || id.includes("/pages/admin/")) return "admin";
        },
      },
    },
  },
}));
