/**
 * V19 Product Card — Blinkit-style with delivery time pill, weight line, outlined ADD.
 * Adds: low-stock + out-of-stock badges, disabled ADD on OOS, desktop hover lift.
 */
import { Link } from "react-router-dom";
import { Plus, Minus, Package, Clock } from "lucide-react";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl, resolveProductImages } from "@/lib/imageOptimize";
import { getDiscountPercent } from "@/lib/productUtils";
import { useCart } from "@/contexts/CartContext";

interface Props {
  product: any;
  slug: string;
  store: any;
  priority?: boolean;
}

export default function V19ProductCard({ product, slug, store, priority = false }: Props) {
  const { items, addToCart, updateQuantity } = useCart();
  const cartItem = items.find((i) => i.productId === product.id && !i.variantId);
  const cartQty = cartItem?.quantity || 0;
  const effectivePrice = product.sale_price && Number(product.sale_price) < Number(product.price)
    ? Number(product.sale_price)
    : Number(product.price);
  const discountPercent = getDiscountPercent(product.price, product.sale_price);
  const images = resolveProductImages(product);
  const img = images[0];

  const stock = Number(product.stock_quantity ?? 0);
  const tracksStock = product.stock_quantity !== null && product.stock_quantity !== undefined;
  const outOfStock = tracksStock && stock <= 0;
  const lowStock = tracksStock && stock > 0 && stock <= 5;

  const onAdd = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (outOfStock) return;
    addToCart({
      productId: product.id,
      name: product.name,
      price: effectivePrice,
      image: product.image_url || undefined,
      quantity: 1,
    }, { silent: true });
  };
  const onInc = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); updateQuantity(product.id, undefined, cartQty + 1); };
  const onDec = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); updateQuantity(product.id, undefined, cartQty - 1); };

  const productPath = storefrontPath(slug, `product/${product.slug || product.id}`);
  const weightLine = (product as any).weight || (product as any).unit || "1 piece";

  return (
    <div className="v19-card relative h-full flex flex-col">
      <Link to={productPath} className="block">
        <div className="relative w-full overflow-hidden rounded-lg bg-gray-50 aspect-square">
          {discountPercent && !outOfStock && (
            <div className="absolute left-1.5 top-1.5 z-10 text-white text-[9px] font-black px-1.5 py-0.5 rounded-sm" style={{ background: "var(--storefront-primary, #036B52)" }}>
              {discountPercent}% OFF
            </div>
          )}
          {outOfStock ? (
            <div className="v19-stock-badge v19-stock-out">OUT OF STOCK</div>
          ) : lowStock ? (
            <div className="v19-stock-badge v19-stock-low">ONLY {stock} LEFT</div>
          ) : null}
          {img ? (
            <img
              src={optimizeImageUrl(img, 280, 80)}
              alt={product.name}
              className={`h-full w-full object-cover ${outOfStock ? "opacity-50" : ""}`}
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : "auto"}
              width={280}
              height={280}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <Package className="h-10 w-10 text-gray-300" />
            </div>
          )}
        </div>
      </Link>
      <div className="pt-2.5 flex-1 flex flex-col">
        <Link to={productPath}>
          <h3 className="text-[13px] font-semibold text-gray-900 line-clamp-2 leading-snug min-h-[34px]">
            {product.name}
          </h3>
        </Link>
        <div className="text-[11px] text-gray-500 font-medium mt-1">{weightLine}</div>
        <div className="flex items-center justify-between mt-auto pt-2 gap-2">
          <div className="flex flex-col">
            <span className="text-[14px] font-bold text-gray-900 leading-none">
              ₹{Number(effectivePrice).toFixed(0)}
            </span>
            {product.sale_price && Number(product.sale_price) < Number(product.price) && (
              <span className="text-[11px] text-gray-400 line-through leading-none mt-0.5">
                ₹{Number(product.price).toFixed(0)}
              </span>
            )}
          </div>
          {outOfStock ? (
            <button
              disabled
              className="v19-add-btn-outline"
              aria-label="Out of stock"
            >
              SOLD
            </button>
          ) : cartQty > 0 ? (
            <div className="v19-stepper">
              <button onClick={onDec} aria-label="Decrease" className="active:scale-90 transition-transform"><Minus className="h-3.5 w-3.5" strokeWidth={3} /></button>
              <span className="px-2 min-w-[20px] text-center">{cartQty}</span>
              <button onClick={onInc} aria-label="Increase" className="active:scale-90 transition-transform"><Plus className="h-3.5 w-3.5" strokeWidth={3} /></button>
            </div>
          ) : (
            <button onClick={onAdd} className="v19-add-btn-outline active:scale-95 transition-transform">ADD</button>
          )}
        </div>
      </div>
    </div>
  );
}
