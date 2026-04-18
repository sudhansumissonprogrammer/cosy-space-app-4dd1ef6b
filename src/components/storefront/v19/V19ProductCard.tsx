/**
 * V19 Product Card — Blinkit-style:
 * White rounded card, square image, name, price, ADD button → -/qty/+ stepper inline.
 */
import { Link } from "react-router-dom";
import { Plus, Minus, Package } from "lucide-react";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl, resolveProductImages } from "@/lib/imageOptimize";
import { getDiscountPercent } from "@/lib/productUtils";
import { useProductCardActions } from "@/hooks/useProductCardActions";

interface Props {
  product: any;
  slug: string;
  store: any;
  priority?: boolean;
}

export default function V19ProductCard({ product, slug, store, priority = false }: Props) {
  const { cartQty, effectivePrice, handleAddToCart, updateQuantity } = useProductCardActions(product);
  const discountPercent = getDiscountPercent(product.price, product.sale_price);
  const images = resolveProductImages(product);
  const img = images[0];

  const onAdd = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    handleAddToCart(e);
  };
  const onInc = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); updateQuantity(product.id, undefined, cartQty + 1); };
  const onDec = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); updateQuantity(product.id, undefined, cartQty - 1); };

  const productPath = storefrontPath(slug, `product/${product.slug || product.id}`);

  return (
    <div className="v19-card relative">
      <Link to={productPath} className="block">
        <div className="relative w-full overflow-hidden rounded-lg bg-gray-50" style={{ aspectRatio: "1/1" }}>
          {discountPercent && (
            <div className="absolute right-1.5 top-1.5 z-10 bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm">
              {discountPercent}% OFF
            </div>
          )}
          {img ? (
            <img
              src={optimizeImageUrl(img, 400, 85)}
              alt={product.name}
              className="h-full w-full object-contain p-2"
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : "auto"}
              width={400}
              height={400}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <Package className="h-10 w-10 text-gray-300" />
            </div>
          )}
        </div>
      </Link>
      <div className="pt-2.5">
        <Link to={productPath}>
          <h3 className="text-[13px] font-medium text-gray-900 line-clamp-2 leading-snug min-h-[34px]">
            {product.name}
          </h3>
        </Link>
        <div className="flex items-center justify-between mt-2 gap-2">
          <div className="flex flex-col">
            <span className="text-[15px] font-bold text-gray-900 leading-none">
              ₹{Number(effectivePrice).toFixed(2)}
            </span>
            {product.sale_price && Number(product.sale_price) < Number(product.price) && (
              <span className="text-[11px] text-gray-400 line-through leading-none mt-0.5">
                ₹{Number(product.price).toFixed(2)}
              </span>
            )}
          </div>
          {cartQty > 0 ? (
            <div className="v19-stepper">
              <button onClick={onDec} aria-label="Decrease"><Minus className="h-3.5 w-3.5" strokeWidth={3} /></button>
              <span className="px-2 min-w-[20px] text-center">{cartQty}</span>
              <button onClick={onInc} aria-label="Increase"><Plus className="h-3.5 w-3.5" strokeWidth={3} /></button>
            </div>
          ) : (
            <button onClick={onAdd} className="v19-add-btn-solid">ADD</button>
          )}
        </div>
      </div>
    </div>
  );
}
