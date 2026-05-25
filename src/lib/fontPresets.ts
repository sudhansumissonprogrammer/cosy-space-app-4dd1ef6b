/**
 * Premium brand-inspired typography presets.
 * Single source of truth used by:
 *  - Dashboard preview cards (StoreThemeSettings)
 *  - Storefront live theme (themeUtils.buildThemeStyle)
 *  - Live iframe preview (useThemePreview)
 *
 * Each preset bundles the full typographic system that big brands
 * (Swiggy, Tanishq, Glossier, Gucci, etc.) actually use.
 */
export interface FontPreset {
  id: string;
  name: string;
  tag: string;
  bestFor: string;
  heading: string;
  body: string;
  /** Weight for h1-h6 on storefront */
  headingWeight: number;
  /** Letter-spacing for headings (CSS value e.g. "-0.5px") */
  headingTracking: string;
  /** Weight for product titles (semibold for most) */
  productTitleWeight: number;
  /** Body / paragraph weight */
  bodyWeight: number;
  /** Primary CTA button weight */
  btnWeight: number;
  /** Button text casing */
  btnCase: "uppercase" | "none";
  /** Button letter-spacing */
  btnTracking: string;
  /** Price label weight */
  priceWeight: number;
}

export const PREMIUM_PRESETS: FontPreset[] = [
  {
    id: "swiggy",
    name: "Swiggy Style",
    tag: "FOOD / D2C",
    bestFor: "Food, grocery, pharmacy, daily needs",
    heading: "Manrope",
    body: "Manrope",
    headingWeight: 700,
    headingTracking: "-0.3px",
    productTitleWeight: 600,
    bodyWeight: 400,
    btnWeight: 700,
    btnCase: "uppercase",
    btnTracking: "0.5px",
    priceWeight: 800,
  },
  {
    id: "luxury-editorial",
    name: "Luxury Editorial",
    tag: "JEWELLERY",
    bestFor: "Jewellery, watches, fine art, wedding",
    heading: "Playfair Display",
    body: "Inter",
    headingWeight: 700,
    headingTracking: "-0.5px",
    productTitleWeight: 500,
    bodyWeight: 400,
    btnWeight: 600,
    btnCase: "uppercase",
    btnTracking: "1.5px",
    priceWeight: 700,
  },
  {
    id: "glossier",
    name: "Modern Glossier",
    tag: "BEAUTY",
    bestFor: "Beauty, skincare, candles, wellness",
    heading: "Fraunces",
    body: "Inter",
    headingWeight: 600,
    headingTracking: "-0.2px",
    productTitleWeight: 500,
    bodyWeight: 400,
    btnWeight: 500,
    btnCase: "none",
    btnTracking: "0px",
    priceWeight: 600,
  },
  {
    id: "soft-luxury",
    name: "Soft Luxury",
    tag: "BOUTIQUE",
    bestFor: "Sarees, designer wear, luxury bags",
    heading: "Cormorant Garamond",
    body: "Montserrat",
    headingWeight: 400,
    headingTracking: "0px",
    productTitleWeight: 500,
    bodyWeight: 400,
    btnWeight: 500,
    btnCase: "uppercase",
    btnTracking: "2px",
    priceWeight: 600,
  },
  {
    id: "bold-editorial",
    name: "Bold Editorial",
    tag: "APPAREL",
    bestFor: "Apparel, accessories, lifestyle",
    heading: "DM Serif Display",
    body: "Jost",
    headingWeight: 400,
    headingTracking: "-0.3px",
    productTitleWeight: 600,
    bodyWeight: 400,
    btnWeight: 500,
    btnCase: "none",
    btnTracking: "0px",
    priceWeight: 700,
  },
  {
    id: "airbnb",
    name: "Airbnb Modern",
    tag: "TECH / TRAVEL",
    bestFor: "Tech, home goods, travel, hospitality",
    heading: "Plus Jakarta Sans",
    body: "Plus Jakarta Sans",
    headingWeight: 800,
    headingTracking: "-1px",
    productTitleWeight: 600,
    bodyWeight: 400,
    btnWeight: 600,
    btnCase: "none",
    btnTracking: "0px",
    priceWeight: 700,
  },
  {
    id: "gucci",
    name: "Gucci Ultra-Luxury",
    tag: "ULTRA LUX",
    bestFor: "Luxury fashion, perfumes, premium accessories",
    heading: "Bodoni Moda",
    body: "Inter",
    headingWeight: 700,
    headingTracking: "-0.5px",
    productTitleWeight: 400,
    bodyWeight: 400,
    btnWeight: 500,
    btnCase: "uppercase",
    btnTracking: "2.5px",
    priceWeight: 600,
  },
  {
    id: "cred-bold",
    name: "CRED Bold",
    tag: "GEN-Z TECH",
    bestFor: "Sneakers, gadgets, gen-z brands",
    heading: "Syne",
    body: "Inter",
    headingWeight: 800,
    headingTracking: "-1px",
    productTitleWeight: 600,
    bodyWeight: 400,
    btnWeight: 600,
    btnCase: "none",
    btnTracking: "0px",
    priceWeight: 700,
  },
  {
    id: "royal-indian",
    name: "Royal Indian",
    tag: "BRIDAL / ETHNIC",
    bestFor: "Bridal wear, ethnic, festive, pooja items",
    heading: "Marcellus",
    body: "Poppins",
    headingWeight: 400,
    headingTracking: "1px",
    productTitleWeight: 400,
    bodyWeight: 400,
    btnWeight: 500,
    btnCase: "uppercase",
    btnTracking: "1.5px",
    priceWeight: 600,
  },
  {
    id: "minimal-modern",
    name: "Minimal Modern",
    tag: "ELECTRONICS",
    bestFor: "Electronics, minimal brands, modern décor",
    heading: "DM Sans",
    body: "DM Sans",
    headingWeight: 700,
    headingTracking: "-0.5px",
    productTitleWeight: 500,
    bodyWeight: 400,
    btnWeight: 500,
    btnCase: "none",
    btnTracking: "0px",
    priceWeight: 700,
  },
];

export function getPresetById(id?: string | null): FontPreset | null {
  if (!id) return null;
  return PREMIUM_PRESETS.find((p) => p.id === id) || null;
}

/** All unique Google Font families referenced by presets (for dashboard preview loader). */
export const PRESET_FONT_FAMILIES: string[] = Array.from(
  new Set(PREMIUM_PRESETS.flatMap((p) => [p.heading, p.body]))
);

/**
 * Build CSS-variable overrides for a preset. Returned object plugs straight
 * into React.CSSProperties on the storefront wrapper.
 */
export function presetCssVars(preset: FontPreset | null): Record<string, string> {
  if (!preset) return {};
  return {
    "--storefront-heading-weight": String(preset.headingWeight),
    "--storefront-heading-tracking": preset.headingTracking,
    "--storefront-product-title-weight": String(preset.productTitleWeight),
    "--storefront-body-weight": String(preset.bodyWeight),
    "--storefront-btn-weight": String(preset.btnWeight),
    "--storefront-btn-case": preset.btnCase,
    "--storefront-btn-tracking": preset.btnTracking,
    "--storefront-price-weight": String(preset.priceWeight),
  };
}
