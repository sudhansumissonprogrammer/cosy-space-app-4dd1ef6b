// On-demand data queries the Store Assistant can run while answering.
//
// These are exposed to the model as tools, so it can behave like a co-founder
// who actually opens the analytics pages: funnel, daily trend, cancellations,
// month-on-month summary, traffic sources, product performance.
//
// Rules:
//  - Read-only, aggregates only. No customer names, phones, emails or addresses.
//  - Every result is a small JSON object the model can quote directly.
//  - Nothing here ever discusses commissions or refunds.

const PAID = new Set(["paid", "confirmed", "processing", "shipped", "delivered", "partially_paid"]);
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);
const inr = (n: number) => Math.round(n);
const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);
const monthKey = (iso: string) => new Date(iso).toISOString().slice(0, 7);
const clampDays = (d: unknown, def = 30, max = 180) =>
  Math.min(max, Math.max(1, Number(d) || def));

async function ordersIn(admin: any, storeId: string, sinceIso: string, cols: string) {
  const { data } = await admin
    .from("orders")
    .select(cols)
    .eq("store_id", storeId)
    .gte("created_at", sinceIso)
    .limit(10000);
  return (data ?? []) as any[];
}

/* ---------------------------- funnel ---------------------------- */

export async function queryFunnel(admin: any, storeId: string, daysIn: unknown) {
  const days = clampDays(daysIn);
  const since = new Date(Date.now() - days * 86400000);
  const sinceIso = since.toISOString();
  const sinceDate = sinceIso.slice(0, 10);

  const [rollupRes, todayRes, dailyRes, orders] = await Promise.all([
    admin
      .from("storefront_events_daily")
      .select("event_name, count, unique_sessions")
      .eq("store_id", storeId)
      .gte("date", sinceDate)
      .limit(5000),
    admin
      .from("storefront_events")
      .select("event_name")
      .eq("store_id", storeId)
      .gte("created_at", new Date().toISOString().slice(0, 10))
      .limit(20000),
    admin
      .from("page_views_daily")
      .select("date, sessions, visitors, pageviews, bounce_sessions")
      .eq("store_id", storeId)
      .gte("date", sinceDate)
      .limit(400),
    ordersIn(admin, storeId, sinceIso, "id, status"),
  ]);

  const events = new Map<string, number>();
  for (const r of rollupRes?.data ?? []) {
    events.set(r.event_name, (events.get(r.event_name) || 0) + Number(r.count || 0));
  }
  for (const r of todayRes?.data ?? []) {
    events.set(r.event_name, (events.get(r.event_name) || 0) + 1);
  }

  const daily = dailyRes?.data ?? [];
  const sessions = daily.reduce((s: number, d: any) => s + Number(d.sessions || 0), 0);
  const visitors = daily.reduce((s: number, d: any) => s + Number(d.visitors || 0), 0);
  const bounce = daily.reduce((s: number, d: any) => s + Number(d.bounce_sessions || 0), 0);

  const pick = (...names: string[]) => names.reduce((s, n) => s + (events.get(n) || 0), 0);
  const productViews = pick("view_item", "product_view", "ViewContent");
  const addToCart = pick("add_to_cart", "AddToCart");
  const checkouts = pick("begin_checkout", "InitiateCheckout", "checkout_start");
  const paid = orders.filter((o) => PAID.has(o.status)).length;

  const steps = [
    { step: "sessions", count: sessions },
    { step: "product_views", count: productViews },
    { step: "add_to_cart", count: addToCart },
    { step: "checkout_started", count: checkouts },
    { step: "orders_placed", count: orders.length },
    { step: "orders_paid", count: paid },
  ];

  // Biggest leak = largest percentage drop between two consecutive non-zero steps.
  let worst: { from: string; to: string; drop_pct: number } | null = null;
  for (let i = 0; i < steps.length - 1; i++) {
    const a = steps[i].count;
    const b = steps[i + 1].count;
    if (a <= 0) continue;
    const drop = Math.round(((a - b) / a) * 1000) / 10;
    if (drop > 0 && (!worst || drop > worst.drop_pct)) {
      worst = { from: steps[i].step, to: steps[i + 1].step, drop_pct: drop };
    }
  }

  return {
    window_days: days,
    sessions,
    visitors,
    bounce_rate_pct: pct(bounce, sessions),
    steps,
    session_to_order_conversion_pct: pct(paid, sessions),
    cart_to_order_conversion_pct: pct(paid, addToCart),
    biggest_drop_off: worst,
    note: sessions === 0 ? "No traffic recorded in this window — the blocker is visitors, not the funnel." : null,
  };
}

