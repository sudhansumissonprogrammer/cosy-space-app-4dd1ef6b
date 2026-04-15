import { lazy, Suspense, useMemo, useState, useEffect, useRef, useCallback } from "react";
// Sonner moved into DashboardProviders — not needed on storefront critical path
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { getSubdomainSlug, ROOT_DOMAIN, isCustomDomainHost, isSubdomainHost } from "@/lib/subdomain";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { logError } from "@/lib/logError";

// Radix providers (Toaster + TooltipProvider) and AuthProvider are only needed
// by dashboard/admin. Lazy-loading them keeps 150KB Radix + 171KB Supabase
// chunks OFF the storefront critical path (~92KB gzip saved).
const DashboardProviders = lazy(() =>
  Promise.all([
    import("@/components/ui/toaster"),
    import("@/components/ui/tooltip"),
    import("@/contexts/AuthContext"),
    import("@/components/ui/sonner"),
  ]).then(([toasterMod, tooltipMod, authMod, sonnerMod]) => ({
    default: ({ children }: { children: React.ReactNode }) => (
      <authMod.AuthProvider>
        <tooltipMod.TooltipProvider>
          <toasterMod.Toaster />
          <sonnerMod.Toaster />
          {children}
        </tooltipMod.TooltipProvider>
      </authMod.AuthProvider>
    ),
  }))
);

// Storefront layouts — ALL lazy loaded for clean chunk isolation
const StorefrontLayout = lazy(() => import("./layouts/StorefrontLayout"));
const StorefrontLayoutV2 = lazy(() => import("./layouts/StorefrontLayoutV2"));
const StorefrontLayoutV3 = lazy(() => import("./layouts/StorefrontLayoutV3"));
const StorefrontLayoutV10 = lazy(() => import("./layouts/StorefrontLayoutV10"));
const StorefrontLayoutV11 = lazy(() => import("./layouts/StorefrontLayoutV11"));
const StorefrontLayoutV12 = lazy(() => import("./layouts/StorefrontLayoutV12"));
const StorefrontLayoutV13 = lazy(() => import("./layouts/StorefrontLayoutV13"));
const StorefrontLayoutV14 = lazy(() => import("./layouts/StorefrontLayoutV14"));
const StorefrontLayoutV15 = lazy(() => import("./layouts/StorefrontLayoutV15"));
const StorefrontLayoutV16 = lazy(() => import("./layouts/StorefrontLayoutV16"));
const StorefrontLayoutV17 = lazy(() => import("./layouts/StorefrontLayoutV17"));
const StorefrontLayoutV18 = lazy(() => import("./layouts/StorefrontLayoutV18"));

