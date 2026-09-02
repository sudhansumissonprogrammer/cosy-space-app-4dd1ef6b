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
  Palette,
  Rocket,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Store,
  Settings,
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

/**
 * Store setup guide.
 *
 * Every `where` string must match the CURRENT dashboard navigation defined in
 * `src/config/dashboardNav.ts` (group → item label) and the section chips in
 * `src/pages/StoreSettings.tsx`. Update both together when nav changes.
 */
const STEPS: OnboardingStep[] = [
  {
    icon: Store,
    title: "Welcome! Let's set up your store 🎉",
    items: [
      { text: "This guide shows you exactly where everything is", where: "" },
      { text: "Menu is grouped: Catalog, Orders, Payments, Marketing, Store Setup", where: "Left sidebar" },
      { text: "Can't find something? Press Ctrl / ⌘ + K and search", where: "Anywhere in dashboard" },
      { text: "Rarely used pages sit under the “More” link in each group", where: "Sidebar → More" },
      { text: "Reopen this guide anytime from the Guide button", where: "Overview → Guide" },
    ],
  },
  {
    icon: Settings,
    title: "Complete Your Store Profile",
    items: [
      { text: "Store name, description & WhatsApp number", where: "Store Setup → Store Settings → Basics" },
      { text: "Upload logo, banner & favicon", where: "Store Settings → Logo & Images" },
      { text: "Set address, pickup pincode & business hours", where: "Store Settings → Location & Hours" },
      { text: "Choose what shows on the storefront", where: "Store Settings → Storefront Display" },
    ],
    action: "Open Store Settings",
    route: "settings",
  },
  {
    icon: Package,
    title: "Add Your Products",
    items: [
      { text: "Create products with price, images & variants", where: "Catalog → Products → Create" },
      { text: "Import many at once from CSV or a supplier link", where: "Catalog → More → Bulk Upload" },
      { text: "Group items into collections (can be hidden too)", where: "Catalog → More → Categories" },
      { text: "Pick the Best Sellers row for your homepage", where: "Catalog → More → Best Sellers" },
      { text: "Collect and reply to product reviews", where: "Catalog → Reviews" },
    ],
    action: "Add Product",
    route: "products/create",
  },
  {
    icon: CreditCard,
    title: "Payments & Shipping",
    items: [
      { text: "Turn on UPI / cards (Razorpay, Cashfree, PayU)", where: "Payments & Shipping → Payments" },
      { text: "Enable COD, partial COD advance & prepaid discount", where: "Payments & Shipping → Payments" },
      { text: "Delivery charge, free-shipping limit & delivery days", where: "Payments & Shipping → Shipping Rates" },
      { text: "Connect Delhivery / Blue Dart for AWB & tracking", where: "Payments & Shipping → More → Courier Partners" },
      { text: "GST number and tax on invoices", where: "Payments & Shipping → More → Tax / GST" },
      { text: "Platform fee is 2% per order — keep wallet recharged", where: "Payments & Shipping → Wallet" },
    ],
    action: "Set Up Payments",
    route: "payments",
  },
  {
    icon: Palette,
    title: "Design Your Storefront",
    items: [
      { text: "Pick a layout from 20+ storefront themes", where: "Store Setup → Theme & Design" },
      { text: "Brand colours, fonts and header colour", where: "Theme & Design" },
      { text: "Write About Us, Return, Shipping & Privacy pages", where: "Store Setup → Pages & Policies" },
      { text: "Add SEO title & description for Google", where: "Store Settings → SEO" },
      { text: "Add bundles, upsells & shop-by-video add-ons", where: "Store Setup → App Store" },
    ],
    action: "Customize Theme",
    route: "theme",
  },
  {
    icon: Rocket,
    title: "Sell More",
    items: [
      { text: "Auto order updates & cart-recovery messages", where: "Marketing & Growth → WhatsApp" },
      { text: "Discount codes and auto-apply offers", where: "Marketing & Growth → Coupons" },
      { text: "Nudge shoppers who left without paying", where: "Marketing & Growth → Abandoned Carts" },
      { text: "Meta Pixel, Conversions API & GA4 for ads", where: "Marketing & Growth → Tracking Pixels" },
      { text: "See where shoppers drop off before payment", where: "Marketing & Growth → More → Sales Funnel" },
    ],
    action: "Open WhatsApp",
    route: "whatsapp",
  },
  {
    icon: Globe,
    title: "Launch & Track 🚀",
    items: [
      { text: "Copy your store link and share on WhatsApp / Instagram", where: "Overview → store link strip" },
      { text: "Connect your own .com / .in domain", where: "Store Setup → Domain" },
      { text: "Confirm, pack and ship orders as they arrive", where: "Orders & Customers → Orders" },
      { text: "Save buyer contacts and enquiries", where: "Orders & Customers → Customers / More → Leads" },
      { text: "Watch visitors, revenue & top products", where: "Marketing & Growth → Analytics" },
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
