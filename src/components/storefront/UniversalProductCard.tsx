import { useState, useCallback, useRef, lazy, Suspense, memo } from "react";
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
import { setPdpPreload } from "@/lib/pdpPreload";
import { resolveProductImages } from "@/lib/imageOptimize";
import { useVariantCount } from "@/hooks/useVariantCounts";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import WarrantyBadge from "./WarrantyBadge";
import { useAppEnabled } from "@/hooks/useAppEnabled";
import ProductCardVideo from "./ProductCardVideo";

interface Props {
  product: any;
  slug: string;
  store: any;
  priority?: boolean;
  cardStyle?: string;
  index?: number;
}

function UniversalProductCardImpl({ product, slug, store, priority = false, cardStyle = "style-1", index = 0 }: Props) {
  const [variantOpen, setVariantOpen] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const { enabled: cardVideoOn } = useAppEnabled(slug, "card-video");
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

  const prime = useCallback(() => {
    try {
      const imgs = resolveProductImages(product);
      const image = imgs[0] || (product as any)?.image_url || "";
      const slugOrId = product?.slug || product?.id;
      prefetchProductDetail({ slug: slugOrId, image });
      setPdpPreload({
        slug: slugOrId,
        image,
        name: product?.name,
        price: (product?.price as any) ?? null,
        salePrice: (product?.sale_price as any) ?? null,
        currency: (store as any)?.currency || "INR",
      });
    } catch {}
  }, [product, store]);

  return (
    <div
      ref={hostRef}
      className="stagger-card relative"
      style={{ "--i": index } as React.CSSProperties}
      onMouseEnter={prime}
      onTouchStart={prime}
      onPointerDown={prime}
    >
      {wrapped}
      {cardVideoOn && (product as any)?.video_url && (
        <ProductCardVideo
          hostRef={hostRef}
          enabled={cardVideoOn}
          videoUrl={(product as any).video_url}
        />
      )}
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

// Memoize: product cards re-render on every cart/wishlist context tick which
// triggers thousands of style recalcs on grids of 20+ cards. Custom equality
// short-circuits when the product itself + store theme + position are stable —
// the card's own context hooks still re-subscribe correctly inside.
const UniversalProductCard = memo(UniversalProductCardImpl, (prev, next) => {
  return (
    prev.product?.id === next.product?.id &&
    prev.product?.price === next.product?.price &&
    prev.product?.sale_price === next.product?.sale_price &&
    prev.product?.stock_quantity === next.product?.stock_quantity &&
    prev.slug === next.slug &&
    prev.store?.id === next.store?.id &&
    prev.store?.theme === next.store?.theme &&
    prev.priority === next.priority &&
    prev.cardStyle === next.cardStyle &&
    prev.index === next.index
  );
});

export default UniversalProductCard;

