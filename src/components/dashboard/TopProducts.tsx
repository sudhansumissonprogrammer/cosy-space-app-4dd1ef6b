import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

interface TopProductsProps {
  storeId: string;
  currencySymbol: string;
}

const TopProducts = React.forwardRef<HTMLDivElement, TopProductsProps>(function TopProducts({ storeId, currencySymbol }, ref) {
  const { data: topProducts } = useQuery({
    queryKey: ["top-products-dashboard", storeId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Server-side scope to this store via inner join on orders.
      // Previously this fetched 500 global order_items + 500 orders and filtered client-side
      // (slowest #2 query in pg_stat_statements, also a tenant-leak risk).
      const { data, error } = await supabase
        .from("order_items")
        .select("product_name, quantity, total, orders!inner(store_id, status)")
        .eq("orders.store_id", storeId)
        .neq("orders.status", "cancelled")
        .limit(500);
      if (error) throw error;

      const map: Record<string, { name: string; qty: number; revenue: number }> = {};
      (data || []).forEach((item: any) => {
        const key = item.product_name;
        if (!key) return;
        if (!map[key]) map[key] = { name: key, qty: 0, revenue: 0 };
        map[key].qty += item.quantity || 0;
        map[key].revenue += Number(item.total || 0);
      });

      return Object.values(map)
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);
    },
    enabled: !!storeId,
  });

  if (!topProducts || topProducts.length === 0) return null;

  return (
    <Card className="border shadow-none">
      <CardContent className="p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Top Products</p>
        <div className="space-y-2">
          {topProducts.map((product, i) => (
            <div key={product.name} className="flex items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                <p className="text-[10px] text-muted-foreground">{product.qty} sold</p>
              </div>
              <p className="text-sm font-bold text-foreground shrink-0">{currencySymbol}{product.revenue.toFixed(0)}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

export default TopProducts;
