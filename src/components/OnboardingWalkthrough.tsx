import { useState } from "react";
import { useNavigateTransition } from "@/hooks/useNavigateTransition";
import {
  Dialog,
  DialogContent,
  DialogTitle,
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
  Image,
  FileText,
  Phone,
  Settings,
  BarChart3,
  Globe,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface OnboardingStep {
  icon: React.ElementType;
  title: string;
  items: { text: string; where: string }[];
  action?: string;
  route?: string;
}

const STEPS: OnboardingStep[] = [
  {
    icon: Store,
    title: "Welcome! Let's set up your store 🎉",
    items: [
      { text: "This guide shows you exactly where everything is", where: "" },
      { text: "Takes about 3 minutes — skip anytime", where: "" },
      { text: "You can reopen this from the Guide button", where: "" },
    ],
  },
  {
    icon: Settings,
    title: "Complete Your Store Profile",
    items: [
      { text: "Add your store logo & banner", where: "Settings → Media" },
      { text: "Write a store description", where: "Settings → Basic Info" },
      { text: "Add your WhatsApp number", where: "Settings → Basic Info" },
      { text: "Set your location", where: "Settings → Location" },
    ],
    action: "Open Settings",
    route: "settings",
  },
  {
    icon: Package,
    title: "Add Your Products",
    items: [
      { text: "Create products with name, price & images", where: "Products → Create" },
      { text: "Use CSV bulk upload for many products", where: "Products → Bulk Upload" },
      { text: "Organize with categories", where: "Products page" },
      { text: "Mark best sellers for homepage carousel", where: "Edit Product → toggle" },
    ],
    action: "Add Product",
    route: "products/create",
  },
  {
    icon: CreditCard,
    title: "Payments & Shipping",
    items: [
      { text: "Connect Razorpay for UPI, cards & wallets", where: "Payments page" },
      { text: "Enable Cash on Delivery", where: "Payments page" },
      { text: "Set flat shipping rate or free above ₹X", where: "Shipping page" },
      { text: "Configure tax (GST) if needed", where: "Tax Settings page" },
    ],
    action: "Set Up Payments",
    route: "payments",
  },
  {
    icon: Palette,
    title: "Customize Look & Feel",
    items: [
      { text: "Pick from 10+ storefront themes", where: "Theme page" },
      { text: "Choose brand colors & fonts", where: "Theme page" },
      { text: "Preview live on mobile", where: "Theme page → Preview" },
      { text: "Add SEO title & description", where: "Settings → SEO" },
    ],
    action: "Customize Theme",
    route: "theme",
  },
  {
    icon: Rocket,
    title: "Launch & Grow 🚀",
    items: [
      { text: "Share store link on WhatsApp & Instagram", where: "Dashboard → Share" },
      { text: "Connect a custom domain", where: "Settings → Domain" },
      { text: "Set up Facebook Pixel for ad tracking", where: "Tracking page" },
      { text: "Create discount coupons", where: "Coupons page" },
      { text: "Track analytics & orders", where: "Analytics page" },
    ],
    action: "View Dashboard",
    route: "",
  },
];

interface OnboardingWalkthroughProps {
  storeId: string;
  storeSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function OnboardingWalkthrough({
  storeId,
  storeSlug,
  open,
  onOpenChange,
}: OnboardingWalkthroughProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const { navigate } = useNavigateTransition();

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
    if (step.route !== undefined) {
      localStorage.setItem(`onboarding-done-${storeId}`, "true");
      onOpenChange(false);
      const path = step.route
        ? `/dashboard/stores/${storeSlug}/${step.route}`
        : `/dashboard`;
      navigate(path);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(`onboarding-done-${storeId}`, "true");
    onOpenChange(false);
    setCurrentStep(0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden border-0 rounded-2xl" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Store Setup Guide</DialogTitle>
        {/* Progress */}
        <div className="px-5 pt-4 pb-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">
              {currentStep + 1} / {STEPS.length}
            </span>
            <button
              onClick={handleSkip}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip guide
            </button>
          </div>
          <Progress value={progress} className="h-1" />
        </div>

        {/* Content */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-base font-bold text-foreground leading-tight">
              {step.title}
            </h2>
          </div>

          {/* Checklist items */}
          <div className="space-y-0.5">
            {step.items.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 hover:bg-accent/40 transition-colors"
              >
                <div className="mt-0.5 w-5 h-5 rounded-full border border-muted-foreground/25 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-semibold text-muted-foreground">{i + 1}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground leading-snug">{item.text}</p>
                  {item.where && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">📍 {item.where}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-4 flex items-center gap-2">
          {!isFirst && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrev}
              className="gap-1 h-9 text-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back
            </Button>
          )}

          <div className="flex-1" />

          {step.action && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAction}
              className="gap-1 h-9 text-xs"
            >
              {step.action}
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          )}

          <Button size="sm" onClick={handleNext} className="gap-1 h-9 text-xs">
            {isLast ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Done
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
