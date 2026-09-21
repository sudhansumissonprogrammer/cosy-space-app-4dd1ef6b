import { lazy, type LazyExoticComponent, type ComponentType } from "react";
import { Disc3, Gift, Timer, Heart, DownloadCloud, Film, PlayCircle, Package, ShoppingBag, type LucideIcon } from "lucide-react";

export type AppId =
  | "spin-wheel"
  | "scratch-card"
  | "countdown-bar"
  | "wishlist-reminder"
  | "migrate-store"
  | "shop-by-video"
  | "card-video"
  | "bundle-builder"
  | "upsell-crosssell";

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
      require_otp: true,
      wheel_style: "classic",
      sound_enabled: true,
      time_trigger_enabled: true,
      exit_intent_enabled: true,
      exit_intent_scope: "all",
      outcome_mode: "random",
      fixed_segment_index: 0,

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
  {
    id: "migrate-store",
    name: "Migrate My Store",
    tagline: "Import products, images, categories and pages from any public store URL",
    description:
      "Paste your existing store URL to copy its public catalog and pages. Products land as drafts for review; private orders and customers can be connected securely later.",
    icon: DownloadCloud,
    category: "conversion",
    status: "beta",
    accent: "from-sky-500 to-indigo-600",
    ConfigComponent: lazy(() => import("@/pages/appStore/MigrationConfig")),
  },
  {
    id: "shop-by-video",
    name: "Shop by Video",
    tagline: "Auto Reels-style video carousel of products that already have a video",
    description:
      "Adds a Shop-by-Video section under Best Sellers on your storefront. Every product that has a video uploaded automatically shows up in a mobile-first, muted-autoplay carousel with the product title, price and a See details CTA. You control the sequence, section title and card style from here.",
    icon: Film,
    category: "conversion",
    status: "live",
    accent: "from-fuchsia-500 to-rose-500",
    ConfigComponent: lazy(() => import("@/pages/appStore/ShopByVideoConfig")),
    defaultConfig: {
      title: "Shop by Video",
      autoplay: true,
      loop: true,
      aspect_ratio: "9:16",
      max_items: 10,
      show_price: true,
      show_cta: true,
      order: [] as string[],
    },
  },
  {
    id: "card-video",
    name: "Card Video (Mobile)",
    tagline: "Auto-play product videos right inside the product cards on mobile",
    description:
      "On phones, any product card whose product has a video plays it silently while it is on screen — exactly one video at a time. Cards without a video are untouched. Videos never download until they actually play, so category and home page load speed stays exactly the same. Automatically skipped on desktop, on data-saver and on slow (2G/3G) connections.",
    icon: PlayCircle,
    category: "conversion",
    status: "live",
    accent: "from-violet-500 to-sky-500",
    ConfigComponent: lazy(() => import("@/pages/appStore/CardVideoConfig")),
    defaultConfig: {},
  },
  {
    id: "bundle-builder",
    name: "Bundle Builder",
    tagline: "Pick-N, Fixed Combos & Frequently Bought Together",
    description:
      "Create combo offers — Pick N products for a flat price, curated Fixed Combos, or Frequently Bought Together strips. A Bundles menu appears on your storefront when at least one bundle is active.",
    icon: Package,
    category: "conversion",
    status: "live",
    accent: "from-amber-500 to-rose-500",
    ConfigComponent: lazy(() => import("@/pages/appStore/BundleBuilderConfig")),
    defaultConfig: { bundles: [] as any[] },
  },
  {
    id: "upsell-crosssell",
    name: "Upsell & Cross-sell",
    tagline: "Recommend products on PDP, cart & pre-checkout with optional discounts",
    description:
      "Create Offers that trigger on any / product / category / cart-value / cart-qty and recommend products manually or automatically (best sellers, same category). Add a % / ₹ discount or a free gift. Analytics for views, adds and revenue are built-in.",
    icon: ShoppingBag,
    category: "conversion",
    status: "beta",
    accent: "from-violet-500 to-indigo-600",
    ConfigComponent: lazy(() => import("@/pages/appStore/UpsellCrossSellConfig")),
    defaultConfig: { offers: [] as any[] },
  },
];

export function getApp(id: string): StoreAppMeta | undefined {
  return APP_REGISTRY.find((a) => a.id === id);
}
