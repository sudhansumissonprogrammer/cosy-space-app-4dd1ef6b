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
        manualChunks(id) {
          // ── Framework core (react + react-dom) ──
          if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/")) {
            return "framework";
          }

          // ── Router + Query ──
          if (id.includes("node_modules/react-router") || id.includes("node_modules/@tanstack/react-query")) {
            return "router-query";
          }

          // ── Supabase client ──
          if (id.includes("node_modules/@supabase")) {
            return "supabase";
          }

          // ── Radix UI primitives — consolidate into ONE chunk ──
          if (id.includes("node_modules/@radix-ui")) {
            return "radix";
          }

          // ── Lucide icons — consolidate ALL icons into one chunk ──
          // Prevents 30+ individual 1KB icon files that each cost 500ms+ in latency
          if (id.includes("node_modules/lucide-react")) {
            return "icons";
          }

          // ── Embla carousel ──
          if (id.includes("node_modules/embla-carousel")) {
            return "embla";
          }

          // ── Recharts + d3 — dashboard only, keep separate to avoid storefront bloat ──
          if (id.includes("node_modules/recharts") || id.includes("node_modules/d3-")) {
            return "charts";
          }

          // ── All other node_modules — single vendor chunk ──
          // Prevents dozens of tiny chunks from class-variance-authority, clsx, cmdk, etc.
          if (id.includes("node_modules/")) {
            return "vendor";
          }
        },
      },
    },
  },
}));
