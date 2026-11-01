import { lazy, Suspense } from "react";
import { useCart } from "@/contexts/CartContext";
import { useStoreEnabledApps } from "@/hooks/useStoreEnabledApps";
import { needsGiftReconciliation } from "@/lib/storefrontCapabilities";

const AutoFreeGift = lazy(() => import("./AutoFreeGift"));

export default function AutoFreeGiftGate({ storeSlug }: { storeSlug: string }) {
  const { items } = useCart();
  const { data: apps, isSuccess } = useStoreEnabledApps(storeSlug);
  if (!isSuccess || !needsGiftReconciliation(apps, items)) return null;
  return <Suspense fallback={null}><AutoFreeGift storeSlug={storeSlug} /></Suspense>;
}