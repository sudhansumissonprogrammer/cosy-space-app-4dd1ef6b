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

          // === Radix UI primitives (exclude tiny react-slot to avoid pulling ===
          // === the entire chunk via Button → ErrorBoundary on every page)    ===
          if (
            id.includes("node_modules/@radix-ui") &&
            !id.includes("react-slot")
          ) {
            return "radix";
          }

          // === Lucide icons ===
          // NOTE: Previously grouped into "icons" chunk (~55KB) — this forced
          // every storefront cold load to download the full icon library even
          // though StorefrontNotFound only uses one icon. Letting Vite split
          // per-route allows tree-shaking: each page only ships the ~3-5 icons
          // it actually uses (saves ~50KB raw / ~10KB gz on cold load).

          // Charts (recharts/d3) left to Vite's default splitting
          // to avoid circular dep with framework chunk

          // === Form utilities ===
          if (
            id.includes("node_modules/react-hook-form") ||
            id.includes("node_modules/@hookform") ||
            id.includes("node_modules/zod")
          ) {
            return "forms";
          }
        },
      },
    },
  },
}));
