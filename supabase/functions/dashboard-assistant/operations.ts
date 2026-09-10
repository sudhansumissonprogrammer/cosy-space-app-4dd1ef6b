/**
 * Operational lookup tools for the Store Assistant.
 *
 * The analytics tools answer "how is my store doing".  These answer the far
 * more common day-to-day merchant questions: "where is order 8120", "kitne
 * order aaye aaj", "wallet me kitna balance hai", "which products are out of
 * stock", "this customer says he paid — did he?".
 *
 * Everything here is scoped to a single store_id that the caller already
 * proved ownership of, so the merchant's own customer details are allowed.
 * Never return payment keys, tokens or platform-internal ids.
 */

const clampDays = (v: unknown, def: number, max: number) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(Math.round(n), max);
};

const inr = (n: number) => Math.round(Number(n) || 0);

const sinceIso = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : null);

/* ------------------------------ orders ------------------------------ */

async function findOrder(admin: any, storeId: string, args: any) {
  const raw = String(args?.query ?? "").trim();
  if (!raw) return { error: "No order number, phone or customer name given." };

  const digits = raw.replace(/\D/g, "");
  const select =
    "id, order_number, status, total, created_at, updated_at, customer_name, customer_phone, city, state, pincode, payment_method, payment_type, payment_verified, advance_paid, balance_due, tracking_number, tracking_url, coupon_discount, cod_confirm_status, is_repeat_customer, notes";

  let row: any = null;

  if (digits) {
    const { data } = await admin
      .from("orders").select(select)
      .eq("store_id", storeId).eq("order_number", Number(digits))
      .maybeSingle();
    row = data ?? null;
  }

  if (!row && digits.length >= 6) {
    const { data } = await admin
      .from("orders").select(select)
      .eq("store_id", storeId).ilike("customer_phone", `%${digits.slice(-10)}%`)
      .order("created_at", { ascending: false }).limit(5);
    if (data?.length === 1) row = data[0];
    else if (data?.length) {
      return {
        matches: data.map((o: any) => ({
          order_number: o.order_number, status: o.status,
          total: inr(o.total), placed_on: day(o.created_at),
        })),
        note: "Several orders for this phone. Ask which order number.",
      };
    }
  }

  if (!row) {
    const { data } = await admin
      .from("orders").select(select)
      .eq("store_id", storeId).ilike("customer_name", `%${raw}%`)
      .order("created_at", { ascending: false }).limit(5);
    if (data?.length === 1) row = data[0];
    else if (data?.length) {
      return {
        matches: data.map((o: any) => ({
          order_number: o.order_number, customer: o.customer_name,
          status: o.status, total: inr(o.total), placed_on: day(o.created_at),
        })),
        note: "Several matches. Ask which order number.",
      };
    }
  }

  if (!row) return { found: false, note: "No order matches that in this store." };

  const { data: items } = await admin
    .from("order_items").select("product_name, quantity, unit_price, total")
    .eq("order_id", row.id).limit(30);

  return {
    found: true,
    order_number: row.order_number,
    status: row.status,
    placed_on: day(row.created_at),
    last_updated: day(row.updated_at),
    total: inr(row.total),
    coupon_discount: inr(row.coupon_discount),
    payment_method: row.payment_method,
    payment_type: row.payment_type,
    payment_verified: !!row.payment_verified,
    advance_paid: inr(row.advance_paid),
    balance_due: inr(row.balance_due),
    cod_confirmation: row.cod_confirm_status ?? null,
    customer: row.customer_name,
    phone: row.customer_phone,
    ships_to: [row.city, row.state, row.pincode].filter(Boolean).join(", "),
    repeat_customer: !!row.is_repeat_customer,
    tracking_number: row.tracking_number ?? null,
    has_tracking_link: !!row.tracking_url,
    items: (items ?? []).map((i: any) => ({
      product: i.product_name, qty: i.quantity, price: inr(i.unit_price),
    })),
    note_on_order: row.notes ? String(row.notes).slice(0, 300) : null,
  };
}