// Storefront home pages — ALL lazy loaded
const StorefrontHome = lazy(() => import("./pages/StorefrontHome"));
const StorefrontHomeV2 = lazy(() => import("./pages/StorefrontHomeV2"));
const StorefrontHomeV3 = lazy(() => import("./pages/StorefrontHomeV3"));
const StorefrontHomeV10 = lazy(() => import("./pages/StorefrontHomeV10"));
const StorefrontHomeV11 = lazy(() => import("./pages/StorefrontHomeV11"));
const StorefrontHomeV12 = lazy(() => import("./pages/StorefrontHomeV12"));
const StorefrontHomeV13 = lazy(() => import("./pages/StorefrontHomeV13"));
const StorefrontHomeV14 = lazy(() => import("./pages/StorefrontHomeV14"));
const StorefrontHomeV15 = lazy(() => import("./pages/StorefrontHomeV15"));
const StorefrontHomeV16 = lazy(() => import("./pages/StorefrontHomeV16"));
const StorefrontHomeV17 = lazy(() => import("./pages/StorefrontHomeV17"));
const StorefrontHomeV18 = lazy(() => import("./pages/StorefrontHomeV18"));
const StorefrontBestSellers = lazy(() => import("./pages/StorefrontBestSellers"));
const StorefrontShop = lazy(() => import("./pages/StorefrontShop"));
const StorefrontCategoriesPage = lazy(() => import("./pages/StorefrontCategories"));
const StorefrontContact = lazy(() => import("./pages/StorefrontContact"));
const StorefrontAboutUs = lazy(() => import("./pages/StorefrontAboutUs"));
const StorefrontReturnPolicy = lazy(() => import("./pages/StorefrontReturnPolicy"));
const StorefrontShippingPolicy = lazy(() => import("./pages/StorefrontShippingPolicy"));
const StorefrontTerms = lazy(() => import("./pages/StorefrontTerms"));
const StorefrontPrivacyPolicy = lazy(() => import("./pages/StorefrontPrivacyPolicy"));
const WishlistPage = lazy(() => import("./pages/WishlistPage"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const ProductDetailSkeleton = () => (
  <div className="mx-auto max-w-6xl px-4 py-8 space-y-4">
    <div className="h-8 w-48 rounded bg-muted/60" />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="aspect-square rounded-xl bg-muted/60" />
      <div className="space-y-4">
        <div className="h-6 w-3/4 rounded bg-muted/60" />
        <div className="h-4 w-1/2 rounded bg-muted/60" />
        <div className="h-10 w-32 rounded bg-muted/60" />
      </div>
    </div>
  </div>
);
const CategoryDetail = lazy(() => import("./pages/CategoryDetail"));
const StorefrontLogin = lazy(() => import("./pages/StorefrontLogin"));
const StorefrontSignup = lazy(() => import("./pages/StorefrontSignup"));
const StorefrontAccount = lazy(() => import("./pages/StorefrontAccount"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const InstallApp = lazy(() => import("./pages/InstallApp"));

// Auth + Admin + Dashboard — fully lazy, never loaded on storefront
const LazyAuthRoutes = lazy(() => import("./routes/AuthRoutes"));
// Landing page — standalone, no DashboardProviders needed
const LazyIndex = lazy(() => import("./pages/Index"));
const LazyThemeShowcase = lazy(() => import("./pages/ThemeShowcase"));

/**
 * Eagerly prefetch dashboard chunks so they download IN PARALLEL
 * instead of sequentially (DashboardProviders → AuthRoutes → DashboardLayout → Dashboard).
 * Called once at module load time if the URL is a dashboard/admin path.
 */
const _path = window.location.pathname;
if (_path.startsWith("/dashboard") || _path.startsWith("/admin") || _path === "/login" || _path === "/signup" || _path === "/forgot-password" || _path === "/reset-password") {
  // Fire all imports immediately — they resolve into the module cache,
  // so when React's lazy() asks for them later, they're already loaded.
  import("./routes/AuthRoutes").catch(() => {});
  import("@/contexts/AuthContext").catch(() => {});
  import("@/components/ui/toaster").catch(() => {});
  import("@/components/ui/tooltip").catch(() => {});
  import("@/components/ui/sonner").catch(() => {});
  import("@/integrations/supabase/client").catch(() => {});
  if (_path.startsWith("/dashboard")) {
    import("./layouts/DashboardLayout").catch(() => {});
    import("./pages/Dashboard").catch(() => {});
    import("@/integrations/supabase/client").catch(() => {});
  }
  if (_path.startsWith("/admin")) {
    import("./layouts/AdminLayout").catch(() => {});
    import("./pages/admin/AdminOverview").catch(() => {});
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      onError: (error: Error) => {
        logError({
          message: error.message,
          stack: error.stack,
          context: "mutation",
        });
      },
    },
  },
});

/** Route-aware loading skeleton — shows storefront skeleton only for storefront routes */
const LoadingSpinner = () => {
  const path = window.location.pathname;
  const hostname = window.location.hostname;
  const isStorefront = path.startsWith("/store/") ||
    (hostname.endsWith(".shopbanao.in") && hostname !== "shopbanao.in" && hostname !== "www.shopbanao.in") ||
    !!(window as any).__STORE_SLUG__;

  // PWA standalone mode: the native splash screen already provides visual feedback,
  // so showing a skeleton on top of it creates a jarring double-loading effect.
  // Return a blank screen and let the actual content appear directly.
  const isStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches
    || (window.navigator as any).standalone === true;
  if (isStandalone) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!isStorefront) {
    // Dashboard/admin/auth/landing — skeleton instead of black spinner
    return (
      <div className="min-h-screen bg-background animate-pulse">
        {/* Navbar skeleton */}
        <div className="sticky top-0 z-30 border-b border-border/40 bg-background">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
            <div className="h-8 w-28 rounded bg-muted/50" />
            <div className="flex-1" />
            <div className="h-8 w-20 rounded bg-muted/50" />
            <div className="h-8 w-20 rounded bg-muted/50" />
          </div>
        </div>
        {/* Hero skeleton */}
        <div className="mx-auto max-w-4xl px-4 pt-12 pb-8 text-center space-y-4">
          <div className="h-5 w-40 mx-auto rounded bg-muted/40" />
          <div className="h-10 w-3/4 mx-auto rounded bg-muted/40" />
          <div className="h-10 w-1/2 mx-auto rounded bg-muted/40" />
          <div className="h-5 w-2/3 mx-auto rounded bg-muted/30" />
          <div className="flex justify-center gap-3 pt-4">
            <div className="h-12 w-40 rounded-lg bg-muted/50" />
            <div className="h-12 w-32 rounded-lg bg-muted/30" />
          </div>
        </div>
      </div>
    );
  }

  // Storefront — render a lightweight skeleton so users see content structure
  // while lazy layout/page chunks download. Previously returned null which
  // caused a blank screen because React already replaced the index.html skeleton.
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <div className="h-10 w-10 rounded-lg bg-muted/60" />
          <div className="h-10 w-24 rounded-lg bg-muted/60" />
          <div className="flex-1" />
          <div className="h-9 w-9 rounded-full bg-muted/60" />
          <div className="h-9 w-9 rounded-full bg-muted/60" />
        </div>
      </div>
      <div className="w-full bg-muted/60" style={{ aspectRatio: "16/7" }} />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0,1,2,3].map(i => (
            <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="w-full bg-muted/60" style={{ aspectRatio: "4/5" }} />
              <div className="p-2.5 space-y-2">
                <div className="h-3 w-16 rounded bg-muted/60" />
                <div className="h-4 w-full rounded bg-muted/60" />
                <div className="h-4 w-20 rounded bg-muted/60" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const OrderTrackingPage = lazy(() => import("./pages/OrderTrackingPage"));
const StorefrontCustomPage = lazy(() => import("./pages/StorefrontCustomPage"));

/** Shared child routes for all layout themes */
const storefrontChildRoutes = (theme: string) => {
  // V11 re-exports V3 exactly — map directly to avoid double lazy chunk
  const HomeComponent = theme === "theme-18" ? StorefrontHomeV18 : theme === "theme-17" ? StorefrontHomeV17 : theme === "theme-16" ? StorefrontHomeV16 : theme === "theme-15" ? StorefrontHomeV15 : theme === "theme-14" ? StorefrontHomeV14 : theme === "theme-13" ? StorefrontHomeV13 : theme === "theme-12" ? StorefrontHomeV12 : theme === "theme-11" ? StorefrontHomeV3 : theme === "theme-10" ? StorefrontHomeV10 : theme === "theme-3" ? StorefrontHomeV3 : theme === "theme-2" ? StorefrontHomeV2 : StorefrontHome;
  return (
    <>
      <Route index element={<HomeComponent />} />
      <Route path="shop" element={<StorefrontShop />} />
      <Route path="best-sellers" element={<StorefrontBestSellers />} />
      <Route path="categories" element={<StorefrontCategoriesPage />} />
      <Route path="contact" element={<StorefrontContact />} />
      <Route path="about" element={<StorefrontAboutUs />} />
      <Route path="return-policy" element={<StorefrontReturnPolicy />} />
      <Route path="shipping-policy" element={<StorefrontShippingPolicy />} />
      <Route path="terms" element={<StorefrontTerms />} />
      <Route path="privacy-policy" element={<StorefrontPrivacyPolicy />} />
      <Route path="category/:categorySlug" element={<CategoryDetail />} />
      <Route path="product/:productSlug" element={<Suspense fallback={<ProductDetailSkeleton />}><ProductDetail /></Suspense>} />
      <Route path="cart" element={<CartPage />} />
      <Route path="wishlist" element={<WishlistPage />} />
      <Route path="checkout" element={<CheckoutPage />} />
      <Route path="login" element={<StorefrontLogin />} />
      <Route path="signup" element={<StorefrontSignup />} />
      <Route path="account" element={<StorefrontAccount />} />
      <Route path="install" element={<InstallApp />} />
      <Route path="track-order" element={<OrderTrackingPage />} />
      <Route path="page/:pageSlug" element={<StorefrontCustomPage />} />
    </>
  );
};

/**
 * Get the theme instantly from injected data or localStorage cache.
 * This avoids needing a full API call just to determine which layout to render.
 */
function getInstantTheme(slug: string | undefined): string {
  if (!slug) return "theme-1";

  // 1. Check Cloudflare Worker injected data (instant, no API call)
  const injected = (window as any).__STOREFRONT_DATA__;
  if (injected?.store?.theme) {
    return injected.store.theme;
  }

  // 2. Check localStorage cache (instant, from previous visit)
  try {
    const cached = localStorage.getItem(`storefront_theme_${slug}`);
    if (cached) return cached;
  } catch {}

  return "theme-1";
}

function getLayoutComponent(theme: string) {
  switch (theme) {
    case "theme-18": return StorefrontLayoutV18;
    case "theme-17": return StorefrontLayoutV17;
    case "theme-16": return StorefrontLayoutV16;
    case "theme-15": return StorefrontLayoutV15;
    case "theme-14": return StorefrontLayoutV14;
    case "theme-13": return StorefrontLayoutV13;
    case "theme-12": return StorefrontLayoutV12;
    case "theme-11": return StorefrontLayoutV11;
    case "theme-10": return StorefrontLayoutV10;
    case "theme-3": return StorefrontLayoutV3;
    case "theme-2": return StorefrontLayoutV2;
    default: return StorefrontLayout;
  }
}

/**
 * Renders storefront directly using cached/injected theme — NO spinner, NO waterfall.
 * The layout itself handles data fetching and shows its own skeleton if needed.
 */
/**
 * Prefetch storefront data immediately so it loads IN PARALLEL with layout/home chunks.
 * Without this, the waterfall is: layout chunk → API call → home chunk (serial).
 * With this, all three start simultaneously.
 */
function usePrefetchStorefrontData(slug: string | undefined) {
  const queryClient = useQueryClient();
  const prefetched = useRef(false);

  useEffect(() => {
    if (!slug || prefetched.current) return;
    // Don't prefetch if index.html prefetch already provided data or is in flight
    if ((window as any).__STOREFRONT_DATA__?.store) return;
    if ((window as any).__STOREFRONT_PREFETCH__) return;
    // Don't prefetch if already in cache
    if (queryClient.getQueryData(["storefront-bulk", slug])) return;

    prefetched.current = true;
    queryClient.prefetchQuery({
      queryKey: ["storefront-bulk", slug],
      queryFn: async () => {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data, error } = await supabase.rpc("get_storefront_shell" as any, {
          _slug: slug,
        });
        if (error) throw error;

        // 🚀 As soon as store data arrives, start prefetching target page data
        // This runs IN the queryFn so it fires immediately, not after React re-renders
        const storeId = (data as any)?.store?.id;
        if (storeId) {
          prefetchTargetPageData(queryClient, storeId, window.location.pathname);
        }

        return data;
      },
      staleTime: 2 * 60 * 1000,
    });
  }, [slug, queryClient]);
}

/** Start fetching target page data immediately when store ID is known */
async function prefetchTargetPageData(
  queryClient: ReturnType<typeof useQueryClient>,
  storeId: string,
  path: string
) {
  const { supabase } = await import("@/integrations/supabase/client");
  const isUUID = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

  // Product page: /product/:slug
  const productMatch = path.match(/\/product\/([^/]+)/);
  if (productMatch) {
    const productSlug = decodeURIComponent(productMatch[1]);
    if (!queryClient.getQueryData(["storefront-product", storeId, productSlug])) {
      queryClient.prefetchQuery({
        queryKey: ["storefront-product", storeId, productSlug],
        queryFn: async () => {
          let { data: prod, error } = await supabase
            .from("products")
            .select("*")
            .eq("store_id", storeId)
            .eq("slug", productSlug)
            .eq("is_active", true)
            .maybeSingle();
          if (!prod && !error) {
            if (!isUUID(productSlug)) return prod;
            const result = await supabase
              .from("products")
              .select("*")
              .eq("store_id", storeId)
              .eq("id", productSlug)
              .eq("is_active", true)
              .maybeSingle();
            prod = result.data;
          }
          if (prod) {
            await Promise.allSettled([
              queryClient.prefetchQuery({
                queryKey: ["product-images", prod.id],
                queryFn: async () => {
                  const { data: imgs } = await supabase
                    .from("product_images")
                    .select("id, image_url, display_order")
                    .eq("product_id", prod.id)
                    .order("display_order");
                  return imgs ?? [];
                },
                staleTime: 5 * 60 * 1000,
              }),
              queryClient.prefetchQuery({
                queryKey: ["product-variants", prod.id],
                queryFn: async () => {
                  const { data: vars } = await supabase
                    .from("product_variants")
                    .select("id, name, price, sku, stock_quantity, display_order")
                    .eq("product_id", prod.id)
                    .eq("is_active", true)
                    .order("display_order");
                  return vars ?? [];
                },
                staleTime: 5 * 60 * 1000,
              }),
            ]);
          }
          return prod;
        },
        staleTime: 2 * 60 * 1000,
      });
    }
    return;
  }

  // Category page: /category/:categorySlug
  const categoryMatch = path.match(/\/category\/([^/]+)/);
  if (categoryMatch) {
    const catSlug = decodeURIComponent(categoryMatch[1]);
    if (!queryClient.getQueryData(["category", storeId, catSlug])) {
      queryClient.prefetchQuery({
        queryKey: ["category", storeId, catSlug],
        queryFn: async () => {
          const { data: cat, error } = await supabase
            .from("categories")
            .select("*")
            .eq("store_id", storeId)
            .eq("slug", catSlug)
            .maybeSingle();
          if (error) throw error;
          if (cat) {
            queryClient.prefetchInfiniteQuery({
              queryKey: ["category-products", storeId, cat.name],
              queryFn: async ({ pageParam = 0 }) => {
                const from = pageParam * 14;
                const to = from + 13;
                const { data: prods, error: pErr } = await supabase
                  .from("products")
                  .select("id,category,cost_price,created_at,currency,description,image_url,is_active,is_best_selling,name,price,sale_price,sku,slug,stock_quantity,store_id,updated_at")
                  .eq("store_id", storeId)
                  .eq("category", cat.name)
                  .eq("is_active", true)
                  .order("created_at", { ascending: false })
                  .order("id", { ascending: true })
                  .range(from, to);
                if (pErr) throw pErr;
                return { products: prods ?? [], page: pageParam };
              },
              initialPageParam: 0,
              staleTime: 2 * 60 * 1000,
            });
          }
          return cat;
        },
        staleTime: 5 * 60 * 1000,
      });
    }
    return;
  }

  // Shop page: /shop
  if (/\/shop\/?$/.test(path)) {
    queryClient.prefetchInfiniteQuery({
      queryKey: ["storefront-shop-all", storeId],
      queryFn: async ({ pageParam = 0 }) => {
        const from = pageParam * 14;
        const to = from + 13;
        const { data: prods, error } = await supabase
          .from("products")
          .select("id,category,cost_price,created_at,currency,description,image_url,is_active,is_best_selling,name,price,sale_price,sku,slug,stock_quantity,store_id,updated_at")
          .eq("store_id", storeId)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to);
        if (error) throw error;
        return { products: prods ?? [], page: pageParam };
      },
      initialPageParam: 0,
      staleTime: 2 * 60 * 1000,
    });
  }
}

/** Eagerly start loading the home page chunk so it downloads alongside the layout */
function prefetchHomeChunk(theme: string) {
  switch (theme) {
    case "theme-18": return import("./pages/StorefrontHomeV18");
    case "theme-17": return import("./pages/StorefrontHomeV17");
    case "theme-16": return import("./pages/StorefrontHomeV16");
    case "theme-15": return import("./pages/StorefrontHomeV15");
    case "theme-14": return import("./pages/StorefrontHomeV14");
    case "theme-13": return import("./pages/StorefrontHomeV13");
    case "theme-12": return import("./pages/StorefrontHomeV12");
    case "theme-11": return import("./pages/StorefrontHomeV3"); // V11 = V3
    case "theme-10": return import("./pages/StorefrontHomeV10");
    case "theme-3": return import("./pages/StorefrontHomeV3");
    case "theme-2": return import("./pages/StorefrontHomeV2");
    default: return import("./pages/StorefrontHome");
  }
}

/** Eagerly prefetch the chunk for the page the user is landing on */
function prefetchTargetPageChunk(path: string) {
  // Product page
  if (/\/product\//.test(path)) {
    import("./pages/ProductDetail").catch(() => {});
    return;
  }
  // Category page
  if (/\/category\//.test(path)) {
    import("./pages/CategoryDetail").catch(() => {});
    return;
  }
  // Shop page
  if (/\/shop\/?$/.test(path)) {
    import("./pages/StorefrontShop").catch(() => {});
    return;
  }
  // Cart page
  if (/\/cart\/?$/.test(path)) {
    import("./pages/CartPage").catch(() => {});
    return;
  }
}

function ThemeAwareStorefront({ slugOverride }: { slugOverride?: string }) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const pathSlug = !slugOverride ? location.pathname.split("/store/")[1]?.split("/")[0] : undefined;
  const effectiveSlug = slugOverride || pathSlug;

  // Start with cached/injected theme instantly (no spinner)
  const [theme, setTheme] = useState(() => getInstantTheme(effectiveSlug));
  const themeRef = useRef(theme);
  const routePrefetchKeyRef = useRef("");
  themeRef.current = theme;

  const startRoutePrefetch = useCallback((storeId?: string | null) => {
    if (!storeId) return;
    const prefetchKey = `${storeId}:${location.pathname}`;
    if (routePrefetchKeyRef.current === prefetchKey) return;
    routePrefetchKeyRef.current = prefetchKey;
    prefetchTargetPageData(queryClient, storeId, location.pathname);
  }, [location.pathname, queryClient]);

  // 🚀 KEY OPTIMIZATION: Start data fetch IMMEDIATELY, in parallel with chunk loading
  usePrefetchStorefrontData(effectiveSlug);

  useEffect(() => {
    const cachedBulk = effectiveSlug
      ? (queryClient.getQueryData(["storefront-bulk", effectiveSlug]) as any)
      : undefined;
    startRoutePrefetch((window as any).__STOREFRONT_DATA__?.store?.id || cachedBulk?.store?.id);
  }, [effectiveSlug, queryClient, startRoutePrefetch]);

  // 🚀 Eagerly start loading the TARGET page chunk (not just home)
  const chunkStarted = useRef(false);
  if (!chunkStarted.current) {
    chunkStarted.current = true;
    const path = window.location.pathname;
    // If landing on home, prefetch home chunk; otherwise prefetch target page chunk
    const isHomePage = path === "/" || /\/store\/[^/]+\/?$/.test(path);
    if (isHomePage) {
      prefetchHomeChunk(theme).catch(() => {});
    } else {
      prefetchTargetPageChunk(path);
      // Also prefetch home chunk at lower priority for back navigation
      requestIdleCallback?.(() => prefetchHomeChunk(theme).catch(() => {}));
    }
  }

  // Subscribe to query cache — when fresh data arrives with a different theme, switch instantly
  useEffect(() => {
    if (!effectiveSlug) return;
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.query?.queryKey?.[0] === "storefront-bulk" && event?.query?.queryKey?.[1] === effectiveSlug) {
        const freshData = event.query.state.data as any;
        startRoutePrefetch(freshData?.store?.id);
        const freshTheme = freshData?.store?.theme;
        if (freshTheme && freshTheme !== themeRef.current) {
          setTheme(freshTheme);
          themeRef.current = freshTheme;
          try { localStorage.setItem(`storefront_theme_${effectiveSlug}`, freshTheme); } catch {}
        }
      }
    });
    return unsubscribe;
  }, [effectiveSlug, queryClient, startRoutePrefetch]);

  const basePath = slugOverride ? "/" : "/store/:slug";
  const LayoutComponent = getLayoutComponent(theme);

  return (
    <Routes>
      <Route path={basePath} element={<LayoutComponent slugOverride={slugOverride} />}>
        {storefrontChildRoutes(theme)}
      </Route>
    </Routes>
  );
}

function CustomDomainNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background px-4 text-center">
      <h1 className="text-2xl font-semibold text-foreground">Store not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        This domain is not connected to an active storefront yet.
      </p>
    </div>
  );
}

/**
 * Detects if the current hostname is a custom domain and resolves slug from DB.
 */
function useCustomDomainSlug() {
  const [slug, setSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const attempted = useRef(false);
  const hostname = window.location.hostname;
  const customHost = isCustomDomainHost(hostname);

  useEffect(() => {
    if (!customHost || attempted.current) return;

    attempted.current = true;
    setLoading(true);

    const normalizedDomain = hostname.replace(/^www\./, "").toLowerCase();
    const domainCandidates = [normalizedDomain, `www.${normalizedDomain}`];

    let cancelled = false;

    import("@/integrations/supabase/client").then(async ({ supabase }) => {
      try {
        const sources = ["stores_public", "stores"];

        for (const source of sources) {
          for (const domain of domainCandidates) {
            const { data, error } = await (supabase as any)
              .from(source)
              .select("slug")
              .eq("custom_domain", domain)
              .limit(1);

            if (!error && data?.[0]?.slug) {
              if (!cancelled) {
                (window as any).__STORE_SLUG__ = data[0].slug;
                setSlug(data[0].slug);
              }
              return;
            }
          }
        }
      } catch {
        // noop: leave slug as null and show not-found for custom hosts
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [customHost, hostname]);

  return { slug, loading, isCustomDomain: customHost };
}

function AppRouter() {
  const location = useLocation();
  const subdomainSlug = getSubdomainSlug();
  const { slug: customDomainSlug, loading: customDomainLoading, isCustomDomain } = useCustomDomainSlug();

  // ── STOREFRONT: Subdomain (slug.shopbanao.in) ──
  if (subdomainSlug) {
    return <ThemeAwareStorefront slugOverride={subdomainSlug} />;
  }

  // ── STOREFRONT: Custom domain resolved from DB (safety net) ──
  if (customDomainSlug) {
    return <ThemeAwareStorefront slugOverride={customDomainSlug} />;
  }

  // ── STOREFRONT: Custom domain — NEVER fall through to auth routes ──
  // This is the critical guard: custom domains must always resolve to
  // storefront or show "not found" — never show login/dashboard.
  if (isCustomDomain) {
    if (customDomainLoading) {
      return <LoadingSpinner />;
    }
    return <CustomDomainNotFound />;
  }

  // ── STOREFRONT: Path-based (/store/:slug) ──
  if (location.pathname.startsWith("/store/")) {
    const hostname = window.location.hostname;
    const isProduction = hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`;

    // Skip subdomain redirect when loaded inside the dashboard preview iframe.
    // Persist preview mode across in-iframe navigation so mobile menu / nav links
    // don't lose the preview flag and get redirected to the live subdomain.
    const searchParams = new URLSearchParams(window.location.search);
    let isEmbeddedFrame = false;
    try {
      isEmbeddedFrame = window.self !== window.top;
    } catch {
      isEmbeddedFrame = true;
    }

    if (searchParams.has("preview")) {
      try {
        sessionStorage.setItem("__store_preview_embed__", "1");
      } catch {}
    } else if (!isEmbeddedFrame) {
      try {
        sessionStorage.removeItem("__store_preview_embed__");
      } catch {}
    }

    let hasPreviewSession = false;
    try {
      hasPreviewSession = sessionStorage.getItem("__store_preview_embed__") === "1";
    } catch {}

    const isPreviewEmbed = searchParams.has("preview") || (isEmbeddedFrame && hasPreviewSession);

    if (isProduction && !isPreviewEmbed) {
      const rest = location.pathname.replace(/^\/store\//, "");
      const slug = rest.split("/")[0];
      const remainingPath = rest.slice(slug.length);
      const search = window.location.search;
      const hash = window.location.hash;
      window.location.replace(`https://${slug}.${ROOT_DOMAIN}${remainingPath}${search}${hash}`);
      return <LoadingSpinner />;
    }

    return <ThemeAwareStorefront />;
  }

  // ── LANDING PAGE: Render directly without DashboardProviders ──
  // This avoids loading AuthProvider (171KB Supabase) + Radix UI (150KB)
  // just to show the marketing landing page.
  if (location.pathname === "/" || location.pathname === "/theme") {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        {location.pathname === "/theme" ? <LazyThemeShowcase /> : <LazyIndex />}
      </Suspense>
    );
  }

  // ── AUTH/DASHBOARD: Only reachable on root domain, preview, or localhost ──
  // DashboardProviders includes AuthProvider + Radix Toaster + TooltipProvider
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <DashboardProviders>
        <LazyAuthRoutes />
      </DashboardProviders>
    </Suspense>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<LoadingSpinner />}>
          <ErrorBoundary fallbackMessage="This page encountered an error">
            <AppRouter />
          </ErrorBoundary>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
