import { lazy, Suspense, useEffect } from "react";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
const PaymentTrustStrip = lazy(() => import("@/components/landing/PaymentTrustStrip"));

import LandingJsonLd from "@/components/landing/LandingJsonLd";

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

// Near-fold: eager-ish via lazy with individual suspense
const SocialProofStrip = lazy(() => import("@/components/landing/SocialProofStrip"));
const ProblemAwareness = lazy(() => import("@/components/landing/ProblemAwareness"));
const CommissionCalculator = lazy(() => import("@/components/landing/CommissionCalculator"));
const WhoUses = lazy(() => import("@/components/landing/WhoUses"));
const SolutionFlow = lazy(() => import("@/components/landing/SolutionFlow"));
const StoreLookShowcase = lazy(() => import("@/components/landing/StoreLookShowcase"));
const Testimonials = lazy(() => import("@/components/landing/Testimonials"));
const ClientResults = lazy(() => import("@/components/landing/ClientResults"));
const TrustReasons = lazy(() => import("@/components/landing/TrustReasons"));
const FAQ = lazy(() => import("@/components/landing/FAQ"));
const FinalCTA = lazy(() => import("@/components/landing/FinalCTA"));
const Footer = lazy(() => import("@/components/landing/Footer"));
const LandingWhatsApp = lazy(() => import("@/components/landing/LandingWhatsApp"));
const ExitIntentPopup = lazy(() => import("@/components/landing/ExitIntentPopup"));

const Fb = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={null}>{children}</Suspense>
);

const Index = () => {
  useEffect(() => { prefetchAuthOnIdle(); }, []);

  return (
    <div className="min-h-screen bg-background font-outfit">
      <LandingJsonLd />
      <Navbar />
      <Hero />
      <Fb><PaymentTrustStrip /></Fb>
      
      <Fb><SocialProofStrip /></Fb>
      <Fb><ProblemAwareness /></Fb>
      <Fb><CommissionCalculator /></Fb>
      <Fb><WhoUses /></Fb>
      <Fb><SolutionFlow /></Fb>
      <Fb><StoreLookShowcase showOverlays={false} /></Fb>
      <Fb><Testimonials /></Fb>
      <Fb><ClientResults /></Fb>
      <Fb><TrustReasons /></Fb>
      <Fb><FAQ /></Fb>
      <Fb><FinalCTA /></Fb>
      <Fb><Footer /></Fb>
      <Fb><LandingWhatsApp /></Fb>
      <Fb><ExitIntentPopup /></Fb>
    </div>
  );
};

export default Index;