async function listOrders(admin: any, storeId: string, args: any) {
  const days = clampDays(args?.days, 7, 90);
  const status = args?.status ? String(args.status).toLowerCase() : null;

  let q = admin
    .from("orders")
    .select("order_number, status, total, created_at, payment_method, customer_name, city, tracking_number")
    .eq("store_id", storeId)
    .gte("created_at", sinceIso(days))
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) q = q.eq("status", status);

  const { data } = await q;
  const rows = data ?? [];

  const byStatus: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  let revenue = 0;
  for (const o of rows) {
    byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
    const d = day(o.created_at)!;
    byDay[d] = (byDay[d] ?? 0) + 1;
    if (["paid", "confirmed", "shipped", "delivered", "partially_paid"].includes(o.status)) {
      revenue += Number(o.total) || 0;
    }
  }

  const pendingShipment = rows.filter(
    (o: any) => !o.tracking_number && ["paid", "confirmed", "partially_paid"].includes(o.status),
  );

  return {
    window_days: days,
    total_orders: rows.length,
    revenue_from_these: inr(revenue),
    by_status: byStatus,
    orders_per_day: byDay,
    awaiting_dispatch: pendingShipment.length,
    latest: rows.slice(0, 10).map((o: any) => ({
      order_number: o.order_number, customer: o.customer_name, city: o.city,
      status: o.status, total: inr(o.total), payment: o.payment_method,
      placed_on: day(o.created_at),
    })),
  };
}

/* ------------------------------ wallet ------------------------------ */

async function walletStatus(admin: any, storeId: string) {
  const [{ data: w }, { data: ledger }, { data: recharges }] = await Promise.all([
    admin.from("store_wallets").select("balance, total_recharged, total_charged").eq("store_id", storeId).maybeSingle(),
    admin.from("store_wallet_ledger").select("direction, amount, kind, order_id, balance_after, created_at")
      .eq("store_id", storeId).order("created_at", { ascending: false }).limit(10),
    admin.from("store_wallet_recharges").select("amount, status, paid_at, created_at")
      .eq("store_id", storeId).order("created_at", { ascending: false }).limit(5),
  ]);

  const balance = inr(w?.balance ?? 0);
  return {
    balance,
    low_balance: balance < 200,
    can_take_orders: balance > 0,
    total_recharged: inr(w?.total_recharged ?? 0),
    total_commission_charged: inr(w?.total_charged ?? 0),
    last_entries: (ledger ?? []).map((l: any) => ({
      on: day(l.created_at), type: l.kind, direction: l.direction,
      amount: inr(l.amount), balance_after: inr(l.balance_after),
    })),
    last_recharges: (recharges ?? []).map((r: any) => ({
      amount: inr(r.amount), status: r.status, on: day(r.paid_at ?? r.created_at),
    })),
  };
}

/* ---------------------------- catalogue ----------------------------- */

async function searchProducts(admin: any, storeId: string, args: any) {
  const term = String(args?.query ?? "").trim();
  let q = admin
    .from("products")
    .select("name, price, sale_price, stock_quantity, is_active, sku, category, supplier_out_of_stock, image_url, slug")
    .eq("store_id", storeId).limit(15);
  if (term) q = q.ilike("name", `%${term}%`);
  const { data } = await q;
  if (!data?.length) return { found: 0, note: term ? "No product matches that name." : "No products yet." };
  return {
    found: data.length,
    products: data.map((p: any) => ({
      name: p.name, price: inr(p.price), sale_price: p.sale_price ? inr(p.sale_price) : null,
      stock: Number(p.stock_quantity) || 0, live: !!p.is_active, sku: p.sku ?? null,
      category: p.category ?? null, has_image: !!p.image_url,
      supplier_out_of_stock: !!p.supplier_out_of_stock,
    })),
  };
}