/* -------------------------- daily trend ------------------------- */

export async function queryDailyTrend(admin: any, storeId: string, daysIn: unknown) {
  const days = clampDays(daysIn, 14, 90);
  const sinceIso = new Date(Date.now() - days * 86400000).toISOString();

  const [dailyRes, orders] = await Promise.all([
    admin
      .from("page_views_daily")
      .select("date, sessions, visitors")
      .eq("store_id", storeId)
      .gte("date", sinceIso.slice(0, 10))
      .order("date", { ascending: true })
      .limit(200),
    ordersIn(admin, storeId, sinceIso, "id, status, total, created_at"),
  ]);

  const map = new Map<string, { date: string; sessions: number; orders: number; paid: number; revenue: number }>();
  for (const d of dailyRes?.data ?? []) {
    map.set(d.date, { date: d.date, sessions: Number(d.sessions || 0), orders: 0, paid: 0, revenue: 0 });
  }
  for (const o of orders) {
    const k = dayKey(o.created_at);
    const row = map.get(k) ?? { date: k, sessions: 0, orders: 0, paid: 0, revenue: 0 };
    row.orders += 1;
    if (PAID.has(o.status)) {
      row.paid += 1;
      row.revenue += Number(o.total || 0);
    }
    map.set(k, row);
  }

  const rows = [...map.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({ ...r, revenue: inr(r.revenue), conversion_pct: pct(r.paid, r.sessions) }));

  const half = Math.floor(rows.length / 2);
  const sum = (arr: typeof rows, k: "sessions" | "paid" | "revenue") =>
    arr.reduce((s, r) => s + Number(r[k] || 0), 0);
  const recent = rows.slice(half);
  const older = rows.slice(0, half);

  const recentConv = pct(sum(recent, "paid"), sum(recent, "sessions"));
  const olderConv = pct(sum(older, "paid"), sum(older, "sessions"));

  // Why conversion moved: traffic change vs order change.
  const reason =
    olderConv === 0 && recentConv === 0
      ? "No measurable conversion in either half."
      : recentConv < olderConv
        ? sum(recent, "sessions") > sum(older, "sessions")
          ? "Traffic went up but orders did not follow — the new traffic is colder or lands on a weak page."
          : "Both traffic and orders fell — this is a traffic problem first."
        : "Conversion improved in the recent half.";

  return {
    window_days: days,
    days: rows,
    recent_half: { sessions: sum(recent, "sessions"), paid_orders: sum(recent, "paid"), revenue: inr(sum(recent, "revenue")), conversion_pct: recentConv },
    previous_half: { sessions: sum(older, "sessions"), paid_orders: sum(older, "paid"), revenue: inr(sum(older, "revenue")), conversion_pct: olderConv },
    conversion_change_pts: Math.round((recentConv - olderConv) * 10) / 10,
    likely_reason: reason,
  };
}

/* ------------------------ cancellations ------------------------- */

