import { useNavigateTransition } from "@/hooks/useNavigateTransition";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingBag, ShoppingCart } from "lucide-react";

interface PendingActionsProps {
  storeId: string;
  storeSlug: string;
}

export default function PendingActions({ storeId, storeSlug }: PendingActionsProps) {
  const { navigate } = useNavigateTransition();

  // Shares the dashboard-stats query — no extra request.
  const { data } = useDashboardStats(storeId);

  const items = [
    { label: "Pending Orders", count: data?.pending_orders ?? 0, icon: ShoppingBag, color: "bg-warning/15 text-warning", url: `/dashboard/stores/${storeSlug}/orders` },
    { label: "Abandoned Carts", count: data?.abandoned_carts ?? 0, icon: ShoppingCart, color: "bg-red-100 text-red-700", url: `/dashboard/stores/${storeSlug}/abandoned-carts` },
  ];

  const hasAny = items.some((i) => i.count > 0);
  if (!hasAny) return null;

  return (
    <Card className="border shadow-none hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-4">
        <p className="mb-3 text-[11px] font-bold text-muted-foreground uppercase tracking-[0.1em]">Needs Attention</p>
        <div className="space-y-2">
          {items.filter((i) => i.count > 0).map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.url)}
              className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent/50"
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.color}`}>
                <item.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
              </div>
              <span className="text-sm font-bold text-foreground">{item.count}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
