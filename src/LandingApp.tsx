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
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Index from "./pages/Index";
import { ErrorBoundary } from "./components/ErrorBoundary";

const ThemeShowcase = lazy(() => import("./pages/ThemeShowcase"));
const Guides = lazy(() => import("./pages/Guides"));
const GuideDetail = lazy(() => import("./pages/GuideDetail"));

// NOTE: We deliberately do NOT statically import or prefetch App.tsx from
// landing code. Any `import("./App")` here causes Rollup to add a
// <link rel="modulepreload"> hint that pulls App + its chunks (radix, supabase,
// react-query, ~500KB total) onto the landing critical path. Hard navigation
// to /login or /dashboard loads the full app on demand — fast enough.

const LandingApp = () => {
  return (
    <ErrorBoundary>
      <HelmetProvider>
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
            <Route
              path="/guides"
              element={
                <Suspense fallback={<div className="min-h-screen bg-background" />}>
                  <Guides />
                </Suspense>
              }
            />
            <Route
              path="/guides/:slug"
              element={
                <Suspense fallback={<div className="min-h-screen bg-background" />}>
                  <GuideDetail />
                </Suspense>
              }
            />
          </Routes>
        </BrowserRouter>
      </HelmetProvider>
    </ErrorBoundary>
  );
};

export default LandingApp;
