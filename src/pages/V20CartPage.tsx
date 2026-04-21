/**
 * V20 Cart Page — Theme 20 (Multi Purpose). Duplicated from V19CartPage.
 */
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, Minus, ShoppingCart, Tag, Info, ChevronRight, Receipt, Trash2, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { storefrontPath } from "@/lib/subdomain";
import { optimizeImageUrl } from "@/lib/imageOptimize";
import type { StoreData } from "@/layouts/StorefrontLayout";
import type { CSSProperties } from "react";

const PRIMARY = "var(--storefront-primary, #036B52)";
const PRIMARY_TINT = `linear-gradient(rgba(255,255,255,0.9), rgba(255,255,255,0.9)), ${PRIMARY}`;
const PRIMARY_TINT_STRONG = `linear-gradient(rgba(255,255,255,0.82), rgba(255,255,255,0.82)), ${PRIMARY}`;
const PRIMARY_BORDER = "color-mix(in srgb, var(--storefront-primary, #036B52) 22%, white)";

export default function V20CartPage() {
  const store = useOutletContext<StoreData>();
  const navigate = useNavigate();
  const { items, updateQuantity, removeFromCart, cartTotal, cartCount } = useCart();
  const slug = store?.slug || "";

  const { data: shippingConfig } = useQuery({
    queryKey: ["storefront-shipping-config", store?.id],
    enabled: !!store?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("store_shipping_config")
        .select("free_shipping_above, flat_rate, is_active")
        .eq("store_id", store!.id)
        .maybeSingle();
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });

  const productIds = items.map((i) => i.productId).filter(Boolean);
  const { data: priceMap } = useQuery({
    queryKey: ["v20-cart-mrp", store?.id, productIds.sort().join(",")],
    enabled: !!store?.id && productIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, price, sale_price")
        .in("id", productIds);
      const map: Record<string, { price: number; sale_price: number | null }> = {};
      (data || []).forEach((p: any) => {
        map[p.id] = { price: Number(p.price || 0), sale_price: p.sale_price ? Number(p.sale_price) : null };
      });
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });

  const itemsTotal = cartTotal;
  const mrpTotal = items.reduce((sum, i) => {
    const mrp = priceMap?.[i.productId]?.price ?? i.price;
    return sum + Math.max(mrp, i.price) * i.quantity;
  }, 0);
  const productSavings = Math.max(0, mrpTotal - itemsTotal);

  const freeAbove = Number(shippingConfig?.free_shipping_above ?? 0) || 0;
  const flatRate = Number(shippingConfig?.flat_rate ?? 0) || 0;
  const shippingActive = shippingConfig?.is_active !== false;
  const qualifiesFree = freeAbove > 0 && itemsTotal >= freeAbove;
  const deliveryFee = !shippingActive ? 0 : qualifiesFree || freeAbove === 0 && flatRate === 0 ? 0 : flatRate;
  const remainingForFree = freeAbove > 0 ? Math.max(0, freeAbove - itemsTotal) : 0;
  const progressPct = freeAbove > 0 ? Math.min(100, (itemsTotal / freeAbove) * 100) : 100;

  const handlingFee = 0;
  const grandTotal = itemsTotal + deliveryFee + handlingFee;
  const totalSavings = productSavings + (qualifiesFree && flatRate > 0 ? flatRate : 0);

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center gap-3 h-14 px-4">
            <button onClick={() => navigate(-1)} aria-label="Back" className="-ml-1 p-1">
              <ArrowLeft className="h-5 w-5 text-gray-900" />
            </button>
            <div className="font-extrabold text-[15px] text-gray-900">My Cart</div>
          </div>
        </header>
        <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
          <div className="h-24 w-24 rounded-full flex items-center justify-center mb-5" style={{ background: PRIMARY_TINT }}>
            <ShoppingCart className="h-12 w-12" style={{ color: PRIMARY }} />
          </div>
          <h1 className="text-[18px] font-extrabold text-gray-900">Your cart is empty</h1>
          <p className="mt-1.5 text-[13px] text-gray-500">Add items to start your order</p>
          <Link to={storefrontPath(slug)} className="mt-6 inline-flex items-center justify-center h-11 px-7 rounded-lg text-white text-[14px] font-extrabold" style={{ background: PRIMARY }}>
            Start Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-32">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3 h-14 px-4">
          <button onClick={() => navigate(-1)} aria-label="Back" className="-ml-1 p-1">
            <ArrowLeft className="h-5 w-5 text-gray-900" />
          </button>
          <div className="flex flex-col leading-tight">
            <div className="font-extrabold text-[15px] text-gray-900">My Cart</div>
            <div className="text-[11px] text-gray-500 font-semibold">{cartCount} {cartCount === 1 ? "item" : "items"}</div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-3 pt-3 space-y-3">
        {totalSavings > 0 && (
          <div className="rounded-xl px-3.5 py-2.5 flex items-center gap-2" style={{ background: PRIMARY_TINT_STRONG, border: `1px solid ${PRIMARY_BORDER}` }}>
            <Tag className="h-4 w-4" style={{ color: PRIMARY }} strokeWidth={2.5} />
            <span className="text-[12.5px] font-bold" style={{ color: PRIMARY }}>You're saving ₹{totalSavings.toFixed(0)} on this order</span>
          </div>
        )}

        {freeAbove > 0 && shippingActive && (
          <div className="rounded-xl bg-white p-3.5 border border-gray-200">
            {qualifiesFree ? (
              <div className="text-[12.5px] font-extrabold" style={{ color: PRIMARY }}>🎉 Yay! You unlocked FREE delivery</div>
            ) : (
              <>
                <div className="text-[12.5px] font-bold text-gray-800">
                  Add items worth <span style={{ color: PRIMARY }}>₹{remainingForFree.toFixed(0)}</span> more for FREE delivery
                </div>
                <div className="h-2 mt-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, background: PRIMARY }} />
                </div>
              </>
            )}
          </div>
        )}

        <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
          <div className="px-3.5 pt-3 pb-2 flex items-center justify-between">
            <div className="text-[13px] font-extrabold text-gray-900">Items in your cart</div>
            <div className="text-[11px] text-gray-500 font-semibold">{cartCount} {cartCount === 1 ? "item" : "items"}</div>
          </div>
          <ul className="divide-y divide-gray-100">
            {items.map((item) => (
              <li key={`${item.productId}-${item.variantId || ""}`} className="flex gap-3 p-3.5">
                {item.image ? (
                  <img src={optimizeImageUrl(item.image, 160, 80)} alt={item.name} width={64} height={64}
                    className="h-16 w-16 rounded-lg object-contain bg-gray-50 flex-shrink-0 border border-gray-100" loading="lazy" />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 border border-gray-100">
                    <Package className="h-6 w-6 text-gray-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="text-[13px] font-semibold text-gray-900 line-clamp-2 leading-snug">{item.name}</div>
                  {item.variantName && <div className="text-[11px] text-gray-500 font-medium mt-0.5">{item.variantName}</div>}
                  <div className="mt-auto flex items-center justify-between pt-2 gap-2">
                    <div className="flex flex-col leading-none">
                      <span className="text-[14px] font-extrabold text-gray-900">₹{(item.price * item.quantity).toFixed(0)}</span>
                      {item.quantity > 1 && (
                        <span className="text-[10.5px] text-gray-500 font-semibold mt-0.5">₹{item.price.toFixed(0)} × {item.quantity}</span>
                      )}
                    </div>
                    <div className="inline-flex items-center text-white font-extrabold rounded-md overflow-hidden" style={{ background: PRIMARY, height: 32 }}>
                      <button onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)} className="w-8 h-full flex items-center justify-center active:bg-black/10" aria-label="Decrease">
                        {item.quantity === 1 ? <Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} /> : <Minus className="h-3.5 w-3.5" strokeWidth={3} />}
                      </button>
                      <span className="px-2.5 min-w-[26px] text-center text-[13px]">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)} className="w-8 h-full flex items-center justify-center active:bg-black/10" aria-label="Increase">
                        <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <Link to={storefrontPath(slug)} className="block text-center py-3 border-t border-gray-100 text-[13px] font-extrabold" style={{ color: PRIMARY }}>
            + Add more items
          </Link>
        </div>

        <Link to={storefrontPath(slug, "checkout")} className="rounded-xl bg-white border border-gray-200 p-3.5 flex items-center gap-3">
          <div className="h-9 w-9 rounded-md flex items-center justify-center" style={{ background: "#FFF8E1" }}>
            <Tag className="h-4 w-4" style={{ color: "#F57C00" }} />
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-extrabold text-gray-900">Apply coupon</div>
            <div className="text-[11px] text-gray-500 font-semibold">Save more with offers at checkout</div>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </Link>

        <div className="rounded-xl bg-white border border-gray-200 p-3.5">
          <div className="flex items-center gap-2 mb-3">
            <Receipt className="h-4 w-4 text-gray-700" />
            <span className="text-[13px] font-extrabold text-gray-900">Bill details</span>
          </div>
          <BillRow label={`Items total (${cartCount})`} value={`₹${itemsTotal.toFixed(0)}`} />
          {productSavings > 0 && <BillRow label="Product discount" value={`-₹${productSavings.toFixed(0)}`} valueStyle={{ color: PRIMARY }} />}
          <BillRow
            label="Delivery charges"
            value={!shippingActive || (qualifiesFree && flatRate > 0) ? "FREE" : flatRate === 0 ? "FREE" : `₹${deliveryFee.toFixed(0)}`}
            valueStyle={(!shippingActive || qualifiesFree || flatRate === 0) ? { color: PRIMARY } : undefined}
            strike={qualifiesFree && flatRate > 0 ? `₹${flatRate.toFixed(0)}` : undefined}
          />
          <div className="border-t border-dashed border-gray-200 my-2.5" />
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-extrabold text-gray-900">Grand total</span>
            <span className="text-[16px] font-black text-gray-900">₹{grandTotal.toFixed(0)}</span>
          </div>
          {totalSavings > 0 && (
            <div className="mt-2 rounded-md py-1.5 px-2.5 text-center text-[11.5px] font-extrabold" style={{ background: PRIMARY_TINT_STRONG, color: PRIMARY }}>
              You saved ₹{totalSavings.toFixed(0)} on this order
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white border border-gray-200 p-3.5">
          <div className="flex items-start gap-2.5">
            <Info className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-[12.5px] font-extrabold text-gray-900">Cancellation policy</div>
              <div className="text-[11.5px] text-gray-500 font-medium leading-snug mt-1">
                Orders cannot be cancelled once packed for delivery. In case of unexpected delays, a refund will be provided, if applicable.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex flex-col leading-tight">
            <span className="text-[16px] font-black text-gray-900">₹{grandTotal.toFixed(0)}</span>
            <span className="text-[11px] font-bold" style={{ color: PRIMARY }}>TOTAL</span>
          </div>
          <button onClick={() => navigate(storefrontPath(slug, "checkout"))} className="flex-1 h-12 rounded-lg flex items-center justify-between px-4 text-white text-[14px] font-extrabold active:scale-[0.98] transition-transform" style={{ background: PRIMARY }}>
            <span>Click to pay</span>
            <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

function BillRow({ label, value, valueStyle, strike }: { label: string; value: string; valueStyle?: CSSProperties; strike?: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[12.5px] text-gray-700 font-medium">{label}</span>
      <span className="flex items-center gap-1.5">
        {strike && <span className="text-[11px] text-gray-400 line-through font-semibold">{strike}</span>}
        <span className="text-[12.5px] font-extrabold text-gray-900" style={valueStyle}>{value}</span>
      </span>
    </div>
  );
}
