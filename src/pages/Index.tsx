import { lazy, Suspense, useEffect } from "react";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import LandingJsonLd from "@/components/landing/LandingJsonLd";
import LazyMount from "@/components/landing/LazyMount";

// Below-fold lazy chunks — each wrapped in LazyMount so its chunk only
// downloads when the user scrolls near it.
const PaymentTrustStrip = lazy(() => import("@/components/landing/PaymentTrustStrip"));
const StatsBar = lazy(() => import("@/components/landing/StatsBar"));
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
  // Mount JSON-LD only after the browser is idle — SEO crawlers wait for full
  // load anyway, so it doesn't need to be on the critical path.
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      // Tiny dynamic import so it doesn't ship in the entry chunk.
      import("@/components/landing/LandingJsonLd").catch(() => {});
    };
    if ("requestIdleCallback" in window) {
      const id = (window as any).requestIdleCallback(run, { timeout: 4000 });
      return () => { cancelled = true; (window as any).cancelIdleCallback?.(id); };
    }
    const t = setTimeout(run, 2500);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  return (
    <div className="min-h-screen bg-background font-outfit">
      <Navbar />
      <Hero />
      <Suspense fallback={null}>
        <LazyMount minHeight={80}><PaymentTrustStrip /></LazyMount>
        <LazyMount minHeight={300}><StatsBar /></LazyMount>
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
