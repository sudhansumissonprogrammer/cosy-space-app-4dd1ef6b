import { lazy, Suspense, useEffect, useState } from "react";
import { useCart } from "@/contexts/CartContext";
import type { StoreData } from "@/layouts/StorefrontLayout.logic";

const SideCart = lazy(() => import("./SideCart"));

/** Load on cart intent, retain on close so cart state and reopening stay stable. */
export default function SideCartGate({ store }: { store: StoreData }) {
  const { isCartOpen } = useCart();
  const [activated, setActivated] = useState(isCartOpen);
  useEffect(() => { if (isCartOpen) setActivated(true); }, [isCartOpen]);
  if (!activated && !isCartOpen) return null;
  return <Suspense fallback={null}><SideCart store={store} /></Suspense>;
}