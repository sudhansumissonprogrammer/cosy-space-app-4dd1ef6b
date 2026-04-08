import { useState, useCallback } from "react";
import type { Tables } from "@/integrations/supabase/types";
import ProductCardStyle1 from "./ProductCardStyle1";
import ProductCardStyle2 from "./ProductCardStyle2";
import ProductCardStyle3 from "./ProductCardStyle3";
import ProductCardStyle4 from "./ProductCardStyle4";

import VariantPickerDialog from "./VariantPickerDialog";
import { prefetchProductDetail } from "@/lib/prefetchProductDetail";
import { useVariantCount } from "@/hooks/useVariantCounts";

interface Props {
  product: any;
  slug: string;
  store: any;
  priority?: boolean;
  cardStyle?: string;
  /** Card index for staggered animation */
  index?: number;
}

/**
 * Renders the correct product card component based on the store's
 * product_card_style setting from theme config.
 *
 * Variant count is read from VariantCountProvider context (batched query)
 * to eliminate N individual queries per page.
 */
export default function UniversalProductCard({ product, slug, store, priority = false, cardStyle = "style-1", index = 0 }: Props) {
  const [variantOpen, setVariantOpen] = useState(false);
  const variantCount = useVariantCount(product.id);
  const hasVariants = variantCount > 0;

  const onVariantRequired = useCallback(() => {
    setVariantOpen(true);
  }, []);

  const card = (() => {
    const variantGate = hasVariants ? onVariantRequired : undefined;
    switch (cardStyle) {
      case "style-2":
        return <ProductCardStyle2 product={product} slug={slug} store={store} priority={priority} onVariantRequired={variantGate} />;
      case "style-3":
        return <ProductCardStyle3 product={product} slug={slug} store={store} priority={priority} onVariantRequired={variantGate} />;
      case "style-4":
        return <ProductCardStyle4 product={product} slug={slug} store={store} priority={priority} onVariantRequired={variantGate} />;
      default:
        return <ProductCardStyle1 product={product} slug={slug} store={store} priority={priority} onVariantRequired={variantGate} />;
    }
  })();

  const isBestSelling = product.is_best_selling;

  return (
    <div
      className={`stagger-card ${isBestSelling ? "gradient-glow-border rounded-xl" : ""}`}
      style={{ "--i": index } as React.CSSProperties}
      onMouseEnter={prefetchProductDetail}
      onTouchStart={prefetchProductDetail}
    >
      {card}
      {hasVariants && (
        <VariantPickerDialog
          open={variantOpen}
          onClose={() => setVariantOpen(false)}
          product={product}
        />
      )}
    </div>
  );
}
