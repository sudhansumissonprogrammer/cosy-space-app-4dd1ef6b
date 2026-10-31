import { lazy, Suspense, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Radio, RefreshCw } from "lucide-react";
import { orderPoint, visitorPoint, type ActivityPoint } from "./geography";
const ActivityEarth = lazy(() => import("./ActivityEarth"));
interface LivePayload {
  live: { active: number; mobile: number; desktop: number; tablet: number; top_pages: {path:string;count:number}[] };
  behavior: {cart_sessions:number;checkout_sessions:number}; purchases:number; sales:number; updated_at:string;
  order_locations: {city:string|null;state:string|null;orders:number}[];
  visitor_countries: {country:string|null;visitors:number}[];
}
export default function LiveStoreView({ storeId, symbol }: {storeId:string;symbol:string}) {
  const query = useQuery({ queryKey: ["store-live-view", storeId], enabled: !!storeId, staleTime: 10_000, refetchInterval: 15_000, refetchIntervalInBackground: false,
    queryFn: async () => { const { data, error } = await supabase.rpc("get_store_live_view", {_store_id:storeId}); if(error) throw error; return data as unknown as LivePayload; } });
  const data = query.data;
  const { points, unmappedOrders } = useMemo(() => {
    const points: ActivityPoint[] = []; let unmappedOrders = 0;
    for (const row of data?.order_locations || []) { const p = orderPoint(row.city,row.state,row.orders); if(p) points.push(p); else unmappedOrders += row.orders; }
    for (const row of data?.visitor_countries || []) { const p = visitorPoint(row.country,row.visitors); if(p) points.push(p); }
    return {points,unmappedOrders};
  }, [data]);
  const mappedVisitors = points.filter(p => p.kind === "visitor").reduce((n,p) => n+p.count,0);
  const stats = [
    ["Visitors right now", data?.live.active, "Active within 90 seconds"],
    ["Added to cart", data?.behavior.cart_sessions, "Sessions · last 10 minutes"],
    ["Started checkout", data?.behavior.checkout_sessions, "Sessions · last 10 minutes"],
    ["Orders placed", data?.purchases, "Confirmed orders · last 10 minutes"],
  ] as const;
  return <section className="overflow-hidden rounded-lg border bg-card" aria-label="Live store activity">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><Radio className="h-4 w-4 text-success" />Live view</h2>
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>{query.isError ? "Update failed" : data ? `Updated ${new Date(data.updated_at).toLocaleTimeString()}` : "Connecting…"}</span><Button variant="ghost" size="icon" aria-label="Refresh live activity" title="Refresh live activity" onClick={() => query.refetch()}><RefreshCw className="h-4 w-4" /></Button></div>
    </div>
    {query.isError && <p role="alert" className="px-4 py-2 text-sm text-destructive">Live activity couldn’t load. Refresh to try again.</p>}
    <div className="grid grid-cols-2 divide-x lg:grid-cols-4">
      {stats.map(([label,value,detail]) => <div className="min-w-0 px-4 py-3" key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="my-1 text-2xl font-semibold tabular-nums">{query.isError ? "—" : value === undefined ? "…" : Number(value).toLocaleString()}</p><p className="text-[10px] text-muted-foreground">{detail}</p></div>)}
    </div>
    <div className="grid border-t lg:grid-cols-[minmax(0,1fr)_240px]">
      <Suspense fallback={<div className="h-[460px] animate-pulse bg-muted" />}><ActivityEarth points={points} /></Suspense>
      <aside className="space-y-5 border-t p-4 lg:border-l lg:border-t-0">
        <div><p className="text-xs text-muted-foreground">Sales · last 10 minutes</p><p className="text-xl font-semibold tabular-nums">{query.isError ? "—" : data ? `${symbol}${Number(data.sales).toLocaleString("en-IN")}` : "…"}</p></div>
        <div className="flex flex-wrap gap-3 text-xs"><span className="inline-flex items-center gap-1.5"><i className="earth-order-dot" />Orders · 24h</span><span className="inline-flex items-center gap-1.5"><i className="earth-visitor-dot" />Visitors</span></div>
        <div><h3 className="mb-2 text-xs font-semibold">Purchase locations · last 24h</h3>{points.filter(p=>p.kind==="order").slice(0,6).map(p=><div key={p.label} className="flex justify-between gap-2 py-1 text-xs"><span className="truncate">{p.label}</span><span className="tabular-nums">{p.count}</span></div>)}{!points.some(p=>p.kind==="order")&&<p className="text-xs text-muted-foreground">No mapped purchases in the last 24 hours.</p>}</div>
        {data && <p className="text-[10px] leading-relaxed text-muted-foreground">Purchase dots show approximate city centres, not addresses. {unmappedOrders} orders without a reliable city match. {Math.max(0,data.live.active-mappedVisitors)} active visitors with location unavailable. Visitor dots are country-level.</p>}
        {!!data?.live.top_pages.length && <div><h3 className="mb-2 text-xs font-semibold">Pages right now</h3>{data.live.top_pages.map(p=><div key={p.path} className="flex justify-between gap-2 py-1 text-xs"><span className="truncate">{p.path}</span><span>{p.count}</span></div>)}</div>}
      </aside>
    </div>
  </section>;
}