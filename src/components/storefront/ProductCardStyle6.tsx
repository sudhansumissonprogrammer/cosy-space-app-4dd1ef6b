/**
 * Style 6 — Editorial Luxe
 * Inspired by Aesop, Jacquemus, COS. Magazine-style, quiet luxury.
 * Tall 3:4 image with no border, serif italic name, uppercase tracked price.
 * Hover: 2nd image fade, name underline.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Package } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl, getImageSrcSet, resolveProductImages } from "@/lib/imageOptimize";
import { getDiscountPercent } from "@/lib/productUtils";
import { useProductCardActions } from "@/hooks/useProductCardActions";
import { prefetchProductDetail } from "@/lib/prefetchProductDetail";
import { setPdpPreload } from "@/lib/pdpPreload";

interface Props {
  product: Tables<"products">;
  slug: string;
  store: Tables<"stores">;
  priority?: boolean;
  onVariantRequired?: () => void;
}

export default function ProductCardStyle6({ product, slug, store, priority = false }: Props) {
  const { wishlisted, handleToggleWishlist, heartBursting } = useProductCardActions(product);
  const [hoverLoaded, setHoverLoaded] = useState(false);
  const discountPercent = getDiscountPercent(product.price, product.sale_price);
  const currency = store.currency || "₹";

  const primePdp = () => {
    prefetchProductDetail();
    try {
      const imgs = resolveProductImages(product);
      setPdpPreload({
        slug: product.slug || product.id,
        image: imgs[0] || "",
        name: product.name,
        price: product.price as any,
        salePrice: (product.sale_price as any) ?? null,
        currency,
      });
    } catch {}
  };

  return (
    <div
      className="group relative cursor-pointer"
      style={{ contain: priority ? undefined : "layout style", contentVisibility: priority ? undefined : "auto" }}
      onMouseEnter={() => { primePdp(); setHoverLoaded(true); }}
      onTouchStart={primePdp}
      onPointerDown={primePdp}
    >
      <Link to={storefrontPath(slug, `product/${product.slug || product.id}`)} className="block">
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: "3 / 4", backgroundColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 4%, var(--storefront-bg, hsl(var(--background))))" }}>
          {(() => {
            const images = resolveProductImages(product);
            if (images.length === 0) {
              return <div className="flex h-full w-full items-center justify-center"><Package className="h-10 w-10 opacity-20" /></div>;
            }
            const hasSecond = images.length > 1;
            return (
              <>
                <img
                  src={optimizeImageUrl(images[0], 400, 75)}
                  srcSet={getImageSrcSet(images[0], [300, 500, 700, 900], 75)}
                  sizes="(max-width: 640px) 45vw, (max-width: 1024px) 28vw, 20vw"
                  alt={product.name}
                  width={400}
                  height={533}
                  data-no-crop="true"
                  className={`absolute inset-0 h-full w-full object-cover object-center transition-all duration-[900ms] ease-out ${hasSecond && hoverLoaded ? "group-hover:opacity-0 group-hover:scale-[1.03]" : "group-hover:scale-[1.02]"}`}
                  loading={priority ? "eager" : "lazy"}
                  decoding={priority ? "sync" : "async"}
                  fetchPriority={priority ? "high" : "low"}
                />
                {hasSecond && hoverLoaded && (
                  <img
                    src={optimizeImageUrl(images[1], 400, 75)}
                    srcSet={getImageSrcSet(images[1], [300, 500, 700, 900], 75)}
                    sizes="(max-width: 640px) 45vw, (max-width: 1024px) 28vw, 20vw"
                    alt={product.name}
                    width={400}
                    height={533}
                    data-no-crop="true"
                    className="absolute inset-0 h-full w-full object-cover object-center opacity-0 transition-opacity duration-[900ms] ease-out group-hover:opacity-100"
                    loading="lazy"
                    decoding="async"
                  />
                )}
              </>
            );
          })()}

          {discountPercent && (
            <div className="absolute left-2 top-2">
              <span className="text-[9px] font-medium uppercase tracking-[0.15em]" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
                −{discountPercent}%
              </span>
            </div>
          )}

          <button
            onClick={handleToggleWishlist}
            className={`heart-burst ${heartBursting ? "bursting" : ""} absolute right-2 top-2 flex h-7 w-7 items-center justify-center transition-opacity duration-200 opacity-0 group-hover:opacity-100 lg:opacity-0`}
            aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart className={`h-4 w-4 ${wishlisted ? "fill-destructive text-destructive" : "fill-transparent text-foreground stroke-[1.5]"}`} />
          </button>
        </div>

        <div className="pt-3 pb-1">
          <h3
            className="text-[13px] italic leading-snug line-clamp-2 transition-all duration-300 group-hover:underline underline-offset-4"
            style={{
              fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
              color: "var(--storefront-text, hsl(var(--foreground)))",
              fontWeight: 500,
            }}
          >
            {product.name}
          </h3>
          <div className="mt-1.5 flex items-baseline gap-2">
            {product.sale_price ? (
              <>
                <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
                  {currency} {Number(product.sale_price).toFixed(0)}
                </span>
                <span className="text-[9px] uppercase tracking-[0.18em] line-through" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 45%, transparent)" }}>
                  {currency} {Number(product.price).toFixed(0)}
                </span>
              </>
            ) : (
              <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
                {currency} {Number(product.price).toFixed(0)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
