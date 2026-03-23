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
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
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
        manualChunks(id: string) {
          // ── Vendor splits ──
          if (id.includes("node_modules")) {
            if (id.includes("react-dom")) return "vendor-react";
            if (id.includes("/react/")) return "vendor-react";
            if (id.includes("react-router-dom")) return "vendor-router";
            if (id.includes("@tanstack/react-query")) return "vendor-query";
            if (id.includes("@supabase/supabase-js")) return "vendor-supabase";
            if (id.includes("lucide-react")) return "vendor-icons";
            if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
            if (id.includes("embla-carousel")) return "vendor-carousel";
            if (id.includes("@radix-ui/react-dialog") || id.includes("@radix-ui/react-popover") || id.includes("@radix-ui/react-select"))
              return "vendor-ui-core";
            if (id.includes("@radix-ui/react-dropdown-menu") || id.includes("@radix-ui/react-tabs") || id.includes("@radix-ui/react-toast"))
              return "vendor-ui-extra";
            if (id.includes("@radix-ui/")) return "vendor-ui-misc";
            return undefined;
          }

          // ── Per-theme chunks (each theme gets its own bundle) ──
          const themeMatch = id.match(/Storefront(?:Layout|Home)(V\d+)\./);
          if (themeMatch) {
            return `theme-${themeMatch[1].replace("V", "")}`;
          }
          // Default storefront layout/home (theme-1, no suffix)
          if (id.includes("/StorefrontLayout.tsx") || id.includes("/StorefrontHome.tsx")) {
            return "theme-1";
          }

          // ── Route-based splits ──
          if (id.includes("/pages/admin/") || id.includes("/layouts/AdminLayout")) return "route-admin";
          if (id.includes("/pages/Dashboard") || id.includes("/layouts/DashboardLayout") || id.includes("/pages/StoreSettings") || id.includes("/pages/ProductsList") || id.includes("/pages/StoreOrders"))
            return "route-dashboard";

          return undefined;
        },
      },
    },
  },
}));
