import { lazy, Suspense } from "react";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import PaymentTrustStrip from "@/components/landing/PaymentTrustStrip";
import StatsBar from "@/components/landing/StatsBar";
import LandingJsonLd from "@/components/landing/LandingJsonLd";

// Below-fold: lazy load to keep initial bundle small & fast
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
  return (
    <div className="min-h-screen bg-background font-outfit">
      <LandingJsonLd />
      <Navbar />
      <Hero />
      <PaymentTrustStrip />
      <StatsBar />
      <Suspense fallback={null}>
        <ProblemAwareness />
        <CommissionCalculator />
        <WhoUses />
        <SolutionFlow />
        <StoreLookShowcase showOverlays={false} />
        <Testimonials />
        <ComparisonTable />
        <Pricing />
        <FAQ />
        <FinalCTA />
        <Footer />
        <LandingWhatsApp />
        <ExitIntentPopup />
      </Suspense>
    </div>
  );
};

export default Index;