async function inventoryAlerts(admin: any, storeId: string) {
  const { data } = await admin
    .from("products")
    .select("name, stock_quantity, is_active, image_url, description, price, supplier_out_of_stock")
    .eq("store_id", storeId).limit(500);
  const rows = data ?? [];
  const pick = (f: (p: any) => boolean) => rows.filter(f).slice(0, 10).map((p: any) => p.name);
  return {
    total_products: rows.length,
    live_products: rows.filter((p: any) => p.is_active).length,
    out_of_stock_but_live: pick((p) => p.is_active && Number(p.stock_quantity) === 0),
    low_stock_under_5: pick((p) => p.is_active && Number(p.stock_quantity) > 0 && Number(p.stock_quantity) < 5),
    supplier_out_of_stock: pick((p) => p.supplier_out_of_stock),
    missing_image: pick((p) => !p.image_url),
    missing_description: pick((p) => !p.description || String(p.description).trim().length < 20),
    hidden_products: pick((p) => !p.is_active),
  };
}

/* -------------------------- carts & coupons ------------------------- */

async function abandonedCarts(admin: any, storeId: string, args: any) {
  const days = clampDays(args?.days, 7, 90);
  const { data } = await admin
    .from("abandoned_carts")
    .select("recovered, recovery_status, created_at, customer_phone, cart_items")
    .eq("store_id", storeId).gte("created_at", sinceIso(days)).limit(500);
  const rows = data ?? [];
  const value = rows.reduce((s: number, r: any) => {
    const items = Array.isArray(r.cart_items) ? r.cart_items : [];
    return s + items.reduce((t: number, i: any) => t + (Number(i?.price) || 0) * (Number(i?.quantity) || 1), 0);
  }, 0);
  const sent = rows.filter((r: any) => r.recovery_status && r.recovery_status !== "pending").length;
  const recovered = rows.filter((r: any) => r.recovered).length;
  return {
    window_days: days,
    abandoned_carts: rows.length,
    value_left_behind: inr(value),
    recovery_messages_sent: sent,
    recovered_orders: recovered,
    recovery_rate_pct: rows.length ? Math.round((recovered / rows.length) * 100) : 0,
    with_phone_number: rows.filter((r: any) => r.customer_phone).length,
  };
}

async function couponUsage(admin: any, storeId: string) {
  const { data } = await admin
    .from("coupons")
    .select("code, discount_type, discount_value, min_order_amount, used_count, max_uses, is_active, auto_apply, expires_at")
    .eq("store_id", storeId).order("used_count", { ascending: false }).limit(20);
  const rows = data ?? [];
  return {
    coupons: rows.length,
    active: rows.filter((c: any) => c.is_active).length,
    list: rows.map((c: any) => ({
      code: c.code, off: c.discount_type === "percentage" ? `${inr(c.discount_value)}%` : `Rs ${inr(c.discount_value)}`,
      min_order: inr(c.min_order_amount), used: c.used_count ?? 0, limit: c.max_uses ?? null,
      active: !!c.is_active, auto_apply: !!c.auto_apply,
      expired: c.expires_at ? new Date(c.expires_at) < new Date() : false,
    })),
  };
}

/* ---------------------------- customers ----------------------------- */

async function customerSummary(admin: any, storeId: string, args: any) {
  const digits = String(args?.phone ?? "").replace(/\D/g, "").slice(-10);
  if (digits.length < 10) return { error: "Give the customer's 10-digit phone number." };
  const { data } = await admin
    .from("orders")
    .select("order_number, status, total, created_at, payment_method, city")
    .eq("store_id", storeId).ilike("customer_phone", `%${digits}%`)
    .order("created_at", { ascending: false }).limit(30);
  const rows = data ?? [];
  if (!rows.length) return { found: false, note: "No orders from this number in this store." };
  const paid = rows.filter((o: any) => ["paid", "confirmed", "shipped", "delivered", "partially_paid"].includes(o.status));
  return {
    found: true,
    total_orders: rows.length,
    successful_orders: paid.length,
    cancelled_orders: rows.filter((o: any) => o.status === "cancelled").length,
    lifetime_value: inr(paid.reduce((s: number, o: any) => s + (Number(o.total) || 0), 0)),
    city: rows[0].city ?? null,
    orders: rows.slice(0, 8).map((o: any) => ({
      order_number: o.order_number, status: o.status, total: inr(o.total),
      payment: o.payment_method, placed_on: day(o.created_at),
    })),
  };
}

