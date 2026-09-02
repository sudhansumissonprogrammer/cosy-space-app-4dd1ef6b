// Store Funnel — deep last-24h (or 7d/30d) funnel analysis for one store.
//
// Answers the merchant's #1 question: "Where am I losing sales?"
// Every step is per-store, filtered by store_id, and shows conversion vs the
// step before it. The biggest drop-off is highlighted so the merchant knows
// the single most valuable thing to fix RIGHT NOW.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDashboardStore } from "@/contexts/DashboardStoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Eye, MousePointerClick, ShoppingCart, CreditCard, IndianRupee,
  CheckCircle2, AlertTriangle, TrendingDown, Package, Smartphone,
  Users, Repeat, MapPin,
} from "lucide-react";
import { subHours, subDays } from "date-fns";

type Range = "24h" | "7d" | "30d";

interface FunnelStep {
  key: string;
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}

function pct(a: number, b: number): number {
  if (!b) return 0;
  return Math.round((a / b) * 1000) / 10;
}

function StepBar({ step, base, prev, isWorst }: {
  step: FunnelStep; base: number; prev?: number; isWorst?: boolean;
}) {
  const Icon = step.icon;
  const widthPct = base ? Math.max(4, (step.value / base) * 100) : 0;
  const fromPrev = prev ? pct(step.value, prev) : 100;
  const dropFromPrev = prev ? 100 - fromPrev : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 font-medium">
          <Icon className="h-3.5 w-3.5" style={{ color: step.color }} />
          {step.label}
          {isWorst && (
            <Badge variant="destructive" className="h-4 px-1 text-[9px]">
              biggest leak
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 tabular-nums">
          <span className="font-bold">{step.value.toLocaleString()}</span>
          <span className="text-muted-foreground w-14 text-right">
            {pct(step.value, base).toFixed(1)}%
          </span>
          {prev !== undefined && (
            <span className={`w-16 text-right ${dropFromPrev > 60 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
              {prev > 0 ? `−${dropFromPrev.toFixed(0)}%` : "—"}
            </span>
          )}
        </div>
      </div>
      <div className="h-6 rounded bg-muted overflow-hidden">
        <div
          className="h-full transition-all"
          style={{ width: `${widthPct}%`, background: step.color, opacity: isWorst ? 1 : 0.85 }}
        />
      </div>
    </div>
  );
}

function StatRow({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className="font-semibold tabular-nums">{value}</span>
        {sub && <span className="ml-2 text-xs text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
}

export default function StoreFunnel() {
  const { store, storeId } = useDashboardStore();
  const [range, setRange] = useState<Range>("24h");

  const since = useMemo(() => {
    if (range === "24h") return subHours(new Date(), 24).toISOString();
    if (range === "7d") return subDays(new Date(), 7).toISOString();
    return subDays(new Date(), 30).toISOString();
  }, [range]);

  const currency = (store as any)?.currency || "INR";
  const sym = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency;

  // ---- Page views (sessions / visitors / landing / device / source) ----
  // is_bot filter is server-side so bots don't push real rows past the row
  // cap. `.or()` covers both `is_bot=false` and legacy null rows.
  // Batched fetch handles high-volume stores (a busy shop can do >20k pv/30d).
  const pvQ = useQuery({
    enabled: !!storeId,
    queryKey: ["funnel-pv", storeId, since],
    queryFn: async () => {
      const PAGE = 5000;
      const MAX_PAGES = 8; // hard ceiling = 40k rows so a runaway shop can't OOM the tab
      let all: any[] = [];
      let truncated = false;
      for (let i = 0; i < MAX_PAGES; i++) {
        const { data, error } = await supabase
          .from("page_views")
          .select("session_id,visitor_id,path,device,utm_source,utm_medium,utm_campaign,referrer,landing_path")
          .eq("store_id", storeId!)
          .or("is_bot.is.null,is_bot.eq.false")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .range(i * PAGE, i * PAGE + PAGE - 1);
        if (error) throw error;
        if (!data?.length) break;
        all = all.concat(data);
        if (data.length < PAGE) break;
        if (i === MAX_PAGES - 1) truncated = true;
      }
      return { rows: all, truncated };
    },
  });

  // ---- Storefront events (funnel steps) ----
  // Same batched pattern — event volume can rival page views on busy stores.
  const evQ = useQuery({
    enabled: !!storeId,
    queryKey: ["funnel-events", storeId, since],
    queryFn: async () => {
      const PAGE = 5000;
      const MAX_PAGES = 6;
      let all: any[] = [];
      for (let i = 0; i < MAX_PAGES; i++) {
        const { data, error } = await (supabase as any)
          .from("storefront_events")
          .select("event_name,session_id,product_id,value")
          .eq("store_id", storeId!)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .range(i * PAGE, i * PAGE + PAGE - 1);
        if (error) throw error;
        if (!data?.length) break;
        all = all.concat(data);
        if (data.length < PAGE) break;
      }
      return all as Array<{
        event_name: string; session_id: string | null;
        product_id: string | null; value: number | null;
      }>;
    },
  });


  // ---- Orders (created + status + payment method + repeat) ----
  const ordQ = useQuery({
    enabled: !!storeId,
    queryKey: ["funnel-orders", storeId, since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,status,payment_method,total,customer_phone,is_repeat_customer,customer_order_index,attribution,created_at")
        .eq("store_id", storeId!)
        .gte("created_at", since)
        .limit(5000);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // ---- Abandoned carts ----
  const abQ = useQuery({
    enabled: !!storeId,
    queryKey: ["funnel-abandoned", storeId, since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("abandoned_carts")
        .select("id,customer_phone,created_at")
        .eq("store_id", storeId!)
        .gte("created_at", since)
        .limit(2000);
      if (error) throw error;
      return data || [];
    },
  });

  const loading = pvQ.isLoading || evQ.isLoading || ordQ.isLoading;

  // --- Aggregations ---
  const sessions = useMemo(() => {
    const s = new Set<string>();
    pvQ.data?.rows.forEach((r: any) => r.session_id && s.add(r.session_id));
    return s.size;
  }, [pvQ.data]);

  const visitors = useMemo(() => {
    const s = new Set<string>();
    pvQ.data?.rows.forEach((r: any) => r.visitor_id && s.add(r.visitor_id));
    return s.size;
  }, [pvQ.data]);

  // PDP: prefer view_product event over path filter — React fires the event
  // reliably even when the pageview beacon loses the race on ad-click bounces.
  // Falls back to path filter only if event pipeline has zero rows for the
  // window (e.g. very old data before storefront_events was deployed).
  const pdpViewSessions = useMemo(() => {
    const eventSess = new Set<string>();
    evQ.data?.forEach((e) => {
      if (e.event_name === "view_product" && e.session_id) eventSess.add(e.session_id);
    });
    if (eventSess.size > 0) return eventSess.size;
    const pvSess = new Set<string>();
    pvQ.data?.rows.forEach((r: any) => {
      if (r.path?.startsWith("/product/") && r.session_id) pvSess.add(r.session_id);
    });
    return pvSess.size;
  }, [evQ.data, pvQ.data]);


  const evCounts = useMemo(() => {
    const c: Record<string, number> = {};
    const sess: Record<string, Set<string>> = {};
    evQ.data?.forEach((e) => {
      c[e.event_name] = (c[e.event_name] || 0) + 1;
      if (!sess[e.event_name]) sess[e.event_name] = new Set();
      if (e.session_id) sess[e.event_name].add(e.session_id);
    });
    return {
      count: c,
      sessCount: Object.fromEntries(
        Object.entries(sess).map(([k, v]) => [k, v.size])
      ) as Record<string, number>,
    };
  }, [evQ.data]);

  const orders = ordQ.data || [];
  const ordersPaid = orders.filter((o) => ["paid", "confirmed", "shipped", "delivered"].includes(o.status));
  const ordersCancelled = orders.filter((o) => o.status === "cancelled");
  const ordersPending = orders.filter((o) => o.status === "pending");
  const revenue = ordersPaid.reduce((s, o) => s + Number(o.total || 0), 0);

  // Funnel steps (session-based to compare apples-to-apples)
  const steps: FunnelStep[] = [
    { key: "sess", label: "Sessions (visitors)", value: sessions, icon: Users, color: "hsl(220, 90%, 55%)" },
    { key: "pdp", label: "Viewed product", value: pdpViewSessions, icon: Eye, color: "hsl(190, 90%, 45%)" },
    { key: "buy", label: "Clicked Buy Now", value: evCounts.sessCount.buy_now_click || 0, icon: MousePointerClick, color: "hsl(175, 80%, 42%)" },
    { key: "atc", label: "Added to cart", value: evCounts.sessCount.add_to_cart || 0, icon: ShoppingCart, color: "hsl(160, 70%, 40%)" },
    { key: "chk", label: "Began checkout", value: evCounts.sessCount.begin_checkout || 0, icon: MousePointerClick, color: "hsl(38, 92%, 50%)" },
    // pay_click undercounts on purpose — the insert races the payment-gateway
    // redirect and often loses. Shown for reference; excluded from leak-scoring.
    { key: "pay", label: "Clicked pay (tracking approximate)", value: evCounts.sessCount.pay_click || 0, icon: CreditCard, color: "hsl(280, 65%, 55%)" },
    { key: "ord", label: "Order created", value: orders.length, icon: Package, color: "hsl(340, 70%, 50%)" },
    { key: "paid", label: "Order PAID / confirmed", value: ordersPaid.length, icon: CheckCircle2, color: "hsl(142, 76%, 36%)" },
  ];


  // Find the biggest leak (steepest % drop between two non-zero steps).
  const worstIdx = useMemo(() => {
    let worst = -1;
    let worstDrop = 0;
    for (let i = 1; i < steps.length; i++) {
      // pay_click is instrumentation-lossy; treat chk→ord as the real edge.
      if (steps[i].key === "pay" || steps[i - 1].key === "pay") continue;
      const prev = steps[i - 1].value;
      const cur = steps[i].value;
      if (prev < 5) continue;
      const drop = 1 - cur / prev;
      const weight = 1 + i * 0.15;
      if (drop * weight > worstDrop) {
        worstDrop = drop * weight;
        worst = i;
      }
    }
    return worst;
  }, [steps]);


  const base = steps[0].value || 1;

  // Payment method success table
  const pmTable = useMemo(() => {
    const m = new Map<string, { total: number; paid: number; cancelled: number; pending: number }>();
    orders.forEach((o) => {
      const key = o.payment_method || "unknown";
      const row = m.get(key) || { total: 0, paid: 0, cancelled: 0, pending: 0 };
      row.total++;
      if (["paid", "confirmed", "shipped", "delivered"].includes(o.status)) row.paid++;
      else if (o.status === "cancelled") row.cancelled++;
      else if (o.status === "pending") row.pending++;
      m.set(key, row);
    });
    return Array.from(m.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [orders]);

  // Traffic sources — combine utm_source + referrer host
  const sourceTable = useMemo(() => {
    const m = new Map<string, number>();
    pvQ.data?.rows.forEach((r: any) => {
      let src = r.utm_source?.toLowerCase();
      if (!src && r.referrer) {
        try {
          src = new URL(r.referrer).hostname.replace(/^www\./, "");
        } catch { /* noop */ }
      }
      if (!src) src = "direct";
      // Normalize common ad platforms
      if (src.includes("facebook") || src.includes("fb") || r.utm_source === "fb") src = "meta (facebook/instagram)";
      else if (src.includes("instagram")) src = "meta (facebook/instagram)";
      else if (src.includes("google")) src = "google";
      m.set(src, (m.get(src) || 0) + 1);
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [pvQ.data]);

  // Landing pages
  const landingTable = useMemo(() => {
    const m = new Map<string, Set<string>>();
    pvQ.data?.rows.forEach((r: any) => {
      const p = r.landing_path || r.path;
      if (!p || !r.session_id) return;
      if (!m.has(p)) m.set(p, new Set());
      m.get(p)!.add(r.session_id);
    });
    return Array.from(m.entries())
      .map(([p, s]) => [p, s.size] as [string, number])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [pvQ.data]);

  // Device split
  const deviceTable = useMemo(() => {
    const m = new Map<string, Set<string>>();
    pvQ.data?.rows.forEach((r: any) => {
      const d = r.device || "unknown";
      if (!r.session_id) return;
      if (!m.has(d)) m.set(d, new Set());
      m.get(d)!.add(r.session_id);
    });
    return Array.from(m.entries())
      .map(([d, s]) => [d, s.size] as [string, number])
      .sort((a, b) => b[1] - a[1]);
  }, [pvQ.data]);

  // Top products by ATC (product_id → count)
  const topAtc = useMemo(() => {
    const m = new Map<string, number>();
    evQ.data?.forEach((e) => {
      if (e.event_name !== "add_to_cart" || !e.product_id) return;
      m.set(e.product_id, (m.get(e.product_id) || 0) + 1);
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [evQ.data]);

  // Resolve product names for the Top-ATC list (batched, only for the visible ids).
  const topAtcIds = topAtc.map(([id]) => id);
  const productNamesQ = useQuery({
    enabled: topAtcIds.length > 0,
    queryKey: ["funnel-product-names", storeId, topAtcIds],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name")
        .in("id", topAtcIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => { map[p.id] = p.name; });
      return map;
    },
  });


  // Repeat vs new (paid orders only — most meaningful)
  const repeatCount = ordersPaid.filter((o) => o.is_repeat_customer).length;
  const newCount = ordersPaid.length - repeatCount;

  // -- Diagnosis text (biggest leak → one plain sentence) --
  const diagnosis = useMemo(() => {
    if (worstIdx < 0 || sessions < 10) return null;
    const from = steps[worstIdx - 1];
    const to = steps[worstIdx];
    const drop = 100 - pct(to.value, from.value);
    // Payment-gateway signal wins over funnel math when cancels dominate.
    const cancelRate = orders.length ? ordersCancelled.length / orders.length : 0;
    if (orders.length >= 5 && cancelRate >= 0.5) {
      const worstPm = pmTable[0];
      return {
        title: "Payment gateway is killing your orders",
        body: `${ordersCancelled.length} of ${orders.length} orders got cancelled (${Math.round(cancelRate * 100)}%). Check ${worstPm?.[0] || "payment"} dashboard for failure reasons — likely UPI timeouts or bank declines. Enable COD as a backup.`,
      };
    }
    if (worstIdx === 1) {
      return {
        title: "People land but don't open products",
        body: `${drop.toFixed(0)}% of visitors leave without opening a product page. Landing page is not converting — check hero image, category thumbnails, and page speed.`,
      };
    }
    if (worstIdx === 2) {
      return {
        title: "Product pages don't convince buyers",
        body: `${drop.toFixed(0)}% who open a product don't add to cart. Improve product photos (add 3+ angles), add reviews, show delivery date, and highlight discount.`,
      };
    }
    if (worstIdx === 3) {
      return {
        title: "Cart-to-checkout drop-off",
        body: `${drop.toFixed(0)}% add to cart but don't start checkout. Shipping fee shock or forced signup is the usual cause. Show shipping estimate on the cart, allow guest checkout.`,
      };
    }
    if (worstIdx === 4 || worstIdx === 5) {
      return {
        title: "Checkout form is losing buyers",
        body: `${drop.toFixed(0)}% start checkout but never click pay. Long forms, pincode-not-serviceable, or coupon errors are typical. Auto-detect pincode, save address, minimize required fields.`,
      };
    }
    if (worstIdx === 6) {
      return {
        title: "Orders created but not paid",
        body: `${drop.toFixed(0)}% of orders never complete payment. Fix payment gateway reliability, add COD fallback, retry failed UPI with a different app.`,
      };
    }
    return null;
  }, [worstIdx, steps, orders, ordersCancelled, pmTable, sessions]);

  if (!storeId) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Loading store…</div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Sales Funnel</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Where visitors drop off between landing and paying — for {store?.name || "your store"}
          </p>
        </div>
        <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
          <TabsList className="h-8">
            <TabsTrigger value="24h" className="text-xs px-3">Last 24h</TabsTrigger>
            <TabsTrigger value="7d" className="text-xs px-3">7 days</TabsTrigger>
            <TabsTrigger value="30d" className="text-xs px-3">30 days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Diagnosis banner */}
      {diagnosis && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-sm text-destructive">{diagnosis.title}</div>
              <div className="text-xs text-muted-foreground mt-1">{diagnosis.body}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {pvQ.data?.truncated && (
        <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Very high traffic — showing latest 40,000 pageviews for this window. Percentages remain representative but exact totals may be higher.
        </div>
      )}


      {/* Headline metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-3">
          <p className="text-[11px] text-muted-foreground">Sessions</p>
          <p className="text-xl font-bold">{sessions.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{visitors} unique visitors</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[11px] text-muted-foreground">Paid orders</p>
          <p className="text-xl font-bold text-emerald-600">{ordersPaid.length}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {sessions ? `${pct(ordersPaid.length, sessions).toFixed(2)}% CVR` : "—"}
          </p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[11px] text-muted-foreground">Revenue</p>
          <p className="text-xl font-bold">{sym}{Math.round(revenue).toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            AOV {sym}{ordersPaid.length ? Math.round(revenue / ordersPaid.length).toLocaleString() : 0}
          </p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[11px] text-muted-foreground">Cancelled orders</p>
          <p className={`text-xl font-bold ${ordersCancelled.length ? "text-destructive" : ""}`}>
            {ordersCancelled.length}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {orders.length ? `${pct(ordersCancelled.length, orders.length).toFixed(0)}% fail` : "—"}
          </p>
        </CardContent></Card>
      </div>

      {/* Funnel bars */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingDown className="h-4 w-4" /> Conversion funnel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <div className="text-xs text-muted-foreground">Loading…</div>}
          {!loading && hasError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-center text-xs text-muted-foreground">
              Couldn&apos;t load funnel data.{" "}
              <button
                type="button"
                className="font-medium text-foreground underline underline-offset-2"
                onClick={() => { pvQ.refetch(); evQ.refetch(); ordQ.refetch(); }}
              >
                Retry
              </button>
            </div>
          )}
          {!loading && !hasError && sessions === 0 && (
            <div className="text-xs text-muted-foreground py-4 text-center">
              No traffic in this period yet.
            </div>
          )}
          {!loading && sessions > 0 && (
            <>
              <div className="flex items-center justify-end text-[10px] text-muted-foreground pr-1 gap-2">
                <span className="w-14 text-right">% of start</span>
                <span className="w-16 text-right">step drop</span>
              </div>
              {steps.map((s, i) => (
                <StepBar
                  key={s.key}
                  step={s}
                  base={base}
                  prev={i === 0 ? undefined : steps[i - 1].value}
                  isWorst={i === worstIdx}
                />
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* 2-col: Payment methods + Traffic sources */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Payment method success rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pmTable.length === 0 && <p className="text-xs text-muted-foreground">No orders yet.</p>}
            {pmTable.map(([pm, r]) => {
              const successRate = pct(r.paid, r.total);
              return (
                <div key={pm} className="py-2 border-b last:border-0">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium capitalize">{pm}</span>
                    <span className={`font-bold tabular-nums ${successRate < 50 ? "text-destructive" : successRate < 80 ? "text-amber-600" : "text-emerald-600"}`}>
                      {successRate.toFixed(0)}%
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {r.total} total · {r.paid} paid · {r.cancelled} cancelled · {r.pending} pending
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MousePointerClick className="h-4 w-4" /> Where visitors come from
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sourceTable.length === 0 && <p className="text-xs text-muted-foreground">No traffic yet.</p>}
            {sourceTable.map(([src, n]) => (
              <div key={src} className="flex justify-between py-1.5 text-sm border-b last:border-0">
                <span className="capitalize truncate">{src}</span>
                <span className="font-semibold tabular-nums">{n}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 3-col: Landing pages + Devices + Top ATC products */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Top landing pages
            </CardTitle>
          </CardHeader>
          <CardContent>
            {landingTable.map(([p, n]) => (
              <div key={p} className="flex justify-between py-1.5 text-xs border-b last:border-0 gap-2">
                <span className="truncate">{p}</span>
                <span className="font-semibold tabular-nums">{n}</span>
              </div>
            ))}
            {landingTable.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Smartphone className="h-4 w-4" /> Devices
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deviceTable.map(([d, n]) => (
              <div key={d} className="flex justify-between py-1.5 text-xs border-b last:border-0">
                <span className="capitalize">{d}</span>
                <span className="font-semibold tabular-nums">{n} sessions</span>
              </div>
            ))}
            {deviceTable.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" /> Most added-to-cart
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topAtc.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
            {topAtc.map(([pid, n]) => {
              const name = productNamesQ.data?.[pid];
              return (
                <div key={pid} className="flex justify-between py-1.5 text-xs border-b last:border-0 gap-2">
                  <span className="truncate">
                    {name || <span className="font-mono text-[10px] text-muted-foreground">{pid.slice(0, 8)}…</span>}
                  </span>
                  <span className="font-semibold tabular-nums whitespace-nowrap">{n} ATC</span>
                </div>
              );
            })}

          </CardContent>
        </Card>
      </div>

      {/* Repeat vs new + abandoned */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Repeat className="h-4 w-4" /> Buyer mix (paid orders)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatRow label="New buyers" value={newCount} />
            <StatRow label="Repeat buyers" value={repeatCount} />
            <StatRow
              label="Repeat rate"
              value={ordersPaid.length ? `${pct(repeatCount, ordersPaid.length).toFixed(0)}%` : "—"}
              sub={ordersPaid.length ? "of paid orders" : ""}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <IndianRupee className="h-4 w-4" /> Recovery opportunity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatRow label="Abandoned checkouts" value={abQ.data?.length || 0} />
            <StatRow label="Failed / cancelled orders" value={ordersCancelled.length} />
            <StatRow label="Pending payment" value={ordersPending.length} />
            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
              These customers gave phone numbers — WhatsApp them a UPI QR or COD offer to recover.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
