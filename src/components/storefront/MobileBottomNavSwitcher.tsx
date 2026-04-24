/**
 * MobileBottomNavSwitcher — Single lazy entry point that dispatches to the
 * correct nav variant. Consolidates 4 lazy chunks into 1 to reduce the
 * number of Worker subrequests on cold load (one Vite chunk includes all four).
 *
 * The four variants share <8KB combined when bundled together because they
 * share React, lucide-icons, react-router, and the cart/wishlist contexts.
 */
import MobileBottomNav from "./MobileBottomNav";
import MobileBottomNavModern from "./MobileBottomNavModern";
import MobileBottomNavV15 from "./MobileBottomNavV15";
import MobileBottomNavV17 from "./MobileBottomNavV17";
import type { StoreData } from "@/layouts/StorefrontLayout";

interface Props {
  store: StoreData;
  variant: "classic" | "modern" | "v15" | "v17";
}

export default function MobileBottomNavSwitcher({ store, variant }: Props) {
  if (variant === "v17") return <MobileBottomNavV17 store={store} />;
  if (variant === "v15") return <MobileBottomNavV15 store={store} />;
  if (variant === "modern") return <MobileBottomNavModern store={store} />;
  return <MobileBottomNav store={store} />;
}
