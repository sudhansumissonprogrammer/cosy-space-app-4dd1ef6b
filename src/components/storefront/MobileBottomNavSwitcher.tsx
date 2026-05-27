/**
 * MobileBottomNavSwitcher — Lazy dispatcher for the 11 nav variants.
 *
 * Before: all 11 variants statically imported → one big chunk (~70KB) where
 *         10 variants were dead code for any given store.
 * After:  each variant lazy() → only the selected one is fetched
 *         (~5-10KB). Same number of network requests as before since the
 *         switcher itself is already lazy-loaded from each layout.
 *
 * The Suspense fallback is null — nav is below-the-fold and renders without
 * layout shift since each variant reserves the same 64px-tall safe area
 * via the parent layout's padding.
 */
import { lazy, Suspense } from "react";
import type { StoreData } from "@/layouts/StorefrontLayout";

const MobileBottomNav = lazy(() => import("./MobileBottomNav"));
const MobileBottomNavModern = lazy(() => import("./MobileBottomNavModern"));
const MobileBottomNavV15 = lazy(() => import("./MobileBottomNavV15"));
const MobileBottomNavV17 = lazy(() => import("./MobileBottomNavV17"));
const MobileBottomNavGlass = lazy(() => import("./MobileBottomNavGlass"));
const MobileBottomNavNotch = lazy(() => import("./MobileBottomNavNotch"));
const MobileBottomNavNeon = lazy(() => import("./MobileBottomNavNeon"));
const MobileBottomNavTube = lazy(() => import("./MobileBottomNavTube"));
const MobileBottomNavBubble = lazy(() => import("./MobileBottomNavBubble"));
const MobileBottomNav3D = lazy(() => import("./MobileBottomNav3D"));
const MobileBottomNavIndicator = lazy(() => import("./MobileBottomNavIndicator"));
const MobileBottomNavWave = lazy(() => import("./MobileBottomNavWave"));

export type NavVariant =
  | "classic"
  | "modern"
  | "v15"
  | "v17"
  | "glass"
  | "notch"
  | "neon"
  | "tube"
  | "bubble"
  | "skeuo3d"
  | "indicator";

interface Props {
  store: StoreData;
  variant: NavVariant;
}

export default function MobileBottomNavSwitcher({ store, variant }: Props) {
  const Component = (() => {
    switch (variant) {
      case "v17": return MobileBottomNavV17;
      case "v15": return MobileBottomNavV15;
      case "modern": return MobileBottomNavModern;
      case "glass": return MobileBottomNavGlass;
      case "notch": return MobileBottomNavNotch;
      case "neon": return MobileBottomNavNeon;
      case "tube": return MobileBottomNavTube;
      case "bubble": return MobileBottomNavBubble;
      case "skeuo3d": return MobileBottomNav3D;
      case "indicator": return MobileBottomNavIndicator;
      default: return MobileBottomNav;
    }
  })();

  return (
    <Suspense fallback={null}>
      <Component store={store} />
    </Suspense>
  );
}
