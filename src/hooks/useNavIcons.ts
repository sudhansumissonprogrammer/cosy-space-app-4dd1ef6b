/**
 * useNavIcons — resolve the merchant's chosen icon for each nav slot.
 *
 * Reads `nav_icons` JSON from the storefront theme config and returns a
 * synchronous lookup. Icons are statically imported (see navIconRegistry),
 * so swapping is instant — no async chunk, no flicker.
 */
import { useMemo } from "react";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import {
  resolveNavIcon,
  type NavSlot,
} from "@/lib/navIconRegistry";
import type { LucideIcon } from "lucide-react";

type NavIconsMap = Partial<Record<NavSlot, string>>;

function extractPicks(themeConfig: any): NavIconsMap {
  if (!themeConfig) return {};
  if (themeConfig.nav_icons && typeof themeConfig.nav_icons === "object") {
    return themeConfig.nav_icons as NavIconsMap;
  }
  return {};
}

function buildGetter(picks: NavIconsMap) {
  return (slot: NavSlot): LucideIcon => resolveNavIcon(slot, picks[slot]);
}

/** Reactive — re-renders when the theme config cache updates (live preview). */
export function useNavIcons(storeId?: string) {
  const themeConfig = useStorefrontThemeConfig(storeId);
  return useMemo(() => buildGetter(extractPicks(themeConfig)), [themeConfig]);
}

/** Direct getter for admin previews that already hold a config object. */
export function useNavIconsFromConfig(themeConfig: any) {
  return useMemo(() => buildGetter(extractPicks(themeConfig)), [themeConfig]);
}
