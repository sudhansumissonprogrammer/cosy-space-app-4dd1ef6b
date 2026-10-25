import { lazy, Suspense } from "react";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import LazyMount from "@/components/landing/LazyMount";

// V2 sections — complete commerce OS / flat-3%-on-every-sale positioning.
const TrustLogos = lazy(() => import("@/components/landing/v2/TrustLogos"));
const ProblemVsUs = lazy(() => import("@/components/landing/v2/ProblemVsUs"));
const CoreFeatures = lazy(() => import("@/components/landing/v2/CoreFeatures"));
const HowItWorks = lazy(() => import("@/components/landing/v2/HowItWorks"));
const PricingV2 = lazy(() => import("@/components/landing/v2/PricingV2"));
const SavingsCalculator = lazy(() => import("@/components/landing/v2/SavingsCalculator"));
const AgenticStrip = lazy(() => import("@/components/landing/v2/AgenticStrip"));
const FeaturedOn = lazy(() => import("@/components/landing/v2/FeaturedOn"));
const FinalCtaV2 = lazy(() => import("@/components/landing/v2/FinalCtaV2"));

const Testimonials = lazy(() => import("@/components/landing/Testimonials"));
const FAQ = lazy(() => import("@/components/landing/FAQ"));
const Footer = lazy(() => import("@/components/landing/Footer"));
const LandingWhatsApp = lazy(() => import("@/components/landing/LandingWhatsApp"));
const ExitIntentPopup = lazy(() => import("@/components/landing/ExitIntentPopup"));
const LiveStorePreview = lazy(() => import("@/components/landing/LiveStorePreview"));
const StoreLookShowcase = lazy(() => import("@/components/landing/StoreLookShowcase"));

const Index = () => {
  return (
    <div className="min-h-screen bg-background font-outfit">
      <Navbar />
      <main>
        <Hero />
        <Suspense fallback={null}>
          <LazyMount minHeight={140}><TrustLogos /></LazyMount>
          <LazyMount minHeight={500}><ProblemVsUs /></LazyMount>
          <LazyMount minHeight={600}><CoreFeatures /></LazyMount>
          <LazyMount minHeight={500}><HowItWorks /></LazyMount>
          <LazyMount minHeight={700}><LiveStorePreview /></LazyMount>
          <LazyMount minHeight={900}><StoreLookShowcase /></LazyMount>
          <LazyMount minHeight={600}><PricingV2 /></LazyMount>
          <LazyMount minHeight={700}><SavingsCalculator /></LazyMount>
          <LazyMount minHeight={500}><AgenticStrip /></LazyMount>
          <LazyMount minHeight={500}><Testimonials /></LazyMount>
          <LazyMount minHeight={120}><FeaturedOn /></LazyMount>
          <LazyMount minHeight={500}><FAQ /></LazyMount>
          <LazyMount minHeight={400}><FinalCtaV2 /></LazyMount>
          <LazyMount minHeight={0}><LandingWhatsApp /></LazyMount>
          <LazyMount minHeight={0}><ExitIntentPopup /></LazyMount>

        </Suspense>
      </main>
      <Suspense fallback={null}>
        <LazyMount minHeight={300}><Footer /></LazyMount>
      </Suspense>
    </div>
  );
};

export default Index;
