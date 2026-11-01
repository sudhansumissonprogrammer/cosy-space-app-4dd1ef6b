import type { EnabledAppRow } from "@/hooks/useStoreEnabledApps";

export function hasStorefrontApp(apps: EnabledAppRow[] | undefined): boolean {
  return !!apps?.some((app) => app.app_id === "spin-wheel");
}

export function needsGiftReconciliation(apps: EnabledAppRow[] | undefined, items: { meta?: Record<string, unknown> }[]): boolean {
  if (!items.length) return false;
  if (items.some((item) => item.meta?.auto_gift === true)) return true;
  const upsell = apps?.find((app) => app.app_id === "upsell-crosssell");
  return !!upsell?.config?.offers?.some((offer: { active?: boolean; incentive?: { type?: string }; trigger?: { type?: string } }) =>
    offer?.active !== false && offer.incentive?.type === "free_gift" && offer.trigger?.type === "cart_value");
}