import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

interface TopProductsProps {
  storeId: string;
  currencySymbol: string;
}

const TopProducts = React.forwardRef<HTMLDivElement, TopProductsProps>(function TopProducts({ storeId, currencySymbol }, ref) {
  const { data: topProducts, isLoading } = useQuery({
    queryKey: ["top-products-dashboard", storeId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Aggregated server-side in one indexed query (was: paginated scan of every order line).
      const { data, error } = await supabase.rpc("get_top_products", {
        _store_id: storeId,
        _limit: 5,
      });
      if (error) throw error;
      return ((data || []) as Array<{ name: string; qty: number; revenue: number }>).map((row) => ({
        name: row.name,
        qty: Number(row.qty || 0),
        revenue: Number(row.revenue || 0),
      }));
    },
    enabled: !!storeId,
  });

  if (isLoading) {
    return (
      <Card className="border shadow-none">
        <CardContent className="p-3 space-y-2">
          <div className="h-3 w-20 rounded bg-muted animate-pulse" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 rounded bg-muted/60 animate-pulse" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!topProducts || topProducts.length === 0) {
    return (
      <Card className="border shadow-none">
        <CardContent className="p-4 text-center">
          <p className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">Top Products</p>
          <p className="text-sm text-muted-foreground">
            No sales yet — your best performers will show up here.
          </p>
        </CardContent>
      </Card>
    );
  }

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
