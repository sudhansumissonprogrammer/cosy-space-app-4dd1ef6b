import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

interface TopProductsProps {
  storeId: string;
  currencySymbol: string;
}

export default function TopProducts({ storeId, currencySymbol }: TopProductsProps) {
  const { data: topProducts } = useQuery({
    queryKey: ["top-products-dashboard", storeId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("product_name, quantity, total, order_id, product_id")
        .limit(500);
      if (error) throw error;

      // Filter by store orders
      const { data: storeOrders } = await supabase
        .from("orders")
        .select("id")
        .eq("store_id", storeId)
        .neq("status", "cancelled")
        .limit(500);

      const orderIds = new Set((storeOrders || []).map((o) => o.id));
      const filtered = (data || []).filter((item) => orderIds.has(item.order_id));

      // Aggregate by product
      const map: Record<string, { name: string; qty: number; revenue: number }> = {};
      filtered.forEach((item) => {
        const key = item.product_name;
        if (!map[key]) map[key] = { name: key, qty: 0, revenue: 0 };
        map[key].qty += item.quantity;
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
}
