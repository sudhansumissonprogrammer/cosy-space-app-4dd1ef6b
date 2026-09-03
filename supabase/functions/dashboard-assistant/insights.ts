// Per-store business intelligence for the Store Assistant.
//
// This is what makes the assistant *this store's* assistant instead of a
// generic help bot: it reads the last 30 days of real activity, compares it
// with the previous 30 days, and turns that into plain findings + a ranked
// action list that the model can quote directly.
//
// Rules:
//  - Read-only. Aggregates only — no customer PII, no keys, no order details.
//  - Never produces commission-refund guidance (that is customer-care only).

export interface StoreInsights {
  window_days: number;
  orders: {
    total: number;
    paid: number;
    cancelled: number;
    pending: number;
    delivered: number;
    shipped: number;
    cancel_rate_pct: number;
    prev_period_paid: number;
    paid_change_pct: number | null;
  };
  revenue: {
    paid_revenue: number;
    avg_order_value: number;
    prev_paid_revenue: number;
    revenue_change_pct: number | null;
  };
  mix: {
    cod_orders: number;
    prepaid_orders: number;
    cod_share_pct: number;
    repeat_customer_orders: number;
    repeat_rate_pct: number;
  };
  catalog: {
    active_products: number;
    inactive_products: number;
    out_of_stock: number;
    missing_image: number;
    missing_description: number;
    no_sale_in_window: number;
    top_products: Array<{ name: string; units: number; revenue: number }>;
    dead_products: string[];
  };
  carts: {
    abandoned: number;
    recovered: number;
    recovery_rate_pct: number;
    checkout_conversion_pct: number | null;
  };
  coupons: { active: number; used_in_window: number };
  top_states: Array<{ state: string; orders: number }>;
  findings: string[];
  actions: string[];
}

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);
const change = (now: number, before: number) =>
  before > 0 ? Math.round(((now - before) / before) * 1000) / 10 : null;

const PAID = new Set(["paid", "confirmed", "processing", "shipped", "delivered", "partially_paid"]);

