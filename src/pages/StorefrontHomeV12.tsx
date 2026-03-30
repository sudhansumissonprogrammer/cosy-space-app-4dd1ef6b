/**
 * StorefrontHomeV12 — Reuses ElegantHomePage from V10 with different defaults.
 */
import { ElegantHomePage } from "./StorefrontHomeV10";

export default function StorefrontHomeV12() {
  return <ElegantHomePage defaultCardStyle="style-3" defaultCategoryStyle="style-1" />;
}
