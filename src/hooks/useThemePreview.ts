import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { loadGoogleFonts } from "@/lib/themeUtils";

/**
 * Listens for postMessage from admin dashboard iframe parent
 * to provide live theme preview without page reload.
 * 
 * Pass storeId so that product_card_style / category_style changes
 * are written into the React Query cache and picked up instantly
 * by storefront components.
 */
export function useThemePreview(storeId?: string) {
  const [previewOverride, setPreviewOverride] = useState<Record<string, string> | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const isValidHex = (hex: string) => typeof hex === "string" && /^#[0-9a-fA-F]{6}$/.test(hex);
    const computePL = (hex: string) => {
      if (!isValidHex(hex)) return "#cccccc";
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const l = (c: number) => Math.min(255, Math.round(c + (255 - c) * 0.35));
      return `#${l(r).toString(16).padStart(2, "0")}${l(g).toString(16).padStart(2, "0")}${l(b).toString(16).padStart(2, "0")}`;
    };
    const isLight = (hex: string) => {
      if (!isValidHex(hex)) return false;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return (r * 299 + g * 587 + b * 114) / 1000 > 160;
    };
    const handler = (e: MessageEvent) => {
      try {
        if (e.data?.type === "theme-preview" && e.data.config) {
          const c = e.data.config;
          loadGoogleFonts(c);
          // Guard against missing/invalid values
          const primary = c.primary_color || "#000000";
          const accent = c.accent_color || "#666666";
          const text = c.text_color || "#1a1a1a";
          const bg = c.background_color || "#ffffff";
          const headingFont = c.heading_font || "Inter";
          const bodyFont = c.body_font || "Inter";
          const marqueeGradient = c.marquee_gradient || `linear-gradient(90deg, ${primary}, ${primary})`;
          const buttonStyle = c.button_style || "rounded";

          setPreviewOverride({
            "--storefront-primary": primary,
            "--storefront-primary-light": computePL(primary),
            "--storefront-accent": accent,
            "--storefront-text": text,
            "--storefront-bg": bg,
            "--storefront-heading-font": `'${headingFont}'`,
            "--storefront-body-font": `'${bodyFont}'`,
            "--storefront-button-radius":
              buttonStyle === "pill" ? "9999px" : buttonStyle === "square" ? "0px" : "0.5rem",
            "--storefront-marquee-gradient": marqueeGradient,
            "--storefront-btn-text": isLight(primary) ? "#1a1a1a" : "#ffffff",
          });

          // Update React Query cache so product_card_style & category_style
          // are picked up instantly by storefront components
          if (storeId) {
            queryClient.setQueryData(["storefront-theme-config", storeId], (old: any) => ({
              ...old,
              ...c,
            }));
          }
        }
      } catch (err) {
        console.warn("Theme preview message error:", err);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [storeId, queryClient]);

  return previewOverride;
}
