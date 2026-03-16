import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

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
    const computePL = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const l = (c: number) => Math.min(255, Math.round(c + (255 - c) * 0.35));
      return `#${l(r).toString(16).padStart(2, "0")}${l(g).toString(16).padStart(2, "0")}${l(b).toString(16).padStart(2, "0")}`;
    };
    const isLight = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return (r * 299 + g * 587 + b * 114) / 1000 > 160;
    };
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "theme-preview" && e.data.config) {
        const c = e.data.config;
        setPreviewOverride({
          "--storefront-primary": c.primary_color,
          "--storefront-primary-light": computePL(c.primary_color),
          "--storefront-accent": c.accent_color,
          "--storefront-text": c.text_color,
          "--storefront-bg": c.background_color,
          "--storefront-heading-font": c.heading_font,
          "--storefront-body-font": c.body_font,
          "--storefront-button-radius":
            c.button_style === "pill" ? "9999px" : c.button_style === "square" ? "0px" : "0.5rem",
          "--storefront-marquee-gradient": c.marquee_gradient,
          "--storefront-btn-text": isLight(c.primary_color) ? "#1a1a1a" : "#ffffff",
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
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [storeId, queryClient]);

  return previewOverride;
}
