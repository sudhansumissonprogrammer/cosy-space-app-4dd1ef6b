import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Package,
  CreditCard,
  Truck,
  Palette,
  Share2,
  Rocket,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Store,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface OnboardingStep {
  icon: React.ElementType;
  title: string;
  description: string;
  tip: string;
  action?: string;
  route?: string;
}

const STEPS: OnboardingStep[] = [
  {
    icon: Store,
    title: "Welcome to Your Store! 🎉",
    description:
      "You've just created your online store. Let's walk through a few quick steps to get you ready to start selling.",
    tip: "This setup takes less than 5 minutes. You can always come back to any step later.",
  },
  {
    icon: Package,
    title: "Add Your Products",
    description:
      "Start by adding your first product. Include a name, price, images, and description. You can also bulk-upload products using a CSV file.",
    tip: "Pro tip: High-quality images and detailed descriptions boost conversions by up to 30%.",
    action: "Go to Products",
    route: "products",
  },
  {
    icon: CreditCard,
    title: "Set Up Payments",
    description:
      "Connect Razorpay to accept online payments via UPI, cards, and wallets. You can also enable Cash on Delivery for local orders.",
    tip: "Offering multiple payment options reduces cart abandonment significantly.",
    action: "Configure Payments",
    route: "payments",
  },
  {
    icon: Truck,
    title: "Configure Shipping",
    description:
      "Set a flat shipping rate or offer free shipping above a certain order amount. Keep it simple — customers love free shipping!",
    tip: "Stores with free shipping thresholds see 20% higher average order values.",
    action: "Set Up Shipping",
    route: "shipping",
  },
  {
    icon: Palette,
    title: "Customize Your Theme",
    description:
      "Choose from 10+ beautiful storefront themes and pick a color combination that matches your brand. Preview everything in real-time on mobile.",
    tip: "The ⭐ Recommended color combos are tested for readability and visual appeal.",
    action: "Customize Theme",
    route: "theme",
  },
  {
    icon: Share2,
    title: "Share Your Store",
    description:
      "Your store is live on a unique subdomain. Share the link on WhatsApp, Instagram, and Facebook to start getting customers.",
    tip: "Add your Facebook Pixel ID in settings to track ad conversions automatically.",
    action: "Share Store",
    route: "settings",
  },
  {
    icon: Rocket,
    title: "You're All Set! 🚀",
    description:
      "Your store is ready to go. Start adding products, run ads, and watch orders roll in. You can manage everything from this dashboard.",
    tip: "Check your Analytics page regularly to track views, orders, and revenue growth.",
  },
];

interface OnboardingWalkthroughProps {
  storeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function OnboardingWalkthrough({
  storeId,
  open,
  onOpenChange,
}: OnboardingWalkthroughProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  const step = STEPS[currentStep];
  const Icon = step.icon;
  const progress = ((currentStep + 1) / STEPS.length) * 100;
  const isFirst = currentStep === 0;
  const isLast = currentStep === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      localStorage.setItem(`onboarding-done-${storeId}`, "true");
      onOpenChange(false);
      setCurrentStep(0);
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) setCurrentStep((s) => s - 1);
  };

  const handleAction = () => {
    if (step.route) {
      localStorage.setItem(`onboarding-done-${storeId}`, "true");
      onOpenChange(false);
      navigate(`/dashboard/stores/${storeId}/${step.route}`);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(`onboarding-done-${storeId}`, "true");
    onOpenChange(false);
    setCurrentStep(0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden border-0 rounded-2xl">
        {/* Progress bar */}
        <div className="px-6 pt-5 pb-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              Step {currentStep + 1} of {STEPS.length}
            </span>
            <button
              onClick={handleSkip}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip guide
            </button>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Content */}
        <div className="px-6 pt-6 pb-4 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
            <Icon className="w-8 h-8 text-primary" />
          </div>

          <h2 className="text-xl font-bold text-foreground mb-2">
            {step.title}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4 max-w-sm">
            {step.description}
          </p>

          {/* Tip card */}
          <div className="w-full rounded-xl bg-accent/50 border border-border px-4 py-3 text-left">
            <p className="text-xs text-muted-foreground leading-relaxed">
              💡 {step.tip}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex items-center gap-2">
          {!isFirst && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrev}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
          )}

          <div className="flex-1" />

          {step.action && step.route && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAction}
              className="gap-1"
            >
              {step.action}
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}

          <Button size="sm" onClick={handleNext} className="gap-1">
            {isLast ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Get Started
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
