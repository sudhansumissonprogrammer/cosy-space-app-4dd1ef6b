import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import LiveStorePreview from "@/components/landing/LiveStorePreview";
import ProblemAwareness from "@/components/landing/ProblemAwareness";
import CommissionCalculator from "@/components/landing/CommissionCalculator";
import TrustReasons from "@/components/landing/TrustReasons";
import AfterYouStart from "@/components/landing/AfterYouStart";
import PowerfulFeatures from "@/components/landing/PowerfulFeatures";
import ComparisonTable from "@/components/landing/ComparisonTable";
import FeaturesGrid from "@/components/landing/FeaturesGrid";
import StoreLookShowcase from "@/components/landing/StoreLookShowcase";
import WhoUses from "@/components/landing/WhoUses";
import Pricing from "@/components/landing/Pricing";
import StartRiskFree from "@/components/landing/StartRiskFree";
import DemoBooking from "@/components/landing/DemoBooking";
import Testimonials from "@/components/landing/Testimonials";
import FAQ from "@/components/landing/FAQ";
import FinalCTA from "@/components/landing/FinalCTA";
import Footer from "@/components/landing/Footer";
import StickyMobileCTA from "@/components/landing/StickyMobileCTA";

const Index = () => {
  return (
    <div className="min-h-screen bg-background font-outfit">
      <Navbar />
      <Hero />
      <CommissionCalculator />
      <LiveStorePreview />
      <ProblemAwareness />
      <TrustReasons />
      <AfterYouStart />
      <PowerfulFeatures />
      <ComparisonTable />
      <FeaturesGrid />
      <StoreLookShowcase showOverlays={false} />
      <WhoUses />
      <Pricing />
      <StartRiskFree />
      <DemoBooking />
      <Testimonials />
      <FAQ />
      <FinalCTA />
      <Footer />
      <StickyMobileCTA />
    </div>
  );
};

export default Index;
