import { useState, useCallback } from "react";
import type { Tables } from "@/integrations/supabase/types";
import ProductCardStyle1 from "./ProductCardStyle1";
import ProductCardStyle2 from "./ProductCardStyle2";
import ProductCardStyle3 from "./ProductCardStyle3";
import ProductCardStyle4 from "./ProductCardStyle4";
import ProductCardStyle5 from "./ProductCardStyle5";
import V19ProductCard from "./v19/V19ProductCard";
import V20ProductCard from "./v20/V20ProductCard";

import VariantPickerDialog from "./VariantPickerDialog";
import { prefetchProductDetail } from "@/lib/prefetchProductDetail";
import { useVariantCount } from "@/hooks/useVariantCounts";

interface Props {
  product: any;
  slug: string;
  store: any;
  priority?: boolean;
  cardStyle?: string;
  index?: number;
}

export default function UniversalProductCard({ product, slug, store, priority = false, cardStyle = "style-1", index = 0 }: Props) {
  const [variantOpen, setVariantOpen] = useState(false);
  const variantCount = useVariantCount(product.id);
  const hasVariants = variantCount > 0;

  const onVariantRequired = useCallback(() => {
    setVariantOpen(true);
  }, []);

  const card = (() => {
    const variantGate = hasVariants ? onVariantRequired : undefined;
    // Theme 19 (Quick Commerce) — force Blinkit-style card across the entire storefront
    if (store?.theme === "theme-19") {
      return <V19ProductCard product={product} slug={slug} store={store} priority={priority} />;
    }
    if (store?.theme === "theme-20") {
      return <V20ProductCard product={product} slug={slug} store={store} priority={priority} />;
    }
    switch (cardStyle) {
      case "style-2":
        return <ProductCardStyle2 product={product} slug={slug} store={store} priority={priority} onVariantRequired={variantGate} />;
      case "style-3":
        return <ProductCardStyle3 product={product} slug={slug} store={store} priority={priority} onVariantRequired={variantGate} />;
      case "style-4":
        return <ProductCardStyle4 product={product} slug={slug} store={store} priority={priority} onVariantRequired={variantGate} />;
      case "style-5":
        return <ProductCardStyle5 product={product} slug={slug} store={store} priority={priority} />;
      default:
        return <ProductCardStyle1 product={product} slug={slug} store={store} priority={priority} onVariantRequired={variantGate} />;
    }
  })();

  return (
    <div
      className="stagger-card"
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