export async function buildStoreInsights(admin: any, storeId: string, days = 30): Promise<StoreInsights | null> {
  const now = Date.now();
  const start = new Date(now - days * 86400000).toISOString();
  const prevStart = new Date(now - 2 * days * 86400000).toISOString();

  const [ordersRes, prevRes, productsRes, cartsRes, couponsRes] = await Promise.all([
    admin
      .from("orders")
      .select("id, status, total, payment_method, payment_type, is_repeat_customer, state, created_at, applied_coupon_id")
      .eq("store_id", storeId)
      .gte("created_at", start)
      .limit(5000),
    admin
      .from("orders")
      .select("id, status, total")
      .eq("store_id", storeId)
      .gte("created_at", prevStart)
      .lt("created_at", start)
      .limit(5000),
    admin
      .from("products")
      .select("id, name, is_active, stock_quantity, image_url, description")
      .eq("store_id", storeId)
      .limit(3000),
    admin
      .from("abandoned_carts")
      .select("id, recovered")
      .eq("store_id", storeId)
      .gte("created_at", start)
      .limit(5000),
    admin.from("coupons").select("id, is_active").eq("store_id", storeId).limit(200),
  ]);

  const orders = ordersRes?.data ?? [];
  const prev = prevRes?.data ?? [];
  const products = productsRes?.data ?? [];
  const carts = cartsRes?.data ?? [];
  const coupons = couponsRes?.data ?? [];

  const paidOrders = orders.filter((o: any) => PAID.has(o.status));
  const prevPaid = prev.filter((o: any) => PAID.has(o.status));
  const cancelled = orders.filter((o: any) => o.status === "cancelled").length;
  const pending = orders.filter((o: any) => o.status === "pending").length;
  const delivered = orders.filter((o: any) => o.status === "delivered").length;
  const shipped = orders.filter((o: any) => o.status === "shipped").length;

  const revenue = paidOrders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);
  const prevRevenue = prevPaid.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);

  const cod = paidOrders.filter((o: any) => (o.payment_method || "").toLowerCase().includes("cod")).length;
  const repeat = paidOrders.filter((o: any) => o.is_repeat_customer).length;

  // Best sellers + dead stock from order_items of paid orders in the window.
  const topProducts: Array<{ name: string; units: number; revenue: number }> = [];
  const soldIds = new Set<string>();
  if (paidOrders.length) {
    const ids = paidOrders.map((o: any) => o.id).slice(0, 2000);
    const { data: items } = await admin
      .from("order_items")
      .select("product_id, product_name, quantity, total")
      .in("order_id", ids)
      .limit(20000);
    const agg = new Map<string, { name: string; units: number; revenue: number }>();
    for (const it of items ?? []) {
      if (it.product_id) soldIds.add(it.product_id);
      const key = it.product_id || it.product_name;
      const cur = agg.get(key) ?? { name: it.product_name, units: 0, revenue: 0 };
      cur.units += Number(it.quantity || 0);
      cur.revenue += Number(it.total || 0);
      agg.set(key, cur);
    }
    topProducts.push(...[...agg.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5));
  }

  const active = products.filter((p: any) => p.is_active);
  const dead = active.filter((p: any) => !soldIds.has(p.id));

  const stateTally = new Map<string, number>();
  for (const o of paidOrders) {
    const st = (o.state || "").trim();
    if (st) stateTally.set(st, (stateTally.get(st) || 0) + 1);
  }
  const topStates = [...stateTally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([state, n]) => ({ state, orders: n }));

  const recovered = carts.filter((c: any) => c.recovered).length;
  const couponOrders = orders.filter((o: any) => o.applied_coupon_id).length;

  const insights: StoreInsights = {
    window_days: days,
    orders: {
      total: orders.length,
      paid: paidOrders.length,
      cancelled,
      pending,
      delivered,
      shipped,
      cancel_rate_pct: pct(cancelled, orders.length),
      prev_period_paid: prevPaid.length,
      paid_change_pct: change(paidOrders.length, prevPaid.length),
    },
    revenue: {
      paid_revenue: Math.round(revenue),
      avg_order_value: paidOrders.length ? Math.round(revenue / paidOrders.length) : 0,
      prev_paid_revenue: Math.round(prevRevenue),
      revenue_change_pct: change(revenue, prevRevenue),
    },
    mix: {
      cod_orders: cod,
      prepaid_orders: paidOrders.length - cod,
      cod_share_pct: pct(cod, paidOrders.length),
      repeat_customer_orders: repeat,
      repeat_rate_pct: pct(repeat, paidOrders.length),
    },
    catalog: {
      active_products: active.length,
      inactive_products: products.length - active.length,
      out_of_stock: active.filter((p: any) => Number(p.stock_quantity) === 0).length,
      missing_image: active.filter((p: any) => !p.image_url).length,
      missing_description: active.filter((p: any) => !p.description || String(p.description).length < 40).length,
      no_sale_in_window: dead.length,
      top_products: topProducts,
      dead_products: dead.slice(0, 5).map((p: any) => p.name),
    },
    carts: {
      abandoned: carts.length,
      recovered,
      recovery_rate_pct: pct(recovered, carts.length),
      checkout_conversion_pct: carts.length + paidOrders.length > 0
        ? pct(paidOrders.length, carts.length + paidOrders.length)
        : null,
    },
    coupons: { active: coupons.filter((c: any) => c.is_active).length, used_in_window: couponOrders },
    top_states: topStates,
    findings: [],
    actions: [],
  };

  derive(insights);
  return insights;
}