export async function queryCancellations(admin: any, storeId: string, daysIn: unknown) {
  const days = clampDays(daysIn);
  const sinceIso = new Date(Date.now() - days * 86400000).toISOString();
  const orders = await ordersIn(
    admin,
    storeId,
    sinceIso,
    "id, status, total, payment_method, payment_type, payment_verified, advance_paid, tracking_number, cod_confirm_status, created_at, updated_at",
  );

  const cancelled = orders.filter((o) => o.status === "cancelled");
  const tally = (fn: (o: any) => string) => {
    const m = new Map<string, number>();
    for (const o of cancelled) {
      const k = fn(o) || "unknown";
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, count }));
  };

  const minutesToCancel = cancelled
    .map((o) => (new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()) / 60000)
    .filter((n) => n >= 0 && n < 60 * 24 * 30);
  const median = minutesToCancel.length
    ? Math.round(minutesToCancel.sort((a, b) => a - b)[Math.floor(minutesToCancel.length / 2)])
    : null;

  const unpaidOnline = cancelled.filter((o) => !o.payment_verified && (o.payment_method || "").toLowerCase() !== "cod").length;
  const afterShipping = cancelled.filter((o) => !!o.tracking_number).length;
  const partialCod = cancelled.filter((o) => o.payment_type === "partial" || Number(o.advance_paid) > 0).length;

  const share = pct(unpaidOnline, cancelled.length);
  const diagnosis = cancelled.length === 0
    ? "No cancellations in this window."
    : share >= 60
      ? "Most cancellations are online payments that were never completed — buyers dropped at the payment step, the store is not broken."
      : afterShipping >= cancelled.length * 0.3
        ? "A large share was cancelled after a tracking number existed — these are post-dispatch cancellations or returns."
        : "Cancellations are spread across payment types — check the COD confirmation flow and follow-up speed.";

  return {
    window_days: days,
    total_orders: orders.length,
    cancelled: cancelled.length,
    cancel_rate_pct: pct(cancelled.length, orders.length),
    value_lost: inr(cancelled.reduce((s, o) => s + Number(o.total || 0), 0)),
    by_payment_method: tally((o) => (o.payment_method || "").toLowerCase()),
    by_payment_type: tally((o) => o.payment_type || "full"),
    unpaid_online_attempts: unpaidOnline,
    unpaid_online_share_pct: share,
    partial_cod_advance_attempts: partialCod,
    cancelled_after_tracking_added: afterShipping,
    median_minutes_from_order_to_cancel: median,
    diagnosis,
  };
}

/* ----------------------- monthly summary ------------------------ */

export async function queryMonthlySummary(admin: any, storeId: string, monthsIn: unknown) {
  const months = Math.min(12, Math.max(1, Number(monthsIn) || 6));
  const sinceIso = new Date(Date.now() - months * 31 * 86400000).toISOString();
  const orders = await ordersIn(
    admin,
    storeId,
    sinceIso,
    "id, status, total, created_at, is_repeat_customer, payment_method",
  );

  const m = new Map<string, any>();
  for (const o of orders) {
    const k = monthKey(o.created_at);
    const row = m.get(k) ?? { month: k, orders: 0, paid: 0, cancelled: 0, revenue: 0, cod: 0, repeat: 0 };
    row.orders += 1;
    if (o.status === "cancelled") row.cancelled += 1;
    if (PAID.has(o.status)) {
      row.paid += 1;
      row.revenue += Number(o.total || 0);
      if ((o.payment_method || "").toLowerCase().includes("cod")) row.cod += 1;
      if (o.is_repeat_customer) row.repeat += 1;
    }
    m.set(k, row);
  }

  const rows = [...m.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-months)
    .map((r) => ({
      month: r.month,
      orders: r.orders,
      paid_orders: r.paid,
      cancelled: r.cancelled,
      cancel_rate_pct: pct(r.cancelled, r.orders),
      revenue: inr(r.revenue),
      avg_order_value: r.paid ? inr(r.revenue / r.paid) : 0,
      cod_share_pct: pct(r.cod, r.paid),
      repeat_rate_pct: pct(r.repeat, r.paid),
    }));

  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  const best = rows.slice().sort((a, b) => b.revenue - a.revenue)[0];

  return {
    months: rows,
    current_month: last ?? null,
    previous_month: prev ?? null,
    revenue_change_pct: last && prev && prev.revenue > 0
      ? Math.round(((last.revenue - prev.revenue) / prev.revenue) * 1000) / 10
      : null,
    best_month: best ?? null,
  };
}

