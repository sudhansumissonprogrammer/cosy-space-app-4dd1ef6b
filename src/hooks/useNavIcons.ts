/**
 * useNavIcons — resolve the merchant's chosen icon for each nav slot.
 *
 * Reads `nav_icons` JSON from the storefront theme config and returns a
 * synchronous lookup. Icons are statically imported (see navIconRegistry),
 * so swapping is instant — no async chunk, no flicker.
 *
 * Two flavors:
 *   - useNavIcons() — reads the active storefront theme config from cache.
 *   - useNavIconsFromConfig(cfg) — for previews / admin where you already
 *     have a config object in hand.
 */
import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  resolveNavIcon,
  type NavSlot,
} from "@/lib/navIconRegistry";
import type { LucideIcon } from "lucide-react";

type NavIconsMap = Partial<Record<NavSlot, string>>;

function buildGetter(picks: NavIconsMap | null | undefined) {
  return (slot: NavSlot): LucideIcon => resolveNavIcon(slot, picks?.[slot]);
}

/** Pull picks from any object shape ({nav_icons: {...}} or already the map). */
function extractPicks(themeConfig: any): NavIconsMap {
  if (!themeConfig) return {};
  if (themeConfig.nav_icons && typeof themeConfig.nav_icons === "object") {
    return themeConfig.nav_icons as NavIconsMap;
  }
  return {};
}

/**
 * Look up the active storefront theme config from the React Query cache.
 * We scan all `storefront-theme-config` entries — there is typically one
 * active store per page, so the first non-null match wins. This avoids
 * needing to thread storeId through every nav component.
 */
export function useNavIcons() {
  const qc = useQueryClient();
  return useMemo(() => {
    const entries = qc.getQueriesData({ queryKey: ["storefront-theme-config"] });
    let picks: NavIconsMap = {};
    for (const [, data] of entries) {
      if (data) {
        picks = extractPicks(data);
        break;
      }
    }
    return buildGetter(picks);
    // Re-resolve when route or cache changes — cheap enough to recompute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc]);
}

/** Direct getter when you already have a themeConfig object. */
export function useNavIconsFromConfig(themeConfig: any) {
  return useMemo(() => buildGetter(extractPicks(themeConfig)), [themeConfig]);
}