/** Turn the numbers into plain findings and a ranked action list. */
function derive(i: StoreInsights) {
  const f = i.findings;
  const a = i.actions;

  if (i.orders.total === 0) {
    f.push("No orders at all in the last 30 days.");
    a.push("Share the store link on WhatsApp status and Instagram bio today — traffic is the blocker, not the store.");
  }

  if (i.catalog.active_products === 0) {
    f.push("No active products — the storefront has nothing to sell.");
    a.push("Add your first product (name, price, 1 clear photo).");
  } else if (i.catalog.active_products < 8) {
    f.push(`Only ${i.catalog.active_products} active products. Small catalogs convert poorly on ads.`);
    a.push("Add products until you have at least 10-15 live.");
  }

  if (i.catalog.missing_image > 0) {
    f.push(`${i.catalog.missing_image} live products have no photo.`);
    a.push("Add a photo to every live product — no-photo products almost never sell.");
  }
  if (i.catalog.missing_description > 0) {
    f.push(`${i.catalog.missing_description} products have a thin or missing description.`);
    a.push("Write 3-4 lines of description for the top-selling products first.");
  }
  if (i.catalog.out_of_stock > 0) {
    f.push(`${i.catalog.out_of_stock} live products are out of stock.`);
    a.push("Restock or hide out-of-stock products so ads don't send traffic to a dead page.");
  }
  if (i.catalog.no_sale_in_window >= 5 && i.orders.paid > 0) {
    f.push(`${i.catalog.no_sale_in_window} products sold nothing in 30 days.`);
    a.push("Push your best sellers to the top of the home page instead of showing dead products first.");
  }

  if (i.orders.cancel_rate_pct >= 30 && i.orders.total >= 10) {
    f.push(`Cancel rate is high: ${i.orders.cancel_rate_pct}% of orders cancelled.`);
    a.push("Most cancellations are abandoned online payments. Enable COD or partial COD so buyers can finish.");
  }
  if (i.orders.pending >= 5) {
    f.push(`${i.orders.pending} orders are still pending payment.`);
    a.push("Follow up pending orders on WhatsApp within an hour — most convert.");
  }

  if (i.mix.cod_share_pct >= 80 && i.orders.paid >= 10) {
    f.push(`${i.mix.cod_share_pct}% of paid orders are COD — RTO risk and locked-up cash.`);
    a.push("Offer a small prepaid discount to shift some COD buyers to online payment.");
  }

  if (i.carts.abandoned >= 10) {
    f.push(`${i.carts.abandoned} carts abandoned, ${i.carts.recovery_rate_pct}% recovered.`);
    if (i.carts.recovery_rate_pct < 10) {
      a.push("Turn on WhatsApp cart recovery with a small coupon — this is the cheapest sales you can get.");
    }
  }

  if (i.mix.repeat_rate_pct < 10 && i.orders.paid >= 20) {
    f.push(`Only ${i.mix.repeat_rate_pct}% of orders are repeat customers.`);
    a.push("Send a WhatsApp offer to past buyers — repeat buyers cost nothing to acquire.");
  }

  if (i.coupons.active === 0 && i.orders.paid >= 5) {
    f.push("No active coupon running.");
    a.push("Create one small welcome coupon to lift first-time conversion.");
  }

  if (i.revenue.revenue_change_pct !== null) {
    if (i.revenue.revenue_change_pct <= -20) {
      f.push(`Revenue is down ${Math.abs(i.revenue.revenue_change_pct)}% vs the previous 30 days.`);
    } else if (i.revenue.revenue_change_pct >= 20) {
      f.push(`Revenue is up ${i.revenue.revenue_change_pct}% vs the previous 30 days.`);
      a.push("Scale what is already working: put ad budget behind your top-selling product.");
    }
  }

  if (i.top_states.length) {
    f.push(`Top delivery states: ${i.top_states.map((s) => `${s.state} (${s.orders})`).join(", ")}.`);
  }
  if (i.catalog.top_products.length) {
    f.push(`Best sellers: ${i.catalog.top_products.map((p) => p.name).slice(0, 3).join(", ")}.`);
  }
}
