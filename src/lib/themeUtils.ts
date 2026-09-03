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
  DEFAULT_HEADING_FONT,
  "Poppins",
  "Outfit",
  "Plus Jakarta Sans",
  "Montserrat Alternates",
  "Mulish",
]);

const SELF_HOSTED_FONT_FACES: Record<string, Array<{ weight: string; url: string; display?: "swap" | "optional" }>> = {
  "Alegreya SC": [
    { weight: "400", url: "/fonts/alegreya-sc-400-v2.woff2", display: "swap" },
    { weight: "700", url: "/fonts/alegreya-sc-700-v2.woff2", display: "swap" },
  ],
  Poppins: [
    { weight: "400", url: "/fonts/poppins-400.woff2" },
    { weight: "500", url: "/fonts/poppins-500.woff2" },
    { weight: "600", url: "/fonts/poppins-600.woff2" },
    { weight: "700", url: "/fonts/poppins-700.woff2" },
    { weight: "800", url: "/fonts/poppins-800.woff2" },
  ],
  Outfit: [
    { weight: "100 900", url: "/fonts/outfit-latin.woff2" },
    { weight: "100 900", url: "/fonts/outfit-latin-ext.woff2" },
  ],
  "Montserrat Alternates": [
    { weight: "400", url: "/fonts/montserrat-alternates-400.woff2" },
    { weight: "500", url: "/fonts/montserrat-alternates-500.woff2" },
    { weight: "600", url: "/fonts/montserrat-alternates-600.woff2", display: "swap" },
    { weight: "700", url: "/fonts/montserrat-alternates-700.woff2", display: "swap" },
  ],
  Mulish: [
    { weight: "200 1000", url: "/fonts/mulish-latin.woff2" },
  ],
  Inter: [
    { weight: "100 900", url: "/fonts/inter-latin.woff2", display: "swap" },
  ],
};

