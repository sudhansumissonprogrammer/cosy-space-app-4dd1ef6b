/**
 * Shared theme utility functions — extracted from layout files to avoid duplication.
 */

/** Convert hex color to HSL components string (e.g. "210 50% 40%") */
export function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Compute a lighter tint of a hex color for gradients */
export function computePrimaryLight(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lighten = (c: number) => Math.min(255, Math.round(c + (255 - c) * 0.35));
  return `#${lighten(r).toString(16).padStart(2, "0")}${lighten(g).toString(16).padStart(2, "0")}${lighten(b).toString(16).padStart(2, "0")}`;
}

/** Check if a hex color is light (for choosing text color) */
export function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

/** Read lightweight theme hint injected by Worker (v4.1) */
export function getEdgeThemeHint(): { pc: string; bg: string; tc: string; ac: string; hf: string; bf: string; bs: string } | null {
  return (window as any).__THEME__ || null;
}

/** Build CSS variable style object from theme config + optional preview override */
export function buildThemeStyle(
  themeConfig: Record<string, any> | null,
  previewOverride: Record<string, string> | null,
  defaultPrimary = "#004643",
  defaultButtonRadius = "0.5rem"
): { themeStyle: React.CSSProperties; primaryColor: string; btnTextColor: string } {
  // v4.1: Use edge theme hint as fallback when themeConfig hasn't loaded yet
  const edgeHint = getEdgeThemeHint();
  const primaryColor = themeConfig?.primary_color || edgeHint?.pc || defaultPrimary;
  const primaryLight = computePrimaryLight(primaryColor);
  const btnTextColor = isLightColor(primaryColor) ? "#1a1a1a" : "#ffffff";
  const primaryHsl = hexToHsl(primaryColor);
  const primaryFgHsl = isLightColor(primaryColor) ? "0 0% 10%" : "0 0% 100%";

  const baseOverrides = {
    "--primary": primaryHsl,
    "--primary-foreground": primaryFgHsl,
  };

  // Footer text color: contrasts against primary (used as footer bg)
  const footerTextColor = isLightColor(primaryColor) ? "#1a1a1a" : "#ffffff";

  const themeStyle: React.CSSProperties = (previewOverride
    ? { ...previewOverride, ...baseOverrides, "--storefront-footer-text": footerTextColor }
    : themeConfig
    ? {
        "--storefront-primary": themeConfig.primary_color,
        "--storefront-primary-light": primaryLight,
        "--storefront-accent": themeConfig.accent_color,
        "--storefront-text": themeConfig.text_color,
        "--storefront-bg": themeConfig.background_color,
        "--storefront-heading-font": `'${themeConfig.heading_font}'`,
        "--storefront-body-font": `'${themeConfig.body_font}'`,
        "--storefront-button-radius":
          themeConfig.button_style === "pill" ? "9999px" : themeConfig.button_style === "square" ? "0px" : defaultButtonRadius,
        "--storefront-marquee-gradient": themeConfig.marquee_gradient,
        "--storefront-btn-text": btnTextColor,
        "--storefront-footer-text": footerTextColor,
        ...baseOverrides,
      }
    : { ...baseOverrides }) as any;

  return { themeStyle, primaryColor, btnTextColor };
}

/** Load Google Fonts dynamically for theme config — non-blocking */
export function loadGoogleFonts(themeConfig: Record<string, any> | null) {
  if (!themeConfig) return;
  const fonts = [...new Set([themeConfig.heading_font, themeConfig.body_font].filter(Boolean))];
  if (fonts.length === 0) return;
  const families = fonts.map((f: string) => `family=${f.replace(/ /g, "+")}:wght@100..900`).join("&");
  const linkId = "storefront-google-fonts";
  let link = document.getElementById(linkId) as HTMLLinkElement;
  if (!link) {
    link = document.createElement("link");
    link.id = linkId;
    link.rel = "stylesheet";
    // Non-blocking: load as print, swap to all on load
    link.media = "print";
    link.onload = () => { link.media = "all"; };
    document.head.appendChild(link);
  }
  const newHref = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  if (link.href !== newHref) {
    link.media = "print";
    link.onload = () => { link.media = "all"; };
    link.href = newHref;
  }
}
