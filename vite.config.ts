import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

/**
 * Emits /asset-manifest.json mapping theme number → {layout, home} chunk URLs.
 * The Cloudflare Worker reads this manifest once and injects
 * <link rel="modulepreload"> for the active theme's chunks, eliminating
 * the index.js → theme-layout → theme-home waterfall on cold loads.
 */
function themeAssetManifestPlugin(): Plugin {
  return {
    name: "theme-asset-manifest",
    apply: "build",
    generateBundle(_options, bundle) {
      const themes: Record<string, { layout?: string; home?: string }> = {};

      // Theme numbers we ship: 1 (default StorefrontHome/Layout), 2, 3, 10–19.
      // The "default" theme is named StorefrontLayout (no V suffix) and StorefrontHome.
      const layoutPattern = /(?:^|\/)StorefrontLayout(V(\d+))?(?:-[A-Za-z0-9_-]+)?\.js$/;
      const homePattern = /(?:^|\/)StorefrontHome(V(\d+))?(?:-[A-Za-z0-9_-]+)?\.js$/;

      for (const fileName of Object.keys(bundle)) {
        if (!fileName.endsWith(".js")) continue;

        const layoutMatch = fileName.match(layoutPattern);
        if (layoutMatch) {
          const v = layoutMatch[2] ? layoutMatch[2] : "1";
          themes[v] ||= {};
          themes[v].layout = "/" + fileName;
          continue;
        }

        const homeMatch = fileName.match(homePattern);
        if (homeMatch) {
          const v = homeMatch[2] ? homeMatch[2] : "1";
          themes[v] ||= {};
          themes[v].home = "/" + fileName;
        }
      }

      this.emitFile({
        type: "asset",
        fileName: "asset-manifest.json",
        source: JSON.stringify({ version: 1, themes }, null, 2),
      });
    },
  };
}

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
    themeAssetManifestPlugin(),
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
        // Stable, predictable chunk names so the asset manifest can map
        // theme number → chunk URL deterministically.
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
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

          // === Lucide icons — pure leaf SVGs, no circular risk ===
          if (id.includes("node_modules/lucide-react")) {
            return "icons";
          }

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
