import { useState, useCallback, lazy, Suspense } from "react";
import ProductCardStyle1 from "./ProductCardStyle1";
import ProductCardSkeleton from "./ProductCardSkeleton";

// ── Variant cards: lazy ─────────────────────────────────────────────
// Each non-default card style becomes its own chunk. A store using
// "style-1" (the default) NEVER downloads style-2..10, V19, V20.
// React.lazy() de-dupes the network request across a grid, so 20+ cards
// in one grid still fire only 1 chunk fetch.
const ProductCardStyle2 = lazy(() => import("./ProductCardStyle2"));
const ProductCardStyle3 = lazy(() => import("./ProductCardStyle3"));
const ProductCardStyle4 = lazy(() => import("./ProductCardStyle4"));
const ProductCardStyle5 = lazy(() => import("./ProductCardStyle5"));
const ProductCardStyle6 = lazy(() => import("./ProductCardStyle6"));
const ProductCardStyle7 = lazy(() => import("./ProductCardStyle7"));
const ProductCardStyle8 = lazy(() => import("./ProductCardStyle8"));
const ProductCardStyle9 = lazy(() => import("./ProductCardStyle9"));
const ProductCardStyle10 = lazy(() => import("./ProductCardStyle10"));
const V19ProductCard = lazy(() => import("./v19/V19ProductCard"));
const V20ProductCard = lazy(() => import("./v20/V20ProductCard"));

// Lazy: variant picker only needed when shopper actually clicks add-to-cart on a variant product
const VariantPickerDialog = lazy(() => import("./VariantPickerDialog"));
import { prefetchProductDetail } from "@/lib/prefetchProductDetail";
import { useVariantCount } from "@/hooks/useVariantCounts";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import WarrantyBadge from "./WarrantyBadge";

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
    // Themes 19 / 20 (Quick Commerce / Multi-purpose) force a fixed card
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
        // style-1 is the only statically-imported variant → no suspense needed
        return <ProductCardStyle1 product={product} slug={slug} store={store} priority={priority} onVariantRequired={variantGate} />;
    }
  })();

  // Wrap non-default styles with Suspense → skeleton flashes for a fraction
  // of a second on first card render while the chunk arrives, then sticks.
  const needsSuspense =
    store?.theme === "theme-19" ||
    store?.theme === "theme-20" ||
    (cardStyle && cardStyle !== "style-1");

  const wrapped = needsSuspense ? (
    <Suspense fallback={<ProductCardSkeleton />}>{card}</Suspense>
  ) : (
    card
  );

  return (
    <div
      className="stagger-card"
      style={{ "--i": index } as React.CSSProperties}
      onMouseEnter={prefetchProductDetail}
      onTouchStart={prefetchProductDetail}
    >
      {wrapped}
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
