/**
 * StorefrontHomeV12 — Reuses ElegantHomePage from V10 with different defaults.
 * Static import to avoid double lazy waterfall.
 */
import { ElegantHomePage } from "./StorefrontHomeV10";

export default function StorefrontHomeV12() {
  return <ElegantHomePage defaultCardStyle="style-3" defaultCategoryStyle="style-1" />;
}
