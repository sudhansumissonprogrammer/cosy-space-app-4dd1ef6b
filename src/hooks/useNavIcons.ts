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

// Getters are cached by the resolved picks signature so that every consumer
// (headers, bottom navs, and *every product card in a grid*) shares one stable
// function identity. Without this, each card produced its own getter and broke
// downstream memo() equality on theme-config cache ticks.
const GETTER_CACHE = new Map<string, (slot: NavSlot) => LucideIcon>();

function buildGetter(picks: NavIconsMap) {
  let key = "{}";
  try { key = JSON.stringify(picks ?? {}); } catch {}
  const hit = GETTER_CACHE.get(key);
  if (hit) return hit;
  const getter = (slot: NavSlot): LucideIcon => resolveNavIcon(slot, picks[slot]);
  if (GETTER_CACHE.size > 50) GETTER_CACHE.clear();
  GETTER_CACHE.set(key, getter);
  return getter;
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
