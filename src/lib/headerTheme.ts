/**
 * Custom storefront header colour.
 *
 * Merchants can pick a header background (e.g. a premium brown) in Theme
 * Settings. Everything inside the header — hamburger, search, cart, wishlist,
 * text logo — reads `var(--storefront-text)`, so we scope that variable to the
 * header foreground and every icon/label flips automatically.
 */
import { isLightColor } from "@/lib/themeUtils";

export interface HeaderPreset {
  id: string;
  label: string;
  bg: string;
  /** Optional explicit foreground — otherwise auto-contrast. */
  fg?: string;
}

/** Curated premium header colours (researched for retail/ecommerce chrome). */
export const HEADER_PRESETS: HeaderPreset[] = [
  { id: "default", label: "Default", bg: "" },
  { id: "espresso", label: "Espresso Brown", bg: "#3B2A1E" },
  { id: "mocha", label: "Mocha", bg: "#4E342E" },
  { id: "onyx", label: "Premium Black", bg: "#0B0B0C" },
  { id: "graphite", label: "Graphite", bg: "#1F2226" },
  { id: "midnight", label: "Midnight Navy", bg: "#0F1B33" },
  { id: "royal", label: "Royal Indigo", bg: "#221C4A" },
  { id: "forest", label: "Deep Forest", bg: "#123227" },
  { id: "emerald", label: "Emerald", bg: "#04473C" },
  { id: "wine", label: "Wine Maroon", bg: "#4A0E1E" },
  { id: "royal-maroon", label: "Royal Maroon", bg: "#28070E" },
  { id: "crimson", label: "Crimson", bg: "#7A0F1F" },
  { id: "plum", label: "Plum", bg: "#3A1B3D" },
  { id: "teal", label: "Deep Teal", bg: "#0C3B45" },
  { id: "sand", label: "Warm Sand", bg: "#E7DDCE" },
  { id: "ivory", label: "Ivory", bg: "#F6F1E8" },
  { id: "champagne", label: "Champagne Gold", bg: "#C8A96A" },
];

const HEX = /^#[0-9a-fA-F]{6}$/;

export function resolveHeaderColors(themeConfig: Record<string, any> | null | undefined): {
  bg: string | undefined;
  fg: string | undefined;
} {
  const bgRaw = String(themeConfig?.header_bg_color || "").trim();
  if (!HEX.test(bgRaw)) return { bg: undefined, fg: undefined };
  const fgRaw = String(themeConfig?.header_text_color || "").trim();
  const fg = HEX.test(fgRaw) ? fgRaw : isLightColor(bgRaw) ? "#141414" : "#ffffff";
  return { bg: bgRaw, fg };
}