/* ------------------------- tool registry ---------------------------- */

export const OPERATIONS_TOOLS = [
  {
    type: "function",
    function: {
      name: "find_order",
      description:
        "Look up one specific order in this store by order number, customer phone number, or customer name. Returns status, items, amount, payment method and type, whether payment is verified, COD confirmation, address city/state, tracking number and repeat-customer flag. Use for any question about a particular order: 'order 8120 kya hua', 'customer says he paid', 'where is this order', 'was this order shipped', 'is this COD or prepaid'.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Order number, phone number, or customer name." } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_orders",
      description:
        "Recent orders in this store with counts by status, orders per day, revenue, how many are still waiting for dispatch, and the latest 10 orders. Use for 'how many orders today', 'aaj kitne order aaye', 'orders this week', 'which orders are pending', 'kitne dispatch karne hain'.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Look-back window in days, 1-90. Default 7. Use 1 for today." },
          status: { type: "string", description: "Optional filter: pending, paid, confirmed, shipped, delivered, cancelled." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_wallet_status",
      description:
        "This store's wallet: current balance, whether it is low or empty (which blocks new orders), total recharged, total commission charged, last 10 ledger entries and last recharges. Use for 'wallet balance', 'commission kitna kata', 'recharge kyu chahiye', 'orders blocked'.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "search_products",
      description:
        "Find products in this store by name (or list some when no name is given) with price, sale price, stock, live/hidden status, SKU, category and whether the supplier is out of stock. Use for 'is this product live', 'stock kitna hai', 'price of X', 'why is this product not showing'.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Part of the product name. Leave empty to list products." } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_inventory_alerts",
      description:
        "Catalogue problems in this store: live products with zero stock, low stock under 5, supplier out of stock, products missing an image or description, and hidden products. Use for 'what is wrong with my catalogue', 'stock check', 'which products need fixing'.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_abandoned_carts",
      description:
        "Abandoned carts for this store: how many, the value left behind, how many recovery messages went out, how many were recovered and the recovery rate. Use for 'log cart chhod ke ja rahe hain', 'abandoned cart recovery working?', 'how much money am I losing at checkout'.",
      parameters: {
        type: "object",
        properties: { days: { type: "number", description: "Look-back window in days, 1-90. Default 7." } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_coupon_usage",
      description:
        "All coupons in this store with discount, minimum order, times used, usage limit, auto-apply and whether they are active or expired. Use for 'coupon kaam nahi kar raha', 'which coupon is used most', 'is my discount live'.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_customer_summary",
      description:
        "Order history of one customer of this store by phone number: total orders, successful, cancelled, lifetime value and their recent orders. Use for 'is this customer genuine', 'kitni baar order kiya', repeat-customer and fake-order checks.",
      parameters: {
        type: "object",
        properties: { phone: { type: "string", description: "Customer's 10-digit phone number." } },
        required: ["phone"],
      },
    },
  },
] as const;

export async function runOperationsTool(
  admin: any,
  storeId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "find_order": return await findOrder(admin, storeId, args);
    case "list_orders": return await listOrders(admin, storeId, args);
    case "get_wallet_status": return await walletStatus(admin, storeId);
    case "search_products": return await searchProducts(admin, storeId, args);
    case "get_inventory_alerts": return await inventoryAlerts(admin, storeId);
    case "get_abandoned_carts": return await abandonedCarts(admin, storeId, args);
    case "get_coupon_usage": return await couponUsage(admin, storeId);
    case "get_customer_summary": return await customerSummary(admin, storeId, args);
    default: return { error: `unknown tool ${name}` };
  }
}

export const OPERATIONS_TOOL_NAMES = new Set(OPERATIONS_TOOLS.map((t) => t.function.name));
