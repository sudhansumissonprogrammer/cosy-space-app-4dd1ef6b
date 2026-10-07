import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import Beasties from "beasties";
import { compression } from "vite-plugin-compression2";
import { visualizer } from "rollup-plugin-visualizer";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

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
    mcpPlugin(),
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
      includeAssets: ["pwa-192x192.png", "pwa-512x512.png"],
      manifest: {
        name: "ShopBanao — Online Store",
        short_name: "ShopBanao",
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
        // Pull in push notification handlers (push + notificationclick)
        // so store owners get instant order alerts on their PWA.
        importScripts: ["/sw-push.js"],
        // CRITICAL: do NOT precache the whole build. Previously globPatterns
        // pulled every JS/CSS/font/PNG into the SW install step (>1MB) and
        // those background downloads competed with the landing page's
        // critical paint resources — pushing FCP from ~1s to ~8s on first
        // visit. Runtime caching rules below already handle on-demand
        // CacheFirst for /assets/*. SW now only precaches the manifest,
        // favicon, and the two PWA icons that `includeAssets` declares.
        globPatterns: ["index.html", "manifest.webmanifest"],
        // Skip precache integrity check on third-party fonts/images that may
        // legitimately not be in the build output.
        navigationPreload: true,
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
          // Cache the Worker edge API responses (PDP + category payloads).
          // StaleWhileRevalidate: serve from SW cache instantly, refresh in
          // background so PWA users get near-zero latency on repeat visits.
          {
            urlPattern: ({ url }) => /\/api\/(pdp|category)(\?|$)/.test(url.pathname + url.search),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "edge-api",
              expiration: { maxEntries: 80, maxAgeSeconds: 5 * 60 },
              cacheableResponse: { statuses: [0, 200] },
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
          // === Entry-only helpers ===
          // NOTE: ErrorBoundary + logError + the shopbanao logo asset are
          // imported by BOTH landing and storefront code. Left unassigned,
          // Rollup folded them into `landing-shell`, so every storefront page
          // downloaded that 8KB chunk in the critical wave purely to read
          // three shared symbols. Pinning them to `entry-utils` — a chunk both
          // apps already load from main.tsx — removes that extra request.
          if (
            id.includes("/src/lib/subdomain") ||
            id.includes("/src/lib/chunkLoadRecovery") ||
            id.includes("/src/components/ErrorBoundary") ||
            id.includes("/src/lib/logError") ||
            id.includes("/src/assets/shopbanao-logo") ||
            id.includes("vite/preload-helper")
          ) {
            return "entry-utils";
          }


          // === Landing above-the-fold shell ===
          // Navbar + Hero are statically imported by src/pages/Index.tsx but
          // Rollup was still splitting them into separate chunks → above-the-fold
          // header waited ~2s for an extra round trip on cold mobile loads.
          // Bundle LandingApp + Index + Navbar + Hero + ErrorBoundary +
          // shopbanao-logo asset into ONE `landing-shell` chunk so first paint
          // happens after ONE script download instead of four.
          if (
            id.includes("/src/LandingApp") ||
            id.includes("/src/pages/Index.tsx") ||
            id.includes("/src/components/landing/Navbar") ||
            id.includes("/src/components/landing/Hero") ||
            id.includes("/src/components/landing/LazyMount")
            // NOTE: /src/assets/shopbanao-logo intentionally REMOVED from this
            // group (v8.9). The logo is imported by StorefrontFooter,
            // CheckoutPage, and V22CheckoutPage for the "Powered by Storivo"
            // badge on EVERY storefront page. When the logo's tiny URL-module
            // lived in landing-shell, every storefront cold load pulled the
            // entire landing-shell chunk (LandingApp + Index + Navbar + Hero,
            // 7KB but 1+ extra round trip) just to read the logo URL — measured
            // as a ~1.5s FCP regression on imitationworld cold mobile loads.
            // Letting Rollup auto-place the asset module puts it in a tiny
            // standalone chunk shared by both landing and storefront builds.
          ) {
            return "landing-shell";
          }

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

          // === PDP critical path (v8.84) ===
          // NOTE: a `pdp-core` manual chunk used to live here (v8.82) folding
          // ProductDetail.tsx + VideoSlide + PackagingSelector + helpers into
          // one file. It created a CIRCULAR chunk dependency with
          // `storefront-shell` (shell imports pdp helpers, pdp-core imports
          // shell), which crashed every product page at module-eval time with
          // "Cannot access 'mn' before initialization" (TDZ) — a white screen
          // on 100% of PDP loads. Do NOT reintroduce a manual chunk that
          // contains a route component; let Rollup derive the route chunk.


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
            // NOTE: /src/lib/subdomain is intentionally NOT here.
            // main.tsx imports subdomain for host detection. If subdomain
            // lives in the storefront-shell chunk, Rollup makes the entry
            // statically import storefront-shell, which transitively pulls
            // supabase + radix + router-query + icons (~245KB) onto the
            // landing critical path. Keeping subdomain out → entry stays lean.
            id.includes("/src/hooks/useProductCardActions") ||
            id.includes("/src/components/storefront/StarRating") ||
            id.includes("/src/components/storefront/SectionHeading") ||
            id.includes("/src/components/storefront/OptimizedImage") ||
            id.includes("/src/components/storefront/PageTransition") ||
            id.includes("/src/components/storefront/StorefrontTrustStrip") ||
            id.includes("/src/components/storefront/ScrollProgressBar") ||
            // v8.4 — absorb the universal product card + variant counts +
            // marquee + categories into storefront-shell. Saves ~5 round trips
            // on cold load (each was a ~1-2KB chunk that spawned its own
            // <script> + Worker hit).
            id.includes("/src/components/storefront/UniversalProductCard") ||
            id.includes("/src/components/storefront/UniversalCategories") ||
            id.includes("/src/components/storefront/StorefrontMarquee") ||
            id.includes("/src/components/storefront/StorefrontMobileHero") ||
            id.includes("/src/hooks/useVariantCounts") ||
            id.includes("/src/hooks/useStorefrontProducts") ||
            id.includes("/src/hooks/useFacebookPixel") ||
            // Keep the dominant V1 layout critical, but let Rollup split
            // homepage routes and V16 naturally: category/PDP entry must
            // not download homepage-only sections or an inactive theme.
            id.includes("/src/layouts/StorefrontLayout.tsx") ||
            id.includes("/src/layouts/StorefrontLayout.logic") ||
            // NOTE: match the bare classic file only — NOT the variants.
            // Variants (Modern/Glass/Notch/Neon/Tube/Bubble/3D/Indicator/V15/V17)
            // are now lazy() inside MobileBottomNavSwitcher so each store ships
            // only the variant it selected (~5-10KB instead of ~70KB for all 11).
            id.includes("/src/components/storefront/MobileBottomNav.tsx") ||
            id.includes("/src/components/storefront/MobileBottomNavSwitcher.tsx") ||
            id.includes("/src/components/storefront/HeroBannerCarousel") ||
            id.includes("/src/components/storefront/MobileHeroCarousel") ||
            // v8.6 — absorb shadcn Sheet primitive into storefront-shell.
            // Sheet is used by HamburgerMenu, SideCart, MobileAppHeader,
            // StorefrontLayoutV2, and ShopFilterBar (filter drawer on
            // category page). When it lives in its own micro-chunk, a
            // CDN race condition during deploy can return 503 → React
            // lazy-load throws "Cannot read properties of undefined
            // (reading 'default')" → ErrorBoundary shows white error
            // screen on category/menu pages. Bundling into shell makes
            // it deploy atomically with the rest of the storefront.
            id.includes("/src/components/ui/sheet") ||
            // v8.7 — HamburgerMenu + Dialog primitive were each shipping as
            // tiny separate chunks (1-2KB) that waterfalled to 2.7-3s on cold
            // mobile loads (each = its own HTTP round trip after parent chunk
            // parse). HamburgerMenu is rendered on every storefront page via
            // CheckoutAwareLayout, and Dialog is used by PDP, SideCart, and
            // multiple storefront pages — both are guaranteed to load on first
            // visit, so co-locating into storefront-shell saves 2 round trips
            // with zero downside.
            id.includes("/src/components/storefront/HamburgerMenu") ||
            id.includes("/src/components/ui/dialog") ||
            // v8.8 — absorb shadcn ui/card + ui/input + useCanonical into
            // storefront-shell. Real-device cold profile showed these as
            // separate micro-chunks each waiting 1.0-1.7s for parent chunk
            // parse → 3 serial round trips on cold mobile (~600-900ms FCP
            // cost on imitationworld). ui/card used in 73 files, ui/input
            // in 57 (every header search bar), useCanonical in every SEO
            // page — all guaranteed first-paint. Adds ~3KB to shell, saves
            // 3 round trips. ui/alert-dialog kept separate (only 12 files,
            // mostly admin/checkout edge — not on home/PDP critical path).
            id.includes("/src/components/ui/card") ||
            id.includes("/src/components/ui/input") ||
            id.includes("/src/hooks/useCanonical")
          ) {
            return "storefront-shell";
          }
        },
      },
    },
  },
}));
