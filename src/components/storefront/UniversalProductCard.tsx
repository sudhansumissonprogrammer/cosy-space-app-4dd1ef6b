import { useState, useCallback, useEffect, useRef, lazy, Suspense, memo } from "react";
import { getCachedCardVideo, requestCardVideo } from "@/lib/cardVideoLookup";
import ProductCardStyle1 from "./ProductCardStyle1";
import ProductCardSkeleton from "./ProductCardSkeleton";
import { useImageActivation } from "@/hooks/useImageActivation";
import { CardImageReadiness } from "./CardImageReadiness";


// ── Variant cards: lazy ─────────────────────────────────────────────
// Each non-default card style becomes its own chunk. A store using
// "style-1" (the default) NEVER downloads style-2..10, V19, V20.
// React.lazy() de-dupes the network request across a grid, so 20+ cards
// in one grid still fire only 1 chunk fetch.
const LOADERS: Record<string, () => Promise<any>> = {
  "style-2": () => import("./ProductCardStyle2"),
  "style-3": () => import("./ProductCardStyle3"),
  "style-4": () => import("./ProductCardStyle4"),
  "style-5": () => import("./ProductCardStyle5"),
  "style-6": () => import("./ProductCardStyle6"),
  "style-7": () => import("./ProductCardStyle7"),
  "style-8": () => import("./ProductCardStyle8"),
  "style-9": () => import("./ProductCardStyle9"),
  "style-10": () => import("./ProductCardStyle10"),
  "theme-19": () => import("./v19/V19ProductCard"),
  "theme-20": () => import("./v20/V20ProductCard"),
};

/** Start fetching the chunk for a card style as early as it is known. */
export function preloadCardStyle(style?: string | null) {
  if (!style) return;
  try {
    LOADERS[style]?.();
  } catch {}
}

// Kick the fetch at module-import time using whatever the edge/worker or the
// last-saved localStorage snapshot already knows, so the grid does not paint
// a skeleton waterfall before the selected card style arrives.
if (typeof window !== "undefined") {
  try {
    const hinted =
      (window as any).__STOREFRONT_DATA__?.theme_config?.product_card_style ||
      (window as any).__THEME__?.pcs;
    preloadCardStyle(hinted);
    if (!hinted) {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith("sf_tc_")) continue;
        const v = JSON.parse(localStorage.getItem(k) || "{}");
        if (v?.product_card_style) { preloadCardStyle(v.product_card_style); break; }
      }
    }
  } catch {}
}

const ProductCardStyle2 = lazy(LOADERS["style-2"]);
const ProductCardStyle3 = lazy(LOADERS["style-3"]);
const ProductCardStyle4 = lazy(LOADERS["style-4"]);
const ProductCardStyle5 = lazy(LOADERS["style-5"]);
const ProductCardStyle6 = lazy(LOADERS["style-6"]);
const ProductCardStyle7 = lazy(LOADERS["style-7"]);
const ProductCardStyle8 = lazy(LOADERS["style-8"]);
const ProductCardStyle9 = lazy(LOADERS["style-9"]);
const ProductCardStyle10 = lazy(LOADERS["style-10"]);
const V19ProductCard = lazy(LOADERS["theme-19"]);
const V20ProductCard = lazy(LOADERS["theme-20"]);


// Lazy: variant picker only needed when shopper actually clicks add-to-cart on a variant product
const VariantPickerDialog = lazy(() => import("./VariantPickerDialog"));
import { prefetchProductDetail } from "@/lib/prefetchProductDetail";
import { setPdpPreload } from "@/lib/pdpPreload";
import { resolveProductImages } from "@/lib/imageOptimize";
import { useVariantCount } from "@/hooks/useVariantCounts";
import { useStorefrontThemeConfig } from "@/hooks/useStorefrontThemeConfig";
import WarrantyBadge from "./WarrantyBadge";
import ProductCardVideo from "./ProductCardVideo";
import FestivalSaleBadge from "./FestivalSaleBadge";
import { useAppDisabled } from "@/hooks/useAppDisabled";


