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
    target: "es2020",
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        /**
         * Aggressive chunk consolidation strategy.
         * Goal: reduce 148 JS files → ~20-25 for storefront cold load.
         *
         * Key insight: each HTTP request costs 500-700ms on mobile due to
         * TLS handshake + connection setup. Fewer, larger chunks = faster load.
         */
        manualChunks(id) {
          // ── 1. Framework core (react + react-dom + scheduler) ──
          if (
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules/react/") ||
            id.includes("node_modules/scheduler")
          ) {
            return "framework";
          }

          // ── 2. Router + Query + clsx + class-variance-authority + tailwind-merge ──
          // These are used on EVERY page, merge into one chunk
          if (
            id.includes("node_modules/react-router") ||
            id.includes("node_modules/@tanstack/react-query") ||
            id.includes("node_modules/clsx") ||
            id.includes("node_modules/class-variance-authority") ||
            id.includes("node_modules/tailwind-merge")
          ) {
            return "router-query";
          }

          // ── 3. Supabase client ──
          if (id.includes("node_modules/@supabase")) {
            return "supabase";
          }

          // ── 4. ALL Radix UI primitives → single chunk ──
          if (id.includes("node_modules/@radix-ui")) {
            return "radix";
          }

          // ── 5. ALL Lucide icons → single chunk ──
          if (id.includes("node_modules/lucide-react")) {
            return "icons";
          }

          // ── 6. Embla carousel (used on storefront) ──
          if (id.includes("node_modules/embla-carousel")) {
            return "embla";
          }

          // ── 7. Recharts + d3 — dashboard only, never on storefront ──
          if (id.includes("node_modules/recharts") || id.includes("node_modules/d3-")) {
            return "charts";
          }

          // ── 8. Heavy dashboard-only vendor libs ──
          if (
            id.includes("node_modules/date-fns") ||
            id.includes("node_modules/react-day-picker") ||
            id.includes("node_modules/qrcode") ||
            id.includes("node_modules/react-hook-form") ||
            id.includes("node_modules/@hookform") ||
            id.includes("node_modules/react-resizable-panels") ||
            id.includes("node_modules/input-otp") ||
            id.includes("node_modules/zod")
          ) {
            return "dash-vendor";
          }

          // ── 9. Remaining node_modules → single vendor chunk ──
          if (id.includes("node_modules/")) {
            return "vendor";
          }

          // ── 10. ALL src/components/ui/* → single "ui" chunk ──
          // These are tiny shared primitives (dialog, sheet, card, badge, etc.)
          // that each become separate 200-1500 byte files. Merge them all.
          if (id.includes("src/components/ui/")) {
            return "ui";
          }

          // ── 11. ALL src/hooks/* → single "hooks" chunk ──
          if (id.includes("src/hooks/")) {
            return "hooks";
          }

          // ── 12. ALL src/lib/* → single "lib" chunk ──
          // (utils, imageOptimize, subdomain, themeUtils, etc.)
          if (id.includes("src/lib/")) {
            return "lib";
          }

          // ── 13. ALL src/contexts/* → single "contexts" chunk ──
          if (id.includes("src/contexts/")) {
            return "contexts";
          }

          // ── 14. Shared storefront components → single chunk ──
          // (OptimizedImage, StarRating, ProductCard variants, etc.)
          if (id.includes("src/components/storefront/")) {
            // Keep lazy-loaded overlays separate (they load after initial render)
            if (
              id.includes("SideCart") ||
              id.includes("FloatingWhatsApp") ||
              id.includes("DynamicPwaManifest") ||
              id.includes("ExitIntentPopup") ||
              id.includes("SmartInstallPrompt") ||
              id.includes("StorefrontSearchOverlay") ||
              id.includes("StorefrontInstagramSection") ||
              id.includes("PwaInstallBanner")
            ) {
              return "storefront-overlays";
            }
            return "storefront-shared";
          }

          // ── 15. ALL admin pages + components → single chunk ──
          if (id.includes("src/pages/admin/") || id.includes("src/components/admin/")) {
            return "admin-pages";
          }

          // ── 16. Dashboard components (sidebar, etc.) ──
          if (
            id.includes("src/components/dashboard/") ||
            id.includes("src/components/AdminSidebar") ||
            id.includes("src/components/AppSidebar") ||
            id.includes("src/layouts/AdminLayout") ||
            id.includes("src/layouts/DashboardLayout")
          ) {
            return "dashboard-shell";
          }

          // ── 17. Storefront Shell + logic (critical path) ──
          if (
            id.includes("src/layouts/StorefrontShell") ||
            id.includes("src/layouts/StorefrontLayout.logic")
          ) {
            return "storefront-core";
          }
        },
      },
    },
  },
}));
