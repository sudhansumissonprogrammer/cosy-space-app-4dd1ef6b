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
    // Tree-shaking: ensure dead code is removed
    target: "es2020",
    cssCodeSplit: true,
      rollupOptions: {
      output: {
        manualChunks(id) {
          // Vendor chunks — split large libraries
          if (id.includes("node_modules/react-dom")) return "vendor-react";
          if (id.includes("node_modules/react/")) return "vendor-react";
          if (id.includes("node_modules/react-router")) return "vendor-router";
          if (id.includes("node_modules/@tanstack/react-query")) return "vendor-query";
          if (id.includes("node_modules/@supabase")) return "vendor-supabase";
          if (id.includes("node_modules/lucide-react")) return "vendor-icons";
          if (id.includes("node_modules/@radix-ui/react-dialog") ||
              id.includes("node_modules/@radix-ui/react-popover") ||
              id.includes("node_modules/@radix-ui/react-select")) return "vendor-ui-core";
          if (id.includes("node_modules/@radix-ui/react-dropdown") ||
              id.includes("node_modules/@radix-ui/react-tabs") ||
              id.includes("node_modules/@radix-ui/react-toast")) return "vendor-ui-extra";

          // Theme isolation: each theme layout+home → own chunk
          // Vite's dynamic import() already creates separate chunks,
          // but this ensures shared internal modules don't pull themes together
          if (id.includes("/layouts/StorefrontLayoutV") || id.includes("/pages/StorefrontHomeV")) {
            const match = id.match(/V(\d+)/);
            if (match) return `theme-${match[1]}`;
          }
        },
      },
    },
  },
}));
