import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import PaymentTrustStrip from "@/components/landing/PaymentTrustStrip";
import StatsBar from "@/components/landing/StatsBar";
import ProblemAwareness from "@/components/landing/ProblemAwareness";
import CommissionCalculator from "@/components/landing/CommissionCalculator";
import WhoUses from "@/components/landing/WhoUses";
import SolutionFlow from "@/components/landing/SolutionFlow";
import StoreLookShowcase from "@/components/landing/StoreLookShowcase";
import Testimonials from "@/components/landing/Testimonials";
import ComparisonTable from "@/components/landing/ComparisonTable";
import Pricing from "@/components/landing/Pricing";
import FAQ from "@/components/landing/FAQ";
import FinalCTA from "@/components/landing/FinalCTA";
import Footer from "@/components/landing/Footer";
import StickyMobileCTA from "@/components/landing/StickyMobileCTA";
import LandingWhatsApp from "@/components/landing/LandingWhatsApp";
import ExitIntentPopup from "@/components/landing/ExitIntentPopup";
import LandingJsonLd from "@/components/landing/LandingJsonLd";

const Index = () => {
  return (
    <div className="min-h-screen bg-background font-outfit">
      <LandingJsonLd />
      <Navbar />
      <Hero />
      <PaymentTrustStrip />
      <StatsBar />
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
      <StickyMobileCTA />
      <LandingWhatsApp />
      <ExitIntentPopup />
    </div>
  );
};

export default Index;
