import { useState, useCallback, lazy, Suspense } from "react";
import type { Tables } from "@/integrations/supabase/types";
import ProductCardStyle1 from "./ProductCardStyle1";
import ProductCardStyle2 from "./ProductCardStyle2";
import ProductCardStyle3 from "./ProductCardStyle3";
import ProductCardStyle4 from "./ProductCardStyle4";
import ProductCardStyle5 from "./ProductCardStyle5";
import ProductCardStyle6 from "./ProductCardStyle6";
import ProductCardStyle7 from "./ProductCardStyle7";
import ProductCardStyle8 from "./ProductCardStyle8";
import ProductCardStyle9 from "./ProductCardStyle9";
import ProductCardStyle10 from "./ProductCardStyle10";
import V19ProductCard from "./v19/V19ProductCard";
import V20ProductCard from "./v20/V20ProductCard";

// Lazy: variant picker only needed when shopper actually clicks add-to-cart on a variant product
const VariantPickerDialog = lazy(() => import("./VariantPickerDialog"));
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
      case "style-6":
        return <ProductCardStyle6 product={product} slug={slug} store={store} priority={priority} onVariantRequired={variantGate} />;
      case "style-7":
        return <ProductCardStyle7 product={product} slug={slug} store={store} priority={priority} onVariantRequired={variantGate} />;
      case "style-8":
        return <ProductCardStyle8 product={product} slug={slug} store={store} priority={priority} onVariantRequired={variantGate} />;
      case "style-9":
        return <ProductCardStyle9 product={product} slug={slug} store={store} priority={priority} onVariantRequired={variantGate} />;
      case "style-10":
        return <ProductCardStyle10 product={product} slug={slug} store={store} priority={priority} onVariantRequired={variantGate} />;
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
      {hasVariants && variantOpen && (
        <Suspense fallback={null}>
          <VariantPickerDialog
            open={variantOpen}
            onClose={() => setVariantOpen(false)}
            product={product}
          />
        </Suspense>
      )}
    </div>
  );
}
