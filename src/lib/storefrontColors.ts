/**
 * Utility for generating valid CSS colors with alpha from CSS custom properties.
 *
 * The pattern `var(--storefront-primary, #1a1a1a)08` is INVALID CSS —
 * the `08` after the closing `)` is not parsed correctly.
 *
 * Instead, use `color-mix(in srgb, var(--x) <percent>, transparent)` which is
 * valid CSS and works with any color format (hex, hsl, rgb, named).
 *
 * Browser support: color-mix() is supported in all modern browsers (Chrome 111+,
 * Firefox 113+, Safari 16.2+). For the storefront's target audience this is fine.
 */

/**
 * Returns a CSS color value with alpha transparency using color-mix().
 *
 * @param cssVar - The CSS variable reference, e.g. "var(--storefront-primary, #b8873c)"
 * @param alphaHex - Two-character hex alpha, e.g. "08", "15", "40", "80", "ee"
 * @returns Valid CSS color string using color-mix()
 *
 * @example
 *   withAlpha("var(--storefront-primary, #b8873c)", "15")
 *   // → "color-mix(in srgb, var(--storefront-primary, #b8873c) 8.2%, transparent)"
 */
export function withAlpha(cssVar: string, alphaHex: string): string {
  // Convert hex alpha (00-ff) to percentage (0-100%)
  const alphaInt = parseInt(alphaHex, 16);
  const percent = Math.round((alphaInt / 255) * 1000) / 10; // one decimal
  return `color-mix(in srgb, ${cssVar} ${percent}%, transparent)`;
}
