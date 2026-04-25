/**
 * LandingApp — ultra-minimal landing-only entry.
 *
 * Mounted by main.tsx ONLY when initial path is `/` or `/theme`.
 * Goal: critical-path JS includes ONLY React + react-router + landing chunk.
 *
 * Excluded vs App.tsx (significant savings on critical path):
 *   - @tanstack/react-query (QueryClient/Provider) — landing has no data
 *   - All storefront layout lazy() refs (14 themes × 2 = 28 lazy wrappers)
 *   - Subdomain/custom-domain detection
 *   - Supabase client (only loaded if user navigates to /login etc.)
 *   - DashboardProviders bundle (Auth, Toaster, TooltipProvider, Sonner)
 *   - All prewarm IIFEs that scan window.location for storefront paths
 *
 * IMPORTANT: Landing's Navbar/Footer use plain <a href> for cross-app links
 * (/login, /signup, /dashboard). Browsers do a hard navigation which then
 * loads the full App.tsx fresh. This avoids nesting two BrowserRouters.
 */
import { useEffect, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import { ErrorBoundary } from "./components/ErrorBoundary";

const ThemeShowcase = lazy(() => import("./pages/ThemeShowcase"));

/**
 * Idle prefetch: warm up the full App chunk after landing is fully painted.
 * Uses a runtime-constructed import path so Rollup's static analyzer can NOT
 * see this as a graph edge — it stays out of <link rel="modulepreload">.
 * Without this trick, Vite would preload App.tsx (and all its 30+ chunks)
 * on the landing critical path, defeating the whole point of LandingApp.
 */
function prefetchFullAppOnIdle() {
  const start = () => {
    // /* @vite-ignore */ + variable URL prevents static graph inclusion
    const url = "/src/App.tsx";
    import(/* @vite-ignore */ url).catch(() => {});
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
    <ErrorBoundary>
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
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default LandingApp;
