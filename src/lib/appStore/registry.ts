import { lazy, type LazyExoticComponent, type ComponentType } from "react";
import { Disc3, Gift, Timer, Heart, type LucideIcon } from "lucide-react";

export type AppId =
  | "spin-wheel"
  | "scratch-card"
  | "countdown-bar"
  | "wishlist-reminder";

export interface StoreAppMeta {
  id: AppId;
  name: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  category: "engagement" | "conversion" | "retention";
  status: "live" | "beta" | "coming-soon";
  accent: string;
  ConfigComponent?: LazyExoticComponent<ComponentType<any>>;
  StorefrontComponent?: LazyExoticComponent<ComponentType<any>>;
  defaultConfig?: Record<string, any>;
}

export const APP_REGISTRY: StoreAppMeta[] = [
  {
    id: "spin-wheel",
    name: "Spin the Wheel",
    tagline: "Capture leads with a gamified coupon wheel",
    description:
      "Shows a spinnable wheel of coupons after visitors browse for a few seconds. Users enter their mobile number to unlock the reward — perfect for building your WhatsApp list.",
    icon: Disc3,
    category: "engagement",
    status: "live",
    accent: "from-indigo-500 to-fuchsia-500",
    ConfigComponent: lazy(() => import("@/pages/appStore/SpinWheelConfig")),
    StorefrontComponent: lazy(
      () => import("@/components/storefront/apps/SpinWheel/SpinWheelApp")
    ),
    defaultConfig: {
      trigger_delay_ms: 11000,
      show_on_mobile: true,
      show_on_desktop: true,
      require_otp: false,
      wheel_style: "classic",
      sound_enabled: true,
      time_trigger_enabled: true,
      exit_intent_enabled: true,
      exit_intent_scope: "all",
      heading: "Spin to win exclusive coupons",
      subheading: "Try your luck — one spin per visit",
      button_label: "Spin Now",
      lead_heading: "Woah! What a win 🎉",
      lead_subheading: "Enter your mobile to unlock your reward",
      marketing_consent_label: "Notify me for offers & updates on WhatsApp",
      segments: [
        { label: "Get 10% off", type: "coupon", code: "SPIN10", discount_type: "percentage", discount_value: 10, min_order: 0, weight: 15 },
        { label: "Better Luck Next Time", type: "lose", weight: 55 },
        { label: "Get 15% off", type: "coupon", code: "SPIN15", discount_type: "percentage", discount_value: 15, min_order: 999, weight: 5 },
        { label: "Get 5% off", type: "coupon", code: "SPIN5", discount_type: "percentage", discount_value: 5, min_order: 0, weight: 25 },
      ],
    },
  },
  {
    id: "scratch-card",
    name: "Mystery Scratch Card",
    tagline: "Post-order reveal card with coupons, gifts & upsells",
    description: "Appears on the thank-you page after checkout. Customer scratches the foil to reveal a coupon or gift.",
    icon: Gift,
    category: "engagement",
    status: "coming-soon",
    accent: "from-amber-500 to-rose-500",
  },
  {
    id: "countdown-bar",
    name: "Countdown Bar",
    tagline: "Urgency banner with a live timer",
    description: "Site-wide announcement bar with a countdown to your next sale drop.",
    icon: Timer,
    category: "conversion",
    status: "coming-soon",
    accent: "from-emerald-500 to-teal-500",
  },
  {
    id: "wishlist-reminder",
    name: "Wishlist Reminder",
    tagline: "Auto WhatsApp nudge for saved items",
    description: "Sends a friendly WhatsApp reminder for items sitting in a customer's wishlist.",
    icon: Heart,
    category: "retention",
    status: "coming-soon",
    accent: "from-pink-500 to-rose-500",
  },
];

export function getApp(id: string): StoreAppMeta | undefined {
  return APP_REGISTRY.find((a) => a.id === id);
}