interface Props {
  product: any;
  slug: string;
  store: any;
  priority?: boolean;
  cardStyle?: string;
  index?: number;
  /** Horizontal carousels must not skip paint — set false there. */
  deferOffscreen?: boolean;
  /** Prepare two mobile grid rows after scrolling starts, not on cold entry. */
  prepareAhead?: boolean;
}

function UniversalProductCardImpl({ product, slug, store, priority = false, cardStyle = "style-1", index = 0, deferOffscreen = true, prepareAhead = false }: Props) {
  preloadCardStyle(store?.theme === "theme-19" || store?.theme === "theme-20" ? store.theme : cardStyle);
  const [variantOpen, setVariantOpen] = useState(false);
  const { ref: hostRef, active } = useImageActivation(priority, prepareAhead
    ? { rootMargin: "600px 0px", afterScroll: true } : {});
  // Tap-to-play video is available on every store/theme by default; the
  // App Store "Card Video (Mobile)" toggle is an explicit opt-out.
  const inlineVideoUrl = ((product as any)?.video_url as string | null) || null;
  // Some payloads (edge-cached product lists, shell previews) omit the column
  // entirely — batch-resolve it so those cards still get the play badge.
  const needsLookup = !!product?.id && !("video_url" in (product || {}));
  const [lookedUp, setLookedUp] = useState<string | null>(() =>
    needsLookup ? getCachedCardVideo(product.id) ?? null : null,
  );
  useEffect(() => {
    if (!needsLookup || !active) return;
    return requestCardVideo(product.id, (url) => setLookedUp(url));
  }, [needsLookup, product?.id, active]);
  const cardVideoUrl = inlineVideoUrl || lookedUp;
  // Default ON for every store; merchants can switch the "Card Video (Mobile)"
  // App Store add-on OFF to remove the play badge from their cards entirely.
  const cardVideoOff = useAppDisabled(slug, "card-video", !!cardVideoUrl);
  const showCardVideo = !!cardVideoUrl && !cardVideoOff;
  const hasSale = Number(product?.sale_price) > 0 && Number(product.sale_price) < Number(product?.price);

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

  // Offscreen skip-work ("poor man's windowing"): cards below the first two
  // rows opt into content-visibility so the browser skips their layout/paint
  // while far offscreen. contain-intrinsic-size reserves the real height so
  // the scrollbar never jumps. The first rows are excluded to protect LCP.
  const deferPaint = deferOffscreen && !active && index >= 8;

  return (
    <div
      ref={hostRef}
      className={`stagger-card relative${active ? " prepared-product-card" : ""}`}
      style={{
        "--i": index,
        ...(deferPaint
          ? { contentVisibility: "auto", containIntrinsicSize: "auto 380px" }
          : null),
      } as React.CSSProperties}
      onMouseEnter={prime}
      onTouchStart={prime}
      onPointerDown={prime}
    >
      {active ? <CardImageReadiness.Provider value>{wrapped}</CardImageReadiness.Provider> : <ProductCardSkeleton />}
      {active && hasSale && (
        <FestivalSaleBadge placement="card" className="absolute left-1.5 top-1.5 z-[5] drop-shadow-md" />
      )}
      {active && showCardVideo && cardVideoUrl && (
        <ProductCardVideo hostRef={hostRef} enabled videoUrl={cardVideoUrl} />
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
    prev.product?.video_url === next.product?.video_url &&
    prev.product?.video_poster_url === next.product?.video_poster_url &&
    prev.slug === next.slug &&
    prev.store?.id === next.store?.id &&
    prev.store?.theme === next.store?.theme &&
    prev.priority === next.priority &&
    prev.cardStyle === next.cardStyle &&
    prev.index === next.index &&
    prev.deferOffscreen === next.deferOffscreen &&
    prev.prepareAhead === next.prepareAhead
  );
});

export default UniversalProductCard;

