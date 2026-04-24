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
          // v7.8: Aggressively cache hashed /assets/* (JS + CSS chunks)
          // Filenames are content-hashed so they're immutable. CacheFirst means
          // returning visitors hit local cache → ZERO Cloudflare Worker events.
          {
            urlPattern: /\/assets\/.*\.(?:js|css|woff2)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
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
         * Cycle-safe chunk strategy.
         * Rules:
         *   - Only group pure leaf node_modules (no app code imports)
         *   - Never group modules that re-export from each other
         *   - lucide icons are pure SVG factories → safe to merge
         *   - recharts/d3 only used by dashboard → safe isolated chunk
         *   - embla only used by storefront carousels → safe isolated chunk
         */
        manualChunks(id) {
          // === Core framework (React) ===
          if (
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules/react/") ||
            id.includes("node_modules/scheduler")
          ) {
            return "framework";
          }

          // === Routing + data fetching ===
          if (
            id.includes("node_modules/react-router") ||
            id.includes("node_modules/@tanstack/react-query")
          ) {
            return "router-query";
          }

          // === Supabase client ===
          if (id.includes("node_modules/@supabase")) {
            return "supabase";
          }

          // === Radix UI primitives — SPLIT (storefront vs dashboard) ===
          // Strategy: dashboard-only widget primitives go to `radix-dashboard`.
          // Everything else (storefront widgets + shared internals like
          // react-roving-focus, react-collection, react-presence, react-portal,
          // react-focus-scope, etc.) goes to `radix-storefront` so the storefront
          // chunk is self-contained and never has to fetch the dashboard chunk.
          // react-slot is used by Button (everywhere) → put it in storefront chunk.
          if (id.includes("node_modules/@radix-ui/react-slot")) {
            return "radix-storefront";
          }
          if (id.includes("node_modules/@radix-ui")) {
            // Dashboard-only widget primitives. Storefront pages NEVER import these.
            const dashboardOnly = [
              "react-dropdown-menu",
              "react-context-menu",
              "react-menubar",
              "react-navigation-menu",
              "react-select",
              "react-popover",
              "react-tooltip",
              "react-accordion",
              "react-alert-dialog",
              "react-avatar",
              "react-checkbox",
              "react-radio-group",
              "react-switch",
              "react-slider",
              "react-scroll-area",
              "react-hover-card",
              "react-toggle",
              "react-toggle-group",
              "react-aspect-ratio",
              "react-toast",
            ];
            if (dashboardOnly.some((pkg) => id.includes(`@radix-ui/${pkg}/`))) {
              return "radix-dashboard";
            }
            // Storefront widgets + all shared internals (atoms used by both buckets)
            return "radix-storefront";
          }

          // === Lucide icons — CONSOLIDATED (v7.8) ===
          // Reverted per-icon splitting: each icon was a separate ~1KB chunk
          // = separate Cloudflare Worker invocation = paid observability event.
          // ~30 icons × every page = 30 worker hits. Bundling into 1 ~25KB gz
          // chunk = 1 worker hit, cached forever. Net: -29 events per pageview.
          if (id.includes("node_modules/lucide-react")) {
            return "icons";
          }

          // === Form utilities ===
          if (
            id.includes("node_modules/react-hook-form") ||
            id.includes("node_modules/@hookform") ||
            id.includes("node_modules/zod")
          ) {
            return "forms";
          }

          // === App-level shared infra (v7.8) ===
          // Group tiny shared modules that show up on EVERY storefront page
          // into one stable chunk to collapse 5-8 micro-requests into 1.
          // These are imported by the layout shell and never change per-route.
          if (
            id.includes("/src/contexts/CartContext") ||
            id.includes("/src/contexts/WishlistContext") ||
            id.includes("/src/contexts/StorefrontAuthContext") ||
            id.includes("/src/components/storefront/CheckoutAwareLayout") ||
            id.includes("/src/components/storefront/LazyRender") ||
            id.includes("/src/components/storefront/StoreTextLogo") ||
            id.includes("/src/components/ContentSkeleton") ||
            id.includes("/src/hooks/useSmartHeader") ||
            id.includes("/src/lib/utils")
          ) {
            return "storefront-shell";
          }
        },
      },
    },
  },
}));
