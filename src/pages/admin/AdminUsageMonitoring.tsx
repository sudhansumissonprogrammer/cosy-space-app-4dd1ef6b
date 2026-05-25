import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity, Eye, ShoppingCart, Package, Users, Image, MessageSquare,
  Search, ArrowUpDown, AlertTriangle, TrendingUp, Database, HardDrive,
} from "lucide-react";

interface StoreUsage {
  store_id: string;
  store_name: string;
  store_slug: string;
  logo_url: string | null;
  is_suspended: boolean;
  store_created_at: string;
  product_count: number;
  total_orders: number;
  orders_today: number;
  orders_7d: number;
  total_revenue: number;
  total_page_views: number;
  views_today: number;
  views_7d: number;
  avg_daily_views: number;
  visitors_today: number;
  visitors_7d: number;
  sessions_today: number;
  sessions_7d: number;
  customer_count: number;
  wa_messages_sent: number;
  category_count: number;
  image_count: number;
  abandoned_carts: number;
}

type SortKey = "views_today" | "views_7d" | "total_page_views" | "visitors_today" | "visitors_7d" | "sessions_today" | "sessions_7d" | "orders_today" | "orders_7d" | "total_orders" | "product_count" | "image_count" | "wa_messages_sent" | "store_name";

const USAGE_TIERS = {
  heavy: { minViews: 500, color: "text-destructive", bg: "bg-destructive/10", label: "Heavy" },
  moderate: { minViews: 100, color: "text-amber-600", bg: "bg-amber-50", label: "Moderate" },
  light: { minViews: 0, color: "text-emerald-600", bg: "bg-emerald-50", label: "Light" },
} as const;

function getUsageTier(viewsToday: number) {
  if (viewsToday >= USAGE_TIERS.heavy.minViews) return USAGE_TIERS.heavy;
  if (viewsToday >= USAGE_TIERS.moderate.minViews) return USAGE_TIERS.moderate;
  return USAGE_TIERS.light;
}

