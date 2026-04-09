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
import { getEffectivePrice } from "@/lib/productUtils";

interface Props {
  product: Tables<"products">;
  slug: string;
  store: Tables<"stores">;
  priority?: boolean;
  onVariantRequired?: () => void;
}

export default function ProductCardStyle5({ product, slug, store, priority = false }: Props) {
  const images = resolveProductImages(product);
  const mainImg = images[0] || "/placeholder.svg";
  const optimized = optimizeImageUrl(mainImg, 600);
  const srcSet = getImageSrcSet(mainImg, [300, 450, 600]);
  const effectivePrice = getEffectivePrice(product.price, product.sale_price);
  const hasSale = product.sale_price && product.sale_price < product.price;
  const currency = store.currency || "INR";
  const symbol = currency === "INR" ? "Rs." : currency === "USD" ? "$" : currency;

  const formatAmount = (amt: number) => {
    return Number(amt).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <Link
      to={storefrontPath(slug, `/product/${product.slug || product.id}`)}
      className="block cursor-pointer group"
      style={{ backgroundColor: "#0a0a0a" }}
    >
      {/* Image — square, no border-radius, full-bleed */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: "1/1" }}>
        <img
          src={optimized}
          srcSet={srcSet}
          sizes="(max-width: 640px) 50vw, 25vw"
          alt={product.name}
          loading={priority ? "eager" : "lazy"}
          decoding={priority ? "sync" : "async"}
          className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          style={{ imageRendering: "auto" }}
        />
      </div>

      {/* Text — name + price */}
      <div className="px-3 pt-3 pb-4">
        <h3
          className="text-sm leading-snug mb-1"
          style={{
            color: "#ffffff",
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontWeight: 400,
            letterSpacing: "0.01em",
            lineHeight: 1.4,
          }}
        >
          {product.name}
        </h3>
        <div className="flex items-center gap-2">
          <span
            className="text-sm"
            style={{
              color: "#ffffff",
              fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
              fontWeight: 400,
            }}
          >
            {symbol} {formatAmount(effectivePrice)}
          </span>
          {hasSale && (
            <span
              className="text-sm line-through"
              style={{
                color: "#666666",
                fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
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
