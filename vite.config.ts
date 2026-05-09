import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import Beasties from "beasties";
import { compression } from "vite-plugin-compression2";
import { visualizer } from "rollup-plugin-visualizer";

/**
 * Inline critical CSS from dist/index.html and async-load the rest.
 * Runs only in production builds (post-bundle). Dev server is untouched.
 */
function beastiesPlugin() {
  return {
    name: "beasties-inline-critical",
    apply: "build" as const,
    async closeBundle() {
      const outDir = path.resolve(__dirname, "dist");
      const htmlPath = path.join(outDir, "index.html");
      if (!fs.existsSync(htmlPath)) return;
      try {
        const beasties = new Beasties({
          path: outDir,
          publicPath: "/",
          preload: "swap",
          inlineFonts: false,
          pruneSource: false,
          reduceInlineStyles: false,
          logLevel: "silent",
        });
        const html = fs.readFileSync(htmlPath, "utf8");
        const out = await beasties.process(html);
        fs.writeFileSync(htmlPath, out, "utf8");
      } catch (e) {
        console.warn("[beasties] skipped:", (e as Error).message);
      }
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
    beastiesPlugin(),
    // Brotli + gzip precompression of build assets. Cloudflare/most CDNs serve
    // .br when the client supports it → 15-25% smaller JS/CSS than gzip.
    // Build-only, zero dev impact. Threshold skips tiny files where compression
    // overhead isn't worth it.
    compression({
      algorithms: ["brotliCompress"],
      exclude: [/\.(br)$/, /\.(gz)$/],
      threshold: 1024,
      deleteOriginalAssets: false,
    }),
    compression({
      algorithms: ["gzip"],
      exclude: [/\.(br)$/, /\.(gz)$/],
      threshold: 1024,
      deleteOriginalAssets: false,
    }),
    // Bundle visualizer — emits dist/stats.html showing chunk sizes.
    // Opt-in via ANALYZE=1 env so normal builds aren't slowed down.
    process.env.ANALYZE === "1" &&
      visualizer({
        filename: "dist/stats.html",
        gzipSize: true,
        brotliSize: true,
        template: "treemap",
      }),
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
    // Disable Vite's automatic modulepreload of dynamic-import dependency
    // chunks. Without this, Vite injects <link rel="modulepreload"> for chunks
    // reached only via lazy() / import() — pulling supabase, radix, auth, etc.
    // (~150KB) onto the landing critical path even though landing never
    // executes them. The chunks still load fine on demand when navigated to.
    modulePreload: { polyfill: false, resolveDependencies: () => [] },
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

          // === Radix UI primitives ===
          // react-slot is used by Button (shipped in storefront-shell). Splitting
          // it out keeps the heavy 146KB radix chunk OFF the storefront critical
          // path — storefront-shell only needs ~1KB of slot logic.
          // Everything else (Dialog, Popover, DropdownMenu, etc.) stays in the
          // shared `radix` chunk that loads on demand when those primitives are used.
          if (id.includes("node_modules/@radix-ui/react-slot")) {
            return "radix-slot";
          }
          if (
            id.includes("node_modules/@radix-ui/react-compose-refs") ||
            id.includes("node_modules/@radix-ui/react-primitive")
          ) {
            // Tiny shared atoms used by react-slot — co-locate so storefront-shell
            // doesn't pull the big radix chunk.
            return "radix-slot";
          }
          if (id.includes("node_modules/@radix-ui")) {
            return "radix";
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

          // === App-level shared infra (v8) ===
          // Group tiny shared modules that show up on EVERY storefront page
          // into one stable chunk. v8 expands the set to absorb more micro-
          // chunks (imageOptimize, productUtils, useMetaTags, useJsonLd,
          // BackToTop, etc.) that were each becoming separate <script> tags
          // — collapsing 8-12 micro-requests into 1.
          if (
            id.includes("/src/contexts/CartContext") ||
            id.includes("/src/contexts/WishlistContext") ||
            id.includes("/src/contexts/StorefrontAuthContext") ||
            id.includes("/src/components/storefront/CheckoutAwareLayout") ||
            id.includes("/src/components/storefront/LazyRender") ||
            id.includes("/src/components/storefront/StoreTextLogo") ||
            id.includes("/src/components/storefront/BackToTop") ||
            id.includes("/src/components/ContentSkeleton") ||
            id.includes("/src/hooks/useSmartHeader") ||
            id.includes("/src/hooks/useMetaTags") ||
            id.includes("/src/hooks/useJsonLd") ||
            id.includes("/src/hooks/useStorefrontThemeConfig") ||
            id.includes("/src/lib/utils") ||
            id.includes("/src/lib/imageOptimize") ||
            id.includes("/src/lib/productUtils") ||
            id.includes("/src/lib/flyToCart") ||
            id.includes("/src/lib/prefetchProductDetail") ||
            id.includes("/src/lib/prefetchStorefrontRoutes") ||
            id.includes("/src/lib/subdomain")
          ) {
            return "storefront-shell";
          }
        },
      },
    },
  },
}));