function normalizeGoogleFontName(font: string): string {
  return font.trim().replace(/^['"]|['"]$/g, "").replace(/\s+/g, " ");
}

/**
 * ─── Font normalization layer ────────────────────────────────────────────
 * Every typeface renders at a different optical size for the same CSS
 * font-size: cap-height, x-height and average advance width all differ.
 * That is why swapping the storefront font used to make titles look huge,
 * prices dominant and cards crowded.
 *
 * Metrics come from each font's binary (OS/2 sCapHeight / sxHeight and
 * hmtx advances, normalized by unitsPerEm) — see the full table below.

 *
 * Normalization is OPTICAL, not numeric: we do not force identical CSS
 * values. Instead each font gets
 *   • `font-size-adjust` so its cap-height (headings) / x-height (body)
 *     matches the benchmark → no more "this font renders 20% bigger"
 *   • tracking compensation based on advance width (wide fonts tighten,
 *     condensed fonts open up)
 *   • a weight + line-height profile matched to its natural colour
 *
 * BENCHMARK RULE: "Alegreya SC" (headings) and "Inter" (body) are the
 * reference design and MUST stay pixel-identical — their entries use
 * `none` / `inherit` so not a single rule changes for them.
 */
export type FontTuning = {
  /** heading letter-spacing */
  tracking: string;
  /** heading font-weight */
  weight: number;
  /** heading line-height */
  leading: number;
  /** heading `font-size-adjust` value — normalizes cap-height */
  adjust: string;
};

export type BodyTuning = {
  tracking: string;
  weight: number | string;
  leading: string;
  /** body `font-size-adjust` value — normalizes x-height */
  adjust: string;
};

/**
 * TRUE metrics, read from each font's binary (OS/2 sCapHeight, sxHeight,
 * hmtx advance widths, normalized by unitsPerEm) — not eyeballed:
 *
 *   font                    cap     ex     adv        font                  cap     ex     adv
 *   Alegreya SC  (H bench) 0.636  0.452  0.530        Poppins              0.698  0.548  0.561
 *   Inter        (B bench) 0.728  0.546  0.536        Montserrat           0.700  0.525  0.574
 *   Montserrat Alternates  0.700  0.525  0.588        Roboto               0.711  0.528  0.499
 *   Playfair Display       0.708  0.514  0.509        Open Sans            0.714  0.535  0.522
 *   Cormorant              0.625  0.386  0.440        Oswald               0.810  0.578  0.400
 *   Bodoni Moda            0.750  0.460  0.533        Raleway              0.710  0.519  0.526
 *   DM Serif Display       0.660  0.481  0.515        Merriweather         0.743  0.555  0.559
 *   Fraunces               0.700  0.482  0.536        DM Sans              0.700  0.504  0.522
 *   Cinzel                 0.700  0.500  0.639        Plus Jakarta Sans    0.745  0.536  0.540
 *   Syne                   0.650  0.500  0.503        Manrope              0.720  0.540  0.523
 *   Lora                   0.700  0.500  0.524        Rubik                0.700  0.520  0.531
 *   Nunito Sans            0.705  0.486  0.508        Space Grotesk        0.700  0.486  0.556
 *
 * Heading target: cap-height 0.636 (Alegreya SC), clamped to ±(0.86…1.12)×
 * the font's own cap so no face is distorted beyond a sane range.
 * Body target: x-height 0.546 (Inter), clamped to (0.90…1.15)×.
 * Body `font-size-adjust` is emitted as a bare number (the classic
 * x-height syntax) → supported since Firefox 3 / Chrome 127, i.e. far wider
 * reach than the two-value form, which is only needed for cap-height.
 * Tracking is derived from advance-width-per-cap (headings) and
 * advance-width-per-x-height (body) versus the benchmark, so wide faces
 * tighten and condensed faces open up.
 */
type FontProfile = { head: FontTuning; body: BodyTuning };

const FONT_METRICS: Record<string, FontProfile> = {
  // ── Benchmarks — MUST stay pixel-identical ────────────────────────────
  "Alegreya SC": {
    head: { tracking: "0.02em", weight: 700, leading: 1.2, adjust: "none" },
    body: { tracking: "inherit", weight: "inherit", leading: "inherit", adjust: "none" },
  },
  "Inter": {
    head: { tracking: "-0.02em", weight: 700, leading: 1.15, adjust: "cap-height 0.636" },
    body: { tracking: "inherit", weight: "inherit", leading: "inherit", adjust: "none" },
  },

  // ── Display serifs ────────────────────────────────────────────────────
  "Playfair Display": {
    head: { tracking: "0.007em", weight: 700, leading: 1.16, adjust: "cap-height 0.636" },
    body: { tracking: "0em", weight: 400, leading: "1.62", adjust: "0.546" },
  },
  "Bodoni Moda": {
    // cap 0.750 = one of the tallest → biggest heading down-scale; hairline
    // strokes need +1 weight step at body sizes to survive on mobile.
    head: { tracking: "0.007em", weight: 600, leading: 1.16, adjust: "cap-height 0.645" },
    body: { tracking: "-0.009em", weight: 500, leading: "1.65", adjust: "0.529" },
  },
  "DM Serif Display": {
    head: { tracking: "0.003em", weight: 400, leading: 1.18, adjust: "cap-height 0.636" },
    body: { tracking: "-0.004em", weight: 400, leading: "1.6", adjust: "0.546" },
  },
  "Fraunces": {
    head: { tracking: "0.004em", weight: 600, leading: 1.14, adjust: "cap-height 0.636" },
    body: { tracking: "-0.007em", weight: 400, leading: "1.6", adjust: "0.546" },
  },
  "Cormorant": {
    // ex 0.386 = smallest of the whole set → largest body up-scale (capped
    // at 1.15×) plus a heavier default weight so it never looks washed out.
    head: { tracking: "0.008em", weight: 600, leading: 1.18, adjust: "cap-height 0.636" },
    body: { tracking: "-0.008em", weight: 500, leading: "1.6", adjust: "0.444" },
  },
  "Cinzel": {
    // adv 0.639 = widest face → the only heading that needs tightening.
    head: { tracking: "-0.005em", weight: 600, leading: 1.22, adjust: "cap-height 0.636" },
    body: { tracking: "-0.012em", weight: 500, leading: "1.6", adjust: "0.546" },
  },
  "Lora": {
    head: { tracking: "0.005em", weight: 600, leading: 1.2, adjust: "cap-height 0.636" },
    body: { tracking: "-0.003em", weight: 400, leading: "1.62", adjust: "0.546" },
  },
  "Merriweather": {
    // heavy colour + tall cap → lighter heading weight, big down-scale.
    head: { tracking: "0.005em", weight: 600, leading: 1.22, adjust: "cap-height 0.639" },
    body: { tracking: "-0.001em", weight: 400, leading: "1.65", adjust: "0.546" },
  },

  // ── Geometric / grotesque sans ────────────────────────────────────────
  "Syne": {
    head: { tracking: "0.004em", weight: 700, leading: 1.14, adjust: "cap-height 0.636" },
    body: { tracking: "-0.001em", weight: 400, leading: "1.55", adjust: "0.546" },
  },
  "Space Grotesk": {
    head: { tracking: "0.002em", weight: 600, leading: 1.16, adjust: "cap-height 0.636" },
    body: { tracking: "-0.008em", weight: 400, leading: "1.55", adjust: "0.546" },
  },
  "DM Sans": {
    head: { tracking: "0.005em", weight: 700, leading: 1.16, adjust: "cap-height 0.636" },
    body: { tracking: "-0.003em", weight: 400, leading: "1.55", adjust: "0.546" },
  },
  "Plus Jakarta Sans": {
    head: { tracking: "0.007em", weight: 700, leading: 1.16, adjust: "cap-height 0.641" },
    body: { tracking: "-0.001em", weight: 400, leading: "1.55", adjust: "0.546" },
  },
  "Manrope": {
    head: { tracking: "0.006em", weight: 700, leading: 1.16, adjust: "cap-height 0.636" },
    body: { tracking: "0.001em", weight: 400, leading: "1.55", adjust: "0.546" },
  },
  "Poppins": {
    // wide geometric, very heavy at 700 → 600 heading.
    head: { tracking: "0.002em", weight: 600, leading: 1.2, adjust: "cap-height 0.636" },
    body: { tracking: "-0.002em", weight: 400, leading: "1.6", adjust: "0.546" },
  },
  "Montserrat": {
    // adv 0.574 → runs wide; ex-normalizing alone still reads ~1 step larger
    // than Inter, so shave the optical size a touch and tighten tracking.
    head: { tracking: "-0.002em", weight: 600, leading: 1.2, adjust: "cap-height 0.630" },
    body: { tracking: "-0.009em", weight: 400, leading: "1.58", adjust: "0.512" },
  },
  "Montserrat Alternates": {
    // adv 0.588 = 2nd widest of the whole set. Matching x-height to Inter
    // (0.546) made every line render ~4% larger AND ~10% wider, which is why
    // prices/PDP copy looked oversized. Target a slightly smaller x-height
    // (0.500 ≈ 0.95× its natural 0.525) so the block reads at Inter's size.
    head: { tracking: "-0.004em", weight: 600, leading: 1.18, adjust: "cap-height 0.624" },
    body: { tracking: "-0.011em", weight: 400, leading: "1.55", adjust: "0.500" },
  },

  "Rubik": {
    head: { tracking: "0.004em", weight: 600, leading: 1.2, adjust: "cap-height 0.636" },
    body: { tracking: "-0.002em", weight: 400, leading: "1.58", adjust: "0.546" },
  },
  "Raleway": {
    head: { tracking: "0.006em", weight: 700, leading: 1.18, adjust: "cap-height 0.636" },
    body: { tracking: "-0.002em", weight: 400, leading: "1.6", adjust: "0.546" },
  },
  "Nunito Sans": {
    head: { tracking: "0.007em", weight: 700, leading: 1.2, adjust: "cap-height 0.636" },
    body: { tracking: "-0.003em", weight: 400, leading: "1.6", adjust: "0.546" },
  },
  "Open Sans": {
    head: { tracking: "0.006em", weight: 700, leading: 1.2, adjust: "cap-height 0.636" },
    body: { tracking: "0em", weight: 400, leading: "1.6", adjust: "0.546" },
  },
  "Roboto": {
    head: { tracking: "0.008em", weight: 700, leading: 1.18, adjust: "cap-height 0.636" },
    body: { tracking: "0.002em", weight: 400, leading: "1.58", adjust: "0.546" },
  },
  "Oswald": {
    // cap 0.810 (tallest) + adv 0.400 (most condensed) → biggest down-scale
    // and the largest tracking opening of the set.
    head: { tracking: "0.02em", weight: 500, leading: 1.16, adjust: "cap-height 0.697" },
    body: { tracking: "0.014em", weight: 400, leading: "1.55", adjust: "0.546" },
  },
};

/** Any font not in the table (legacy DB value, custom pick) still gets sane optics. */
const FALLBACK_PROFILE: FontProfile = {
  head: { tracking: "0.004em", weight: 700, leading: 1.2, adjust: "cap-height 0.636" },
  body: { tracking: "0em", weight: 400, leading: "1.58", adjust: "0.546" },
};

function getFontProfile(font: string): FontProfile {
  return FONT_METRICS[normalizeGoogleFontName(font)] ?? FALLBACK_PROFILE;
}


export function getHeadingTuning(font: string): FontTuning {
  return getFontProfile(font).head;
}

export function getBodyTuning(font: string): BodyTuning {
  return getFontProfile(font).body;
}

/** Serif/display families — used for pairing sanity checks. */
const DISPLAY_SERIFS = new Set([
  "Playfair Display", "Bodoni Moda", "DM Serif Display", "Fraunces",
  "Cormorant", "Cinzel", "Alegreya SC",
]);
const TEXT_SERIFS = new Set(["Lora", "Merriweather"]);
const NARROW_BODY = new Set(["Oswald", "Cinzel", "Bodoni Moda", "DM Serif Display"]);

/**
 * Pairing guard. Returns null when the combination is safe, otherwise a
 * short human explanation of why the pairing hurts hierarchy/readability.
 */
export function getPairingAdvice(
  headingFont: string,
  bodyFont: string
): { level: "warn" | "info"; message: string } | null {
  const h = normalizeGoogleFontName(headingFont);
  const b = normalizeGoogleFontName(bodyFont);

  if (h === b && DISPLAY_SERIFS.has(h)) {
    return { level: "warn", message: `${h} is a display face — using it for body text too flattens hierarchy and hurts readability. Pair it with Inter or Manrope.` };
  }
  if (NARROW_BODY.has(b)) {
    return { level: "warn", message: `${b} is a display/condensed face and reads poorly at paragraph sizes. Use it for headings and pick a text sans for body.` };
  }
  if (DISPLAY_SERIFS.has(h) && (DISPLAY_SERIFS.has(b) || TEXT_SERIFS.has(b))) {
    return { level: "info", message: `Serif heading + serif body can look muddy. A neutral sans body (Inter, Manrope, DM Sans) gives a more premium contrast.` };
  }
  if (h === b) {
    return { level: "info", message: `Same font for headings and body works, but a distinct heading face creates stronger hierarchy.` };
  }
  return null;
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

  // display=swap: never block first paint waiting for the remote font. The
  // brief FOUT is far cheaper than the up-to-3s render block display=block
  // imposes on cold mobile loads. Worker still preloads local heading fonts.
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

function ensureSelfHostedFontFaces(fonts: string[]) {
  if (typeof document === "undefined") return;
  if (document.querySelector("style[data-sf-font-local]")) return;

  const requestedFonts = fonts.map(normalizeGoogleFontName).filter((font) => SELF_HOSTED_FONT_FACES[font]);
  if (!requestedFonts.length) return;

  // These families ARE the store's selected theme fonts, so they must always
  // render — `optional` silently dropped them on the first (uncached) visit
  // and they only appeared after a refresh. `swap` paints a fallback instantly
  // and swaps the real face in as soon as it arrives.
  const css = [...new Set(requestedFonts)]
    .flatMap((family) =>
      SELF_HOSTED_FONT_FACES[family].map(
        ({ weight, url }) =>
          `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url('${url}') format('woff2')}`
      )
    )
    .join("");


  if (!css) return;
  let style = document.querySelector("style[data-sf-font-client]") as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("data-sf-font-client", "1");
    document.head.appendChild(style);
  }
  if (style.textContent !== css) style.textContent = css;
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

  const headingTune = getHeadingTuning(headingFont);
  const bodyTune = getBodyTuning(bodyFont);

  const defaultThemeStyle: React.CSSProperties = {
    "--storefront-primary": primaryColor,
    "--storefront-primary-light": primaryLight,
    "--storefront-accent": accentColor,
    "--storefront-text": textColor,
    "--storefront-bg": backgroundColor,
    "--storefront-heading-font": `'${headingFont}'`,
    "--storefront-body-font": `'${bodyFont}'`,
    "--storefront-heading-tracking": headingTune.tracking,
    "--storefront-heading-weight": String(headingTune.weight),
    "--storefront-heading-leading": String(headingTune.leading),
    "--storefront-heading-adjust": headingTune.adjust,
    "--storefront-body-tracking": bodyTune.tracking,
    "--storefront-body-weight": String(bodyTune.weight),
    "--storefront-body-leading": bodyTune.leading,
    "--storefront-body-adjust": bodyTune.adjust,

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

  // v6.3.0: If Worker already injected the storefront font link (data-sf-font),
  // it's the single source of truth — never overwrite or duplicate.
  const workerInjected = document.querySelector('link[data-sf-font]') as HTMLLinkElement | null;
  if (workerInjected) {
    workerInjected.dataset.loaded = workerInjected.sheet ? "true" : workerInjected.dataset.loaded || "false";
    ensureSelfHostedFontFaces(fonts);
    return workerInjected;
  }

  ensureSelfHostedFontFaces(fonts);
  const newHref = buildGoogleFontsHref(fonts);

  const linkId = "storefront-google-fonts";
  let link = document.getElementById(linkId) as HTMLLinkElement;

  // If something else already injected the link, check if it covers our fonts.
  if (link && link.href) {
    const existingHref = link.href;
    const allFontsCovered = fonts
      .map(normalizeGoogleFontName)
      .filter((f) => Boolean(f) && !SELF_HOSTED_FONTS.has(f))
      .every((f) => existingHref.includes(f.replace(/ /g, "+")));

    if (allFontsCovered) {
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
