/**
 * StorefrontHomeV15 — "Classic Center Alt" home page
 * Reuses ClassicCenterHome from V14 with different default styles:
 * - Default card style: style-1 (vs style-2 in V14)
 * - Default category style: style-4
 */
import { ClassicCenterHome } from "./StorefrontHomeV14";

export default function StorefrontHomeV15() {
  return <ClassicCenterHome defaultCardStyle="style-1" defaultCategoryStyle="style-4" />;
}
