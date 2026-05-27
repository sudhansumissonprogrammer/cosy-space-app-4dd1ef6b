/**
 * MobileBottomNavSwitcher — Single lazy entry point that dispatches to the
 * correct nav variant. Consolidates all variants into 1 lazy chunk to reduce
 * Worker subrequests on cold load.
 */
import MobileBottomNav from "./MobileBottomNav";
import MobileBottomNavModern from "./MobileBottomNavModern";
import MobileBottomNavV15 from "./MobileBottomNavV15";
import MobileBottomNavV17 from "./MobileBottomNavV17";
import MobileBottomNavGlass from "./MobileBottomNavGlass";
import MobileBottomNavNotch from "./MobileBottomNavNotch";
import MobileBottomNavNeon from "./MobileBottomNavNeon";
import MobileBottomNavTube from "./MobileBottomNavTube";
import MobileBottomNavBubble from "./MobileBottomNavBubble";
import MobileBottomNav3D from "./MobileBottomNav3D";
import MobileBottomNavIndicator from "./MobileBottomNavIndicator";
import type { StoreData } from "@/layouts/StorefrontLayout";

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
  switch (variant) {
    case "v17": return <MobileBottomNavV17 store={store} />;
    case "v15": return <MobileBottomNavV15 store={store} />;
    case "modern": return <MobileBottomNavModern store={store} />;
    case "glass": return <MobileBottomNavGlass store={store} />;
    case "notch": return <MobileBottomNavNotch store={store} />;
    case "neon": return <MobileBottomNavNeon store={store} />;
    case "tube": return <MobileBottomNavTube store={store} />;
    case "bubble": return <MobileBottomNavBubble store={store} />;
    case "skeuo3d": return <MobileBottomNav3D store={store} />;
    case "indicator": return <MobileBottomNavIndicator store={store} />;
    default: return <MobileBottomNav store={store} />;
  }
}
