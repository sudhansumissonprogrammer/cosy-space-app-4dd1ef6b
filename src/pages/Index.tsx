import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import CommissionCalculator from "@/components/landing/CommissionCalculator";
import ProblemAwareness from "@/components/landing/ProblemAwareness";
import WhoUses from "@/components/landing/WhoUses";
import SolutionFlow from "@/components/landing/SolutionFlow";
import Testimonials from "@/components/landing/Testimonials";
import StoreLookShowcase from "@/components/landing/StoreLookShowcase";
import ComparisonTable from "@/components/landing/ComparisonTable";
import Pricing from "@/components/landing/Pricing";
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
      <ProblemAwareness />
      <WhoUses />
      <SolutionFlow />
      <Testimonials />
      <StoreLookShowcase showOverlays={false} />
      <ComparisonTable />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
      <StickyMobileCTA />
    </div>
  );
};

export default Index;
