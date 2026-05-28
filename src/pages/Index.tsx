import { lazy, Suspense, useEffect, useState } from "react";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import LazyMount from "@/components/landing/LazyMount";

const LandingJsonLd = lazy(() => import("@/components/landing/LandingJsonLd"));

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

const FAQ = lazy(() => import("@/components/landing/FAQ"));
const FinalCTA = lazy(() => import("@/components/landing/FinalCTA"));
const Footer = lazy(() => import("@/components/landing/Footer"));
const LandingWhatsApp = lazy(() => import("@/components/landing/LandingWhatsApp"));
const ExitIntentPopup = lazy(() => import("@/components/landing/ExitIntentPopup"));

const Index = () => {
  // Mount JSON-LD quickly. AI crawlers (Perplexity, ChatGPT-User) often only
  // execute JS for 2–3 seconds — a long idle deadline meant the marketing
  // homepage's structured data was missed. Keep it off the critical path
  // (microtask) but make sure it lands inside any reasonable crawler budget.
  const [seoReady, setSeoReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const run = () => { if (!cancelled) setSeoReady(true); };
    if ("requestIdleCallback" in window) {
      const id = (window as any).requestIdleCallback(run, { timeout: 800 });
      return () => { cancelled = true; (window as any).cancelIdleCallback?.(id); };
    }
    const t = setTimeout(run, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  return (
    <div className="min-h-screen bg-background font-outfit">
      <Navbar />
      <main>
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
          
          
          <LazyMount minHeight={500}><FAQ /></LazyMount>
          <LazyMount minHeight={400}><FinalCTA /></LazyMount>
          <LazyMount minHeight={0}><LandingWhatsApp /></LazyMount>
          <LazyMount minHeight={0}><ExitIntentPopup /></LazyMount>
          {seoReady && <LandingJsonLd />}
        </Suspense>
      </main>
      <Suspense fallback={null}>
        <LazyMount minHeight={300}><Footer /></LazyMount>
      </Suspense>
    </div>
  );
};

export default Index;
