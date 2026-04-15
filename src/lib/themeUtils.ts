/**
 * Shared theme utility functions — extracted from layout files to avoid duplication.
 */

const GOOGLE_FONT_WEIGHTS = "400;500;600;700";
const DEFAULT_HEADING_FONT = "Alegreya SC";
const DEFAULT_BODY_FONT = "Inter";
const DEFAULT_TEXT_COLOR = "#1a1a1a";
const DEFAULT_BACKGROUND_COLOR = "#ffffff";
const FONT_READY_TIMEOUT_MS = 3000;
// Only fonts that are actually bundled in the app should be treated as self-hosted.
const SELF_HOSTED_FONTS = new Set([
  DEFAULT_BODY_FONT,
  "Plus Jakarta Sans",
  "Montserrat Alternates",
]);

function normalizeGoogleFontName(font: string): string {
  return font.trim().replace(/^['"]|['"]$/g, "").replace(/\s+/g, " ");
}

export function getResolvedThemeFonts(themeConfig: Record<string, any> | null): {
  headingFont: string;
  bodyFont: string;
} {
  const edgeHint = getEdgeThemeHint();

  return {
    headingFont: normalizeGoogleFontName(
      String(themeConfig?.heading_font || edgeHint?.hf || DEFAULT_HEADING_FONT)
    ),
    bodyFont: normalizeGoogleFontName(
      String(themeConfig?.body_font || edgeHint?.bf || DEFAULT_BODY_FONT)
    ),
  };
}

function getThemeFontList(themeConfig: Record<string, any> | null): string[] {
  const { headingFont, bodyFont } = getResolvedThemeFonts(themeConfig);
  return [...new Set([headingFont, bodyFont].filter(Boolean))];
}

function buildGoogleFontsHref(fonts: string[]): string | null {
  const families = fonts
    .map(normalizeGoogleFontName)
    .filter((font) => Boolean(font) && !SELF_HOSTED_FONTS.has(font))
    .map((font) => `family=${font.replace(/ /g, "+")}:wght@${GOOGLE_FONT_WEIGHTS}`)
    .join("&");

  return families ? `https://fonts.googleapis.com/css2?${families}&display=swap` : null;
}

function getButtonRadius(buttonStyle: string | undefined, defaultButtonRadius: string) {
  return buttonStyle === "pill" ? "9999px" : buttonStyle === "square" ? "0px" : defaultButtonRadius;
}

function waitForStylesheetLoad(link: HTMLLinkElement, timeoutMs = FONT_READY_TIMEOUT_MS): Promise<void> {
  if (link.dataset.loaded === "true" || link.sheet) {
    link.dataset.loaded = "true";
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const finalize = () => {
      link.dataset.loaded = "true";
      resolve();
    };

    const handleDone = () => {
      window.clearTimeout(timeoutId);
      finalize();
    };

    const timeoutId = window.setTimeout(handleDone, timeoutMs);
    link.addEventListener("load", handleDone, { once: true });
    link.addEventListener("error", handleDone, { once: true });
  });
}

async function waitForFontFaces(fonts: string[], timeoutMs = FONT_READY_TIMEOUT_MS) {
  if (!fonts.length || typeof document === "undefined" || !("fonts" in document)) return;

  const waitForFont = async (font: string) => {
    const regularSpec = `normal 400 1em "${font}"`;
    const boldSpec = `normal 700 1em "${font}"`;

    if (document.fonts.check(regularSpec) || document.fonts.check(boldSpec)) return;

    await Promise.race([
      Promise.allSettled([
        document.fonts.load(regularSpec),
        document.fonts.load(boldSpec),
      ]).then(() => undefined),
      new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs)),
    ]);
  };

  await Promise.allSettled(fonts.map((font) => waitForFont(font)));
}