/* ----------------------- traffic sources ------------------------ */

export async function queryTrafficSources(admin: any, storeId: string, daysIn: unknown) {
  const days = clampDays(daysIn, 30, 90);
  const sinceIso = new Date(Date.now() - days * 86400000).toISOString();

  const [pvRes, orders] = await Promise.all([
    admin
      .from("page_views")
      .select("utm_source, utm_medium, referrer, device, session_id")
      .eq("store_id", storeId)
      .eq("is_bot", false)
      .gte("created_at", sinceIso)
      .limit(20000),
    ordersIn(admin, storeId, sinceIso, "id, status, total, source_platform"),
  ]);

  const rows = pvRes?.data ?? [];
  const bucket = (r: any) => {
    const s = (r.utm_source || "").toLowerCase();
    if (s) return s;
    const ref = (r.referrer || "").toLowerCase();
    if (!ref) return "direct";
    if (ref.includes("facebook") || ref.includes("fb.")) return "facebook";
    if (ref.includes("instagram")) return "instagram";
    if (ref.includes("google")) return "google";
    if (ref.includes("whatsapp") || ref.includes("wa.me")) return "whatsapp";
    return "other";
  };

  const sess = new Map<string, Set<string>>();
  const dev = new Map<string, number>();
  for (const r of rows) {
    const k = bucket(r);
    if (!sess.has(k)) sess.set(k, new Set());
    sess.get(k)!.add(r.session_id || Math.random().toString());
    const d = (r.device || "unknown").toLowerCase();
    dev.set(d, (dev.get(d) || 0) + 1);
  }

  const paid = orders.filter((o) => PAID.has(o.status));
  const orderSrc = new Map<string, { orders: number; revenue: number }>();
  for (const o of paid) {
    const k = (o.source_platform || "direct").toLowerCase();
    const cur = orderSrc.get(k) ?? { orders: 0, revenue: 0 };
    cur.orders += 1;
    cur.revenue += Number(o.total || 0);
    orderSrc.set(k, cur);
  }

  return {
    window_days: days,
    sampled_pageviews: rows.length,
    sessions_by_source: [...sess.entries()]
      .map(([source, set]) => ({ source, sessions: set.size }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 8),
    devices: [...dev.entries()].map(([device, views]) => ({ device, views })).sort((a, b) => b.views - a.views),
    paid_orders_by_source: [...orderSrc.entries()]
      .map(([source, v]) => ({ source, orders: v.orders, revenue: inr(v.revenue) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8),
  };
}

/* --------------------- product performance ---------------------- */

export async function queryProductPerformance(admin: any, storeId: string, daysIn: unknown) {
  const days = clampDays(daysIn);
  const sinceIso = new Date(Date.now() - days * 86400000).toISOString();

  const [orders, productsRes] = await Promise.all([
    ordersIn(admin, storeId, sinceIso, "id, status"),
    admin
      .from("products")
      .select("id, name, is_active, stock_quantity, price, sale_price")
      .eq("store_id", storeId)
      .eq("is_active", true)
      .limit(3000),
  ]);

  const paidIds = orders.filter((o) => PAID.has(o.status)).map((o) => o.id).slice(0, 3000);
  const agg = new Map<string, { name: string; units: number; revenue: number }>();
  if (paidIds.length) {
    const { data: items } = await admin
      .from("order_items")
      .select("product_id, product_name, quantity, total")
      .in("order_id", paidIds)
      .limit(30000);
    for (const it of items ?? []) {
      const key = it.product_id || it.product_name;
      const cur = agg.get(key) ?? { name: it.product_name, units: 0, revenue: 0 };
      cur.units += Number(it.quantity || 0);
      cur.revenue += Number(it.total || 0);
      agg.set(key, cur);
    }
  }

  const products = productsRes?.data ?? [];
  const sold = new Set([...agg.keys()]);
  const totalRevenue = [...agg.values()].reduce((s, p) => s + p.revenue, 0);
  const top = [...agg.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10)
    .map((p) => ({ name: p.name, units: p.units, revenue: inr(p.revenue), share_of_revenue_pct: pct(p.revenue, totalRevenue) }));

  return {
    window_days: days,
    active_products: products.length,
    products_with_sales: agg.size,
    products_with_zero_sales: products.filter((p: any) => !sold.has(p.id)).length,
    top_products: top,
    zero_sale_products: products.filter((p: any) => !sold.has(p.id)).slice(0, 10).map((p: any) => p.name),
    out_of_stock_but_active: products.filter((p: any) => Number(p.stock_quantity) === 0).slice(0, 10).map((p: any) => p.name),
    revenue_concentration_top3_pct: pct(top.slice(0, 3).reduce((s, p) => s + p.revenue, 0), totalRevenue),
  };
}

/* ------------------------- tool registry ------------------------ */

export const ANALYTICS_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_funnel",
      description:
        "Traffic-to-order funnel for this store: sessions, product views, add to cart, checkout started, orders placed, orders paid, bounce rate, conversion rate and the biggest drop-off step. Use for conversion questions, 'why no orders', 'traffic aa raha hai order nahi'.",
      parameters: {
        type: "object",
        properties: { days: { type: "number", description: "Look-back window in days, 1-180. Default 30." } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_daily_trend",
      description:
        "Day-by-day sessions, orders, paid orders, revenue and conversion rate, plus recent half vs previous half comparison and the likely reason conversion moved. Use for 'conversion rate why dropped', 'sale kam kyun ho gayi', 'today vs last week'.",
      parameters: {
        type: "object",
        properties: { days: { type: "number", description: "Days to trend, 1-90. Default 14." } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_cancellations",
      description:
        "Cancellation diagnosis: cancel rate, value lost, split by payment method and payment type, how many were unfinished online payments, how many were partial-COD advance attempts, how many were cancelled after a tracking number existed, median time to cancel, and a plain diagnosis. Use for 'why so many cancelled orders'.",
      parameters: {
        type: "object",
        properties: { days: { type: "number", description: "Look-back window in days, 1-180. Default 30." } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_monthly_summary",
      description:
        "Month-by-month summary: orders, paid orders, cancellations, cancel rate, revenue, average order value, COD share and repeat rate, plus current vs previous month change and the best month. Use for monthly summary, growth over time, 'is mahine kaisa raha'.",
      parameters: {
        type: "object",
        properties: { months: { type: "number", description: "Number of months, 1-12. Default 6." } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_traffic_sources",
      description:
        "Where visitors and paid orders come from: sessions by source (facebook, instagram, google, whatsapp, direct), device split, and paid orders plus revenue by source. Use for 'which channel is working', ad performance questions.",
      parameters: {
        type: "object",
        properties: { days: { type: "number", description: "Look-back window in days, 1-90. Default 30." } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_product_performance",
      description:
        "Product-level performance: top sellers with revenue share, how many products sold nothing, zero-sale product names, active products that are out of stock, and revenue concentration in the top 3 products. Use for 'which product should I push', catalog decisions.",
      parameters: {
        type: "object",
        properties: { days: { type: "number", description: "Look-back window in days, 1-180. Default 30." } },
        required: [],
      },
    },
  },
] as const;

export async function runAnalyticsTool(
  admin: any,
  storeId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "get_funnel":
      return await queryFunnel(admin, storeId, args?.days);
    case "get_daily_trend":
      return await queryDailyTrend(admin, storeId, args?.days);
    case "get_cancellations":
      return await queryCancellations(admin, storeId, args?.days);
    case "get_monthly_summary":
      return await queryMonthlySummary(admin, storeId, args?.months);
    case "get_traffic_sources":
      return await queryTrafficSources(admin, storeId, args?.days);
    case "get_product_performance":
      return await queryProductPerformance(admin, storeId, args?.days);
    default:
      return { error: `unknown tool ${name}` };
  }
}
