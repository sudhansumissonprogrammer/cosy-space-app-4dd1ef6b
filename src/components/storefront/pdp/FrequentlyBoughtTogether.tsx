import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { storefrontPath } from "@/lib/subdomain";
import { ShoppingCart, Plus, Zap } from "lucide-react";

interface Props {
  storeId: string;
  storeSlug: string;
  currentProductId: string;
  currentCategory: string | null;
  currency: string;
  addToCart: (item: any) => void;
  productImage: string | null;
}

export default function FrequentlyBoughtTogether({
  storeId,
  storeSlug,
  currentProductId,
  currentCategory,
  currency,
  addToCart,
}: Props) {
  const { data: bundleProducts } = useQuery({
    queryKey: ["bundle-products", storeId, currentProductId],
    queryFn: async () => {
      const { PRODUCT_CARD_FIELDS } = await import("@/lib/productSelectors");
      const { data: coIds, error: coErr } = await supabase.rpc("get_co_purchased_products", {
        _product_id: currentProductId,
        _limit: 2,
      });

      if (!coErr && coIds && coIds.length > 0) {
        const { data: coProducts, error } = await supabase
          .from("products")
          .select(PRODUCT_CARD_FIELDS)
          .in("id", coIds)
          .eq("is_active", true);
        if (!error && coProducts && coProducts.length > 0) return coProducts.slice(0, 2);
      }

      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_CARD_FIELDS)
        .eq("store_id", storeId)
        .eq("is_active", true)
        .neq("id", currentProductId)
        .limit(6);
      if (error) throw error;
      if (currentCategory && data.length > 2) {
        const same = data.filter((p) => p.category === currentCategory);
        const other = data.filter((p) => p.category !== currentCategory);
        return [...same, ...other].slice(0, 2);
      }
      return data.slice(0, 2);
    },
    enabled: !!storeId && !!currentProductId,
    staleTime: 5 * 60 * 1000,
  });

  if (!bundleProducts || bundleProducts.length === 0) return null;

  const bundleTotal = bundleProducts.reduce((sum, p) => {
    const price = p.sale_price && p.sale_price < p.price ? p.sale_price : p.price;
    return sum + price;
  }, 0);
  const bundleDiscount = bundleTotal * 0.05;
  const bundleFinal = bundleTotal - bundleDiscount;

  const handleAddBundle = () => {
    bundleProducts.forEach((p) => {
      addToCart({
        productId: p.id,
        name: p.name,
        price: p.sale_price && p.sale_price < p.price ? p.sale_price : p.price,
        image: p.image_url || undefined,
        quantity: 1,
      });
    });
  };

  return (
    <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">Frequently Bought Together</h3>
      </div>
      <div className="flex items-center gap-2 mb-3 overflow-x-auto">
        {bundleProducts.map((p, idx) => (
          <div key={p.id} className="flex items-center gap-2">
            {idx > 0 && <Plus className="h-4 w-4 text-muted-foreground shrink-0" />}
            <Link
              to={storefrontPath(storeSlug, `product/${p.slug || p.id}`)}
              className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 hover:border-primary/40 transition-colors shrink-0"
            >
              <img src={p.image_url || "/placeholder.svg"} alt={p.name} className="h-12 w-12 rounded-md object-cover" loading="lazy" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground line-clamp-1">{p.name}</p>
                <p className="text-xs font-bold text-primary">
                  {currency} {(p.sale_price && p.sale_price < p.price ? p.sale_price : p.price).toFixed(0)}
                </p>
              </div>
            </Link>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground line-through">{currency} {bundleTotal.toFixed(0)}</p>
          <p className="text-sm font-extrabold text-emerald-600">{currency} {bundleFinal.toFixed(0)} <span className="text-[10px] font-semibold">(-5% bundle)</span></p>
        </div>
        <button
          onClick={handleAddBundle}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors active:scale-95"
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          Add Bundle
        </button>
      </div>
    </div>
  );
}
