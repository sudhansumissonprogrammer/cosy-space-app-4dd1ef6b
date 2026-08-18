/**
 * Style 6 — Editorial Luxe
 * Inspired by Aesop, Jacquemus, COS. Magazine-style, quiet luxury.
 * Tall 3:4 image with no border, serif italic name, uppercase tracked price.
 * Hover: 2nd image fade, name underline.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Package, Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl, getImageSrcSet, resolveProductImages } from "@/lib/imageOptimize";
import { getDiscountPercent, currencySymbol } from "@/lib/productUtils";
import { useProductCardActions } from "@/hooks/useProductCardActions";
import { useNavIcons } from "@/hooks/useNavIcons";
import ProductCardTitle from "./ProductCardTitle";
import WishlistHeartButton from "./WishlistHeartButton";

import { prefetchProductDetail } from "@/lib/prefetchProductDetail";
import { setPdpPreload } from "@/lib/pdpPreload";

interface Props {
  product: Tables<"products">;
  slug: string;
  store: Tables<"stores">;
  priority?: boolean;
  onVariantRequired?: () => void;
}

export default function ProductCardStyle6({ product, slug, store, priority = false, onVariantRequired }: Props) {
  const { wishlisted, handleToggleWishlist, handleAddToCart, heartBursting } = useProductCardActions(product);
  const [hoverLoaded, setHoverLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const discountPercent = getDiscountPercent(product.price, product.sale_price);
  const currency = currencySymbol(store.currency);
  const getIcon = useNavIcons(store.id);
  const CartIcon = getIcon("cart");

  const onAddClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (adding) return;
    setAdding(true);
    const source = e.currentTarget as Element;
    // Brief "loading" beat on the icon, then the item flies to the cart and
    // the side cart opens (via the cart:fly-landed listener).
    window.setTimeout(() => {
      setAdding(false);
      handleAddToCart({
        preventDefault() {},
        stopPropagation() {},
        currentTarget: source,
      } as any, onVariantRequired);
    }, 420);
  };


  const primePdp = () => {
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
      prefetchProductDetail({ slug: product.slug || product.id, image: imgs[0] });
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
                  className={`absolute inset-0 h-full w-full object-cover object-center transition-[transform,opacity,colors,box-shadow] duration-[900ms] ease-out ${hasSecond && hoverLoaded ? "group-hover:opacity-0 group-hover:scale-[1.03]" : "group-hover:scale-[1.02]"}`}
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
              <span className="text-[9px] font-semibold uppercase tracking-[0.15em]" style={{ color: "#D0021B" }}>
                −{discountPercent}%
              </span>
            </div>
          )}

          <WishlistHeartButton wishlisted={wishlisted} bursting={heartBursting} onClick={handleToggleWishlist} size={30} className="absolute right-2 top-2" />

          <button
            type="button"
            onClick={onAddClick}
            aria-label={adding ? "Adding to cart" : "Add to cart"}
            className="absolute right-2 bottom-2 flex items-center justify-center rounded-full transition-transform duration-200 active:scale-[0.92]"
            style={{
              height: 30,
              width: 30,
              backgroundColor: "color-mix(in srgb, var(--storefront-bg, #fff) 78%, transparent)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              border: "1px solid color-mix(in srgb, var(--storefront-text, #000) 8%, transparent)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
              color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 70%, transparent)",
            }}
          >
            {adding ? (
              <Loader2 className="animate-spin" style={{ height: 16, width: 16 }} strokeWidth={2} aria-hidden="true" />
            ) : (
              <CartIcon style={{ height: 16, width: 16 }} strokeWidth={2} aria-hidden="true" />
            )}
          </button>

        </div>

        <div className="pt-3 pb-1">
          <ProductCardTitle
            name={product.name}
            className="italic transition-[transform,opacity,colors,box-shadow] duration-300 group-hover:underline underline-offset-4"
            baseSize={13}
            minSize={10}
            lineHeight={1.35}
            style={{
              fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
              color: "var(--storefront-text, hsl(var(--foreground)))",
              fontWeight: 500,
            }}
          />

          <div className="mt-1.5 flex items-baseline gap-2">
            {product.sale_price ? (
              <>
                <span className="text-[12px] font-semibold uppercase tracking-[0.14em]" style={{ color: "#D0021B" }}>
                  {currency} {Number(product.sale_price).toFixed(0)}
                </span>
                <span className="text-[11px] uppercase tracking-[0.14em] line-through" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 45%, transparent)" }}>
                  {currency} {Number(product.price).toFixed(0)}
                </span>
              </>

            ) : (
              <span className="text-[12px] font-medium uppercase tracking-[0.14em]" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
                {currency} {Number(product.price).toFixed(0)}
              </span>
            )}
          </div>
        </div>

      </Link>
    </div>
  );
}
