import { lazy, Suspense, useEffect } from "react";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import PaymentTrustStrip from "@/components/landing/PaymentTrustStrip";
import StatsBar from "@/components/landing/StatsBar";
import LandingJsonLd from "@/components/landing/LandingJsonLd";
import LazyMount from "@/components/landing/LazyMount";

/** Prefetch auth chunks during idle time so /login and /signup load instantly */
let idlePrefetched = false;
function prefetchAuthOnIdle() {
  if (idlePrefetched) return;
  idlePrefetched = true;
  const start = () => {
    Promise.all([
      import("@/components/ui/toaster"),
      import("@/components/ui/tooltip"),
      import("@/contexts/AuthContext"),
      import("@/components/ui/sonner"),
    ]).catch(() => {});
    import("@/pages/Login").catch(() => {});
    import("@/pages/Signup").catch(() => {});
    import("@/routes/AuthRoutes").catch(() => {});
  };
  if ("requestIdleCallback" in window) {
    requestIdleCallback(start, { timeout: 3000 });
  } else {
    setTimeout(start, 2000);
  }
}

// Below-fold lazy chunks — each wrapped in LazyMount so its chunk only
// downloads when the user scrolls near it. This removes the all-at-once
// waterfall (~7 chunks fetched simultaneously after first paint).
const ProblemAwareness = lazy(() => import("@/components/landing/ProblemAwareness"));
const CommissionCalculator = lazy(() => import("@/components/landing/CommissionCalculator"));
const WhoUses = lazy(() => import("@/components/landing/WhoUses"));
const SolutionFlow = lazy(() => import("@/components/landing/SolutionFlow"));
const StoreLookShowcase = lazy(() => import("@/components/landing/StoreLookShowcase"));
const Testimonials = lazy(() => import("@/components/landing/Testimonials"));
const ComparisonTable = lazy(() => import("@/components/landing/ComparisonTable"));
const Pricing = lazy(() => import("@/components/landing/Pricing"));
const FAQ = lazy(() => import("@/components/landing/FAQ"));
const FinalCTA = lazy(() => import("@/components/landing/FinalCTA"));
const Footer = lazy(() => import("@/components/landing/Footer"));
const LandingWhatsApp = lazy(() => import("@/components/landing/LandingWhatsApp"));
const ExitIntentPopup = lazy(() => import("@/components/landing/ExitIntentPopup"));

const Index = () => {
  useEffect(() => { prefetchAuthOnIdle(); }, []);

  return (
    <div className="min-h-screen bg-background font-outfit">
      <LandingJsonLd />
      <Navbar />
      <Hero />
      <PaymentTrustStrip />
      <StatsBar />
      <Suspense fallback={null}>
        <LazyMount minHeight={500}><ProblemAwareness /></LazyMount>
        <LazyMount minHeight={600}><CommissionCalculator /></LazyMount>
        <LazyMount minHeight={500}><WhoUses /></LazyMount>
        <LazyMount minHeight={500}><SolutionFlow /></LazyMount>
        <LazyMount minHeight={700}><StoreLookShowcase showOverlays={false} /></LazyMount>
        <LazyMount minHeight={500}><Testimonials /></LazyMount>
        <LazyMount minHeight={600}><ComparisonTable /></LazyMount>
        <LazyMount minHeight={700}><Pricing /></LazyMount>
        <LazyMount minHeight={500}><FAQ /></LazyMount>
        <LazyMount minHeight={400}><FinalCTA /></LazyMount>
        <LazyMount minHeight={300}><Footer /></LazyMount>
        <LazyMount minHeight={0}><LandingWhatsApp /></LazyMount>
        <LazyMount minHeight={0}><ExitIntentPopup /></LazyMount>
      </Suspense>
    </div>
  );
};

export default Index;
