import { useState, useCallback, lazy, Suspense } from "react";
import type { Tables } from "@/integrations/supabase/types";
import ProductCardStyle1 from "./ProductCardStyle1";
import ProductCardStyle2 from "./ProductCardStyle2";
import ProductCardStyle3 from "./ProductCardStyle3";
import ProductCardStyle4 from "./ProductCardStyle4";
import ProductCardStyle5 from "./ProductCardStyle5";

import VariantPickerDialog from "./VariantPickerDialog";
import { prefetchProductDetail } from "@/lib/prefetchProductDetail";
import { useVariantCount } from "@/hooks/useVariantCounts";

const QuickViewModal = lazy(() => import("./QuickViewModal"));

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
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const variantCount = useVariantCount(product.id);
  const hasVariants = variantCount > 0;

  const onVariantRequired = useCallback(() => {
    setVariantOpen(true);
  }, []);

  const onQuickView = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setQuickViewOpen(true);
  }, []);

  const card = (() => {
    const variantGate = hasVariants ? onVariantRequired : undefined;
    switch (cardStyle) {
      case "style-2":
        return <ProductCardStyle2 product={product} slug={slug} store={store} priority={priority} onVariantRequired={variantGate} onQuickView={onQuickView} />;
      case "style-3":
        return <ProductCardStyle3 product={product} slug={slug} store={store} priority={priority} onVariantRequired={variantGate} onQuickView={onQuickView} />;
      case "style-4":
        return <ProductCardStyle4 product={product} slug={slug} store={store} priority={priority} onVariantRequired={variantGate} onQuickView={onQuickView} />;
      case "style-5":
        return <ProductCardStyle5 product={product} slug={slug} store={store} priority={priority} onQuickView={onQuickView} />;
      default:
        return <ProductCardStyle1 product={product} slug={slug} store={store} priority={priority} onVariantRequired={variantGate} onQuickView={onQuickView} />;
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
      {quickViewOpen && (
        <Suspense fallback={null}>
          <QuickViewModal
            open={quickViewOpen}
            onClose={() => setQuickViewOpen(false)}
            product={product}
            store={store}
            slug={slug}
          />
        </Suspense>
      )}
    </div>
  );
}
