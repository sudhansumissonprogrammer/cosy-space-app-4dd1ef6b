import type { Tables } from "@/integrations/supabase/types";
import ProductCardStyle1 from "./ProductCardStyle1";
import ProductCardStyle2 from "./ProductCardStyle2";
import ProductCardStyle3 from "./ProductCardStyle3";
import ProductCardStyle4 from "./ProductCardStyle4";

interface Props {
  product: Tables<"products">;
  slug: string;
  store: Tables<"stores">;
  priority?: boolean;
  cardStyle?: string;
}

/**
 * Renders the correct product card component based on the store's
 * product_card_style setting from theme config.
 */
export default function UniversalProductCard({ product, slug, store, priority = false, cardStyle = "style-1" }: Props) {
  switch (cardStyle) {
    case "style-2":
      return <ProductCardStyle2 product={product} slug={slug} store={store} priority={priority} />;
    case "style-3":
      return <ProductCardStyle3 product={product} slug={slug} store={store} priority={priority} />;
    case "style-4":
      return <ProductCardStyle4 product={product} slug={slug} store={store} priority={priority} />;
    default:
      return <ProductCardStyle1 product={product} slug={slug} store={store} priority={priority} />;
  }
}
