import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";

import ProblemAwareness from "@/components/landing/ProblemAwareness";
import SolutionFlow from "@/components/landing/SolutionFlow";
import TrustReasons from "@/components/landing/TrustReasons";
import AfterYouStart from "@/components/landing/AfterYouStart";
import StatsBar from "@/components/landing/StatsBar";
import PowerfulFeatures from "@/components/landing/PowerfulFeatures";
import CommissionCalculator from "@/components/landing/CommissionCalculator";
import ComparisonTable from "@/components/landing/ComparisonTable";
import WhyNotWebsite from "@/components/landing/WhyNotWebsite";
import FeaturesGrid from "@/components/landing/FeaturesGrid";
import StoreShowcases from "@/components/landing/StoreShowcases";
import StoreLookShowcase from "@/components/landing/StoreLookShowcase";
import WhoUses from "@/components/landing/WhoUses";
import CitiesGrid from "@/components/landing/CitiesGrid";
import Pricing from "@/components/landing/Pricing";
import StartRiskFree from "@/components/landing/StartRiskFree";
import DemoBooking from "@/components/landing/DemoBooking";
import Testimonials from "@/components/landing/Testimonials";
import FAQ from "@/components/landing/FAQ";
import FinalCTA from "@/components/landing/FinalCTA";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background font-outfit">
      <Navbar />
      <Hero />
      <LiveStorePreview />
      <ProblemAwareness />
      <SolutionFlow />
      <TrustReasons />
      <AfterYouStart />
      <StatsBar />
      <PowerfulFeatures />
      <CommissionCalculator />
      <ComparisonTable />
      <WhyNotWebsite />
      <FeaturesGrid />
      <StoreShowcases />
      <StoreLookShowcase showOverlays={false} />
      <WhoUses />
      <CitiesGrid />
      <Pricing />
      <StartRiskFree />
      <DemoBooking />
      <Testimonials />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
};

export default Index;