export default function AdminUsageMonitoring() {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("views_today");
  const [sortAsc, setSortAsc] = useState(false);

  const { data: stores, isLoading } = useQuery({
    queryKey: ["admin-store-usage"],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_store_usage_stats");
      if (error) throw error;
      return data as unknown as StoreUsage[];
    },
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const filtered = useMemo(() => {
    if (!stores) return [];
    let list = stores;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) => s.store_name.toLowerCase().includes(q) || s.store_slug.toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      if (typeof aVal === "string") return sortAsc ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return list;
  }, [stores, search, sortKey, sortAsc]);

  // Aggregate summary
  const summary = useMemo(() => {
    if (!stores) return null;
    return {
      totalStores: stores.length,
      totalViewsToday: stores.reduce((s, st) => s + st.views_today, 0),
      totalVisitorsToday: stores.reduce((s, st) => s + (st.visitors_today || 0), 0),
      totalSessionsToday: stores.reduce((s, st) => s + (st.sessions_today || 0), 0),
      totalOrdersToday: stores.reduce((s, st) => s + st.orders_today, 0),
      totalProducts: stores.reduce((s, st) => s + st.product_count, 0),
      totalImages: stores.reduce((s, st) => s + st.image_count, 0),
      heavyUsers: stores.filter((s) => s.views_today >= USAGE_TIERS.heavy.minViews).length,
    };
  }, [stores]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Usage Monitoring</h1>
        <p className="text-sm text-muted-foreground">Track per-store resource consumption and detect heavy users</p>
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Total Stores", value: summary.totalStores, icon: Database, color: "text-primary" },
            { label: "Visitors Today", value: summary.totalVisitorsToday.toLocaleString(), icon: Users, color: "text-indigo-600" },
            { label: "Sessions Today", value: summary.totalSessionsToday.toLocaleString(), icon: Activity, color: "text-cyan-600" },
            { label: "Views Today", value: summary.totalViewsToday.toLocaleString(), icon: Eye, color: "text-blue-600" },
            { label: "Orders Today", value: summary.totalOrdersToday, icon: ShoppingCart, color: "text-emerald-600" },
            { label: "Heavy Users", value: summary.heavyUsers, icon: AlertTriangle, color: "text-destructive" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="border shadow-none">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${color}`} />
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
                </div>
                <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search stores..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Badge variant="outline" className="text-xs">
          {filtered.length} store{filtered.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Usage Table */}
      <Card className="border shadow-none overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Store</th>
                <SortHeader label="Views Today" sortKey="views_today" current={sortKey} asc={sortAsc} onClick={handleSort} />
                <SortHeader label="Views 7d" sortKey="views_7d" current={sortKey} asc={sortAsc} onClick={handleSort} />
                <SortHeader label="Avg/Day" sortKey="total_page_views" current={sortKey} asc={sortAsc} onClick={handleSort} />
                <SortHeader label="Orders Today" sortKey="orders_today" current={sortKey} asc={sortAsc} onClick={handleSort} />
                <SortHeader label="Orders 7d" sortKey="orders_7d" current={sortKey} asc={sortAsc} onClick={handleSort} />
                <SortHeader label="Total Orders" sortKey="total_orders" current={sortKey} asc={sortAsc} onClick={handleSort} />
                <SortHeader label="Products" sortKey="product_count" current={sortKey} asc={sortAsc} onClick={handleSort} />
                <SortHeader label="Images" sortKey="image_count" current={sortKey} asc={sortAsc} onClick={handleSort} />
                <SortHeader label="WA Msgs" sortKey="wa_messages_sent" current={sortKey} asc={sortAsc} onClick={handleSort} />
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Tier</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 11 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">No stores found</td>
                </tr>
              ) : (
                filtered.map((store) => {
                  const tier = getUsageTier(store.views_today);
                  return (
                    <tr key={store.store_id} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-[140px]">
                          {store.logo_url ? (
                            <img src={store.logo_url} alt="" className="h-7 w-7 rounded-full object-cover border border-border" />
                          ) : (
                            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                              {store.store_name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-semibold text-foreground truncate max-w-[120px]">{store.store_name}</p>
                            <p className="text-[10px] text-muted-foreground">/{store.store_slug}</p>
                          </div>
                          {store.is_suspended && (
                            <Badge variant="destructive" className="text-[8px] px-1 py-0 ml-1">Suspended</Badge>
                          )}
                        </div>
                      </td>
                      <MetricCell value={store.views_today} highlight={store.views_today >= 500} />
                      <MetricCell value={store.views_7d} />
                      <MetricCell value={store.avg_daily_views} />
                      <MetricCell value={store.orders_today} highlight={store.orders_today >= 50} />
                      <MetricCell value={store.orders_7d} />
                      <MetricCell value={store.total_orders} />
                      <MetricCell value={store.product_count} />
                      <MetricCell value={store.image_count} />
                      <MetricCell value={store.wa_messages_sent} />
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${tier.bg} ${tier.color}`}>
                          {tier.label === "Heavy" && <AlertTriangle className="h-3 w-3" />}
                          {tier.label === "Moderate" && <TrendingUp className="h-3 w-3" />}
                          {tier.label === "Light" && <Activity className="h-3 w-3" />}
                          {tier.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-destructive" /> Heavy (500+ views/day)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> Moderate (100–499)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Light (&lt;100)
        </span>
      </div>
    </div>
  );
}

function SortHeader({ label, sortKey, current, asc, onClick }: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  asc: boolean;
  onClick: (key: SortKey) => void;
}) {
  const isActive = current === sortKey;
  return (
    <th className="px-4 py-3">
      <button
        onClick={() => onClick(sortKey)}
        className={`flex items-center gap-1 text-xs font-medium transition-colors ${isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
      >
        {label}
        <ArrowUpDown className={`h-3 w-3 ${isActive ? "opacity-100" : "opacity-40"}`} />
      </button>
    </th>
  );
}

function MetricCell({ value, highlight }: { value: number; highlight?: boolean }) {
  return (
    <td className="px-4 py-3">
      <span className={`text-xs tabular-nums ${highlight ? "font-bold text-destructive" : "text-foreground"}`}>
        {value.toLocaleString()}
      </span>
    </td>
  );
}