function ensureGoogleFontsPreconnect() {
  const preconnects = [
    { id: "storefront-google-fonts-preconnect", href: "https://fonts.googleapis.com" },
    { id: "storefront-gstatic-preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  ];

  preconnects.forEach(({ id, href, crossOrigin }) => {
    if (document.getElementById(id)) return;

    const link = document.createElement("link");
    link.id = id;
    link.rel = "preconnect";
    link.href = href;
    if (crossOrigin) link.crossOrigin = crossOrigin;
    document.head.appendChild(link);
  });
}

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
  const accentColor = themeConfig?.accent_color || edgeHint?.ac || primaryColor;
  const textColor = themeConfig?.text_color || edgeHint?.tc || DEFAULT_TEXT_COLOR;
  const backgroundColor = themeConfig?.background_color || edgeHint?.bg || DEFAULT_BACKGROUND_COLOR;
  const { headingFont, bodyFont } = getResolvedThemeFonts(themeConfig);
  const buttonStyle = themeConfig?.button_style || edgeHint?.bs || "rounded";
  const primaryLight = computePrimaryLight(primaryColor);
  const btnTextColor = isLightColor(primaryColor) ? "#1a1a1a" : "#ffffff";
  const primaryHsl = hexToHsl(primaryColor);
  const primaryFgHsl = isLightColor(primaryColor) ? "0 0% 10%" : "0 0% 100%";
  const marqueeGradient =
    themeConfig?.marquee_gradient || `linear-gradient(90deg, ${primaryColor}, ${primaryLight}, ${primaryColor})`;

  const baseOverrides = {
    "--primary": primaryHsl,
    "--primary-foreground": primaryFgHsl,
  };

  // Footer text color: contrasts against primary (used as footer bg)
  const footerTextColor = isLightColor(primaryColor) ? "#1a1a1a" : "#ffffff";

  const defaultThemeStyle: React.CSSProperties = {
    "--storefront-primary": primaryColor,
    "--storefront-primary-light": primaryLight,
    "--storefront-accent": accentColor,
    "--storefront-text": textColor,
    "--storefront-bg": backgroundColor,
    "--storefront-heading-font": `'${headingFont}'`,
    "--storefront-body-font": `'${bodyFont}'`,
    "--storefront-button-radius": getButtonRadius(buttonStyle, defaultButtonRadius),
    "--storefront-marquee-gradient": marqueeGradient,
    "--storefront-btn-text": btnTextColor,
    "--storefront-footer-text": footerTextColor,
    ...baseOverrides,
  } as any;

  const themeStyle: React.CSSProperties = {
    ...defaultThemeStyle,
    ...(previewOverride ?? {}),
  } as any;

  return { themeStyle, primaryColor, btnTextColor };
}

/** Load Google Fonts dynamically for theme config.
 *
 * IMPORTANT: The Cloudflare Worker injects a `<link id="storefront-google-fonts">`
 * in the HTML shell with ALL theme fonts (including self-hosted ones like Inter).
 * React's `buildGoogleFontsHref` filters self-hosted fonts, producing a different
 * URL. Overwriting the Worker's href would cause a re-fetch and a visible FOUT
 * (Flash of Unstyled Text). So if the Worker already injected a link with a valid
 * href containing the required fonts, we leave it untouched.
 */
export function loadGoogleFonts(themeConfig: Record<string, any> | null) {
  const fonts = getThemeFontList(themeConfig);
  const newHref = buildGoogleFontsHref(fonts);

  const linkId = "storefront-google-fonts";
  let link = document.getElementById(linkId) as HTMLLinkElement;

  // If Worker already injected the link, check if it already covers our fonts.
  // Only re-set href if a required font family is missing from the existing URL.
  if (link && link.href) {
    const existingHref = link.href;
    const allFontsCovered = fonts
      .map(normalizeGoogleFontName)
      .filter((f) => Boolean(f) && !SELF_HOSTED_FONTS.has(f))
      .every((f) => existingHref.includes(f.replace(/ /g, "+")));

    if (allFontsCovered) {
      // Worker link already has everything we need — don't touch it
      return link;
    }
  }

  if (!newHref) return null;

  ensureGoogleFontsPreconnect();

  if (!link) {
    link = document.createElement("link");
    link.id = linkId;
    link.rel = "stylesheet";
    link.media = "all";
    link.setAttribute("fetchpriority", "high");
    link.dataset.loaded = "false";
    document.head.appendChild(link);
  }
  if (link.href !== newHref) {
    link.dataset.loaded = "false";
    link.media = "all";
    link.href = newHref;
  }

  return link;
}

export async function ensureThemeFontsLoaded(
  themeConfig: Record<string, any> | null,
  timeoutMs = FONT_READY_TIMEOUT_MS
) {
  const fonts = getThemeFontList(themeConfig);
  const stylesheetLink = loadGoogleFonts(themeConfig);
  const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
  const getRemainingMs = () => {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    return Math.max(0, timeoutMs - (now - startedAt));
  };

  if (stylesheetLink) {
    await waitForStylesheetLoad(stylesheetLink, getRemainingMs());
  }

  const remainingMs = getRemainingMs();
  if (remainingMs > 0) {
    await waitForFontFaces(fonts, remainingMs);
  }
}
