/**
 * ProductCardStyle5 — Minimal Dark Streetwear
 * Inspired by premium streetwear brands: no borders, no rounded corners,
 * no badges, no cart buttons. Just image → name → price.
 * White text on dark background, clean sans-serif typography.
 */
import { Link } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl, getImageSrcSet, resolveProductImages } from "@/lib/imageOptimize";
import { getEffectivePrice, currencySymbol } from "@/lib/productUtils";
import ProductCardTitle from "./ProductCardTitle";
import { memo } from "react";
import { productCardPropsEqual } from "./cardMemo";


interface Props {
  product: Tables<"products">;
  slug: string;
  store: Tables<"stores">;
  priority?: boolean;
  onVariantRequired?: () => void;
  
}

function ProductCardStyle5Impl({ product, slug, store, priority = false }: Props) {
  const images = resolveProductImages(product);
  const mainImg = images[0] || "/placeholder.svg";
  const optimized = optimizeImageUrl(mainImg, 600);
  const srcSet = getImageSrcSet(mainImg, [300, 450, 600]);
  const effectivePrice = getEffectivePrice(product.price, product.sale_price);
  const hasSale = product.sale_price && product.sale_price < product.price;
  const symbol = currencySymbol(store.currency);

  const formatAmount = (amt: number) => {
    return Number(amt).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <Link
      to={storefrontPath(slug, `product/${product.slug || product.id}`)}
      className="card-tilt block cursor-pointer group"
      style={{ backgroundColor: "var(--storefront-bg, #0a0a0a)" }}
    >
      {/* Image — square, no border-radius, full-bleed */}
      <div className="card-img-zoom relative w-full overflow-hidden" style={{ aspectRatio: "3/4" }}>
        <img
          src={optimized}
          srcSet={srcSet}
          sizes="(max-width: 640px) 50vw, 25vw"
          alt={product.name}
          loading={priority ? "eager" : "lazy"}
          decoding={priority ? "sync" : "async"}
          className="w-full h-full object-cover transition-transform duration-300 ease-out hh:group-hover:scale-105"
          style={{ imageRendering: "auto" }}
        />
      </div>

      {/* Text — name + price */}
      <div className="px-3 pt-3 pb-4">
        <ProductCardTitle
          name={product.name}
          className="mb-1"
          baseSize={14}
          minSize={11}
          lineHeight={1.4}
          style={{
            color: "var(--storefront-text, #ffffff)",
            fontFamily: "var(--storefront-heading-font, 'Alegreya SC'), serif",
            fontWeight: 500,
          }}
        />

        <div className="flex items-center gap-2">
          <span
            className="text-sm"
            style={{
              color: "var(--storefront-text, #ffffff)",
              fontFamily: "var(--storefront-body-font, 'Inter'), sans-serif",
              fontWeight: 400,
            }}
          >
            {symbol} {formatAmount(effectivePrice)}
          </span>
          {hasSale && (
            <span
              className="price-strike-draw text-sm"
              style={{
                color: "color-mix(in srgb, var(--storefront-text, #ffffff) 40%, transparent)",
                fontFamily: "var(--storefront-body-font, 'Inter'), sans-serif",
                fontWeight: 400,
              }}
            >
              {symbol} {formatAmount(product.price)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

const ProductCardStyle5 = memo(ProductCardStyle5Impl, productCardPropsEqual);
export default ProductCardStyle5;
