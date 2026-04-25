/**
 * LandingApp — ultra-minimal landing-only entry.
 *
 * Used INSTEAD of the full App.tsx when the user lands on `/` (or `/theme`).
 * Goal: critical-path JS includes ONLY React + react-router + landing chunk.
 *
 * Excluded vs App.tsx (~250KB+ on critical path saved):
 *   - @tanstack/react-query (QueryClient/Provider) — landing has no data
 *   - All storefront layout lazy() refs (14 themes × 2 = 28 lazy wrappers)
 *   - Subdomain/custom-domain detection
 *   - Supabase client (only loaded if user navigates to /login etc.)
 *   - DashboardProviders bundle (Auth, Toaster, TooltipProvider, Sonner)
 *   - All prewarm IIFEs that scan window.location for storefront paths
 *
 * If the user clicks Login/Signup or any non-landing path, react-router will
 * trigger a React Suspense + lazy-load of the full App.tsx via <FullApp />.
 * Result: landing render ≈ 1 chunk (Index + landing components only).
 */
import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";

// Anything beyond `/` and `/theme` falls back to the full App.
// Lazy-loaded so visiting landing alone never pays for App.tsx.
const FullApp = lazy(() => import("./AppRouterFallback"));
const ThemeShowcase = lazy(() => import("./pages/ThemeShowcase"));

/**
 * Idle prefetch: warm up the FullApp chunk after landing is fully painted.
 * Ensures clicks on Login/Signup/Pricing-internal links feel instant without
 * costing a single byte during the critical first paint.
 */
function prefetchFullAppOnIdle() {
  const start = () => {
    import("./AppRouterFallback").catch(() => {});
  };
  if ("requestIdleCallback" in window) {
    (window as any).requestIdleCallback(start, { timeout: 4000 });
  } else {
    setTimeout(start, 2500);
  }
}

const LandingApp = () => {
  useEffect(() => {
    prefetchFullAppOnIdle();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route
          path="/theme"
          element={
            <Suspense fallback={<div className="min-h-screen bg-background" />}>
              <ThemeShowcase />
            </Suspense>
          }
        />
        {/* Anything else → load the full app graph */}
        <Route
          path="*"
          element={
            <Suspense fallback={<div className="min-h-screen bg-background" />}>
              <FullApp />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  );
};

export default LandingApp;
