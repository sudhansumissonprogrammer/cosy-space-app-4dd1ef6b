// One-off / on-demand recovery blast.
//
// Audience: every phone that, in the last N days (default 5), either
//   • appears in customer_leads, or
//   • has an order with status pending|cancelled and payment_verified = false
// for a store with platform marketing enabled.
//
// Guarantees:
//   • STRICTLY one message per phone number for the whole run (global dedupe).
//   • Phones that already received / have queued a marketing message in the
//     last 24h are skipped; the central sender additionally enforces the hard
//     cross-store limit of 3 marketing attempts per phone per rolling 7 days.
//   • Opted-out phones are skipped.
//   • Phones that converted (confirmed order after the event) are skipped.
//   • The pitched product must still be ACTIVE, so the WhatsApp button never
//     lands on a "product not found" page. If nothing live is left for that
//     phone, the phone is skipped instead of burning a conversation.
//   • Sends are spread across days so the Meta tier limit (unique recipients
//     per 24h) is never exceeded — the overflow is scheduled for +24h, +48h…
//
// POST body: { dry_run?: boolean, days?: number, daily_cap?: number }
// Auth: x-cron-secret header OR an admin user's Bearer token.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, normalizePhone, loadPlatformConfig, platformConfigUsable, isValidCronHeader } from "../_shared/wa-platform.ts";
import { KALINGA_RECOVERY_STORE_ID, KALINGA_RECOVERY_CODE, recoveryCouponToken } from "../_shared/kalinga-recovery-offer.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // ── Auth: cron secret or admin JWT ────────────────────────────────────
  let authorized = await isValidCronHeader(admin, req.headers.get("x-cron-secret") || "");
  const authHeader = req.headers.get("Authorization") || "";
  if (!authorized && authHeader.startsWith("Bearer ")) {
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (user) {
      const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      authorized = isAdmin === true;
    }
  }
  if (!authorized) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({})) as any;
  const dryRun = body?.dry_run !== false; // default SAFE: dry run unless explicitly false
  const days = Math.min(30, Math.max(1, Number(body?.days ?? 5)));
  const cfg = await loadPlatformConfig(admin);
  if (!platformConfigUsable(cfg)) return json({ skipped: true, reason: "wa_disabled" });
  const tierLimit = Number((cfg as any)?.wa_tier_limit ?? 250);
  const dailyCap = Math.max(1, Number(body?.daily_cap ?? Math.floor(tierLimit * 0.85)));

  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const TRANSACTIONAL = ["order_confirmation", "payment_received", "payment_success", "order_shipped", "order_delivered"];

  // ── 1. Collect candidate events ───────────────────────────────────────
  type Cand = { phone: string; storeId: string; name: string; productId: string | null; at: string; orderId: string | null };
  const cands: Cand[] = [];

  const { data: dropOrders } = await admin
    .from("orders")
    .select("id, store_id, customer_phone, customer_name, created_at, order_items(product_id, product_name, unit_price)")
    .in("status", ["pending", "cancelled"])
    .eq("payment_verified", false)
    .not("customer_phone", "is", null)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(2000);
  for (const o of (dropOrders as any[]) ?? []) {
    const phone = normalizePhone(o.customer_phone);
    if (!phone) continue;
    const item = (o.order_items || []).find((i: any) => i?.product_id) || {};
    cands.push({
      phone, storeId: o.store_id, name: String(o.customer_name || "there").trim() || "there",
      productId: item?.product_id || null, at: o.created_at, orderId: o.id,
    });
  }

  const { data: leads } = await admin
    .from("customer_leads")
    .select("store_id, phone, name, product_id, created_at")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(3000);
  for (const l of (leads as any[]) ?? []) {
    const phone = normalizePhone(l.phone);
    if (!phone) continue;
    cands.push({
      phone, storeId: l.store_id, name: String(l.name || "there").trim() || "there",
      productId: l.product_id || null, at: l.created_at, orderId: null,
    });
  }

  // ── 2. Global dedupe: newest event per phone, preferring one with a product
  const byPhone = new Map<string, Cand>();
  for (const c of cands) {
    const prev = byPhone.get(c.phone);
    if (!prev) { byPhone.set(c.phone, c); continue; }
    const better = (!prev.productId && c.productId) ||
      (!!prev.productId === !!c.productId && c.at > prev.at);
    if (better) byPhone.set(c.phone, c);
  }
  const unique = Array.from(byPhone.values());

  // ── 3. Store-level marketing gate ─────────────────────────────────────
  const storeIds = Array.from(new Set(unique.map((c) => c.storeId).filter(Boolean)));
  const [{ data: settings }, { data: storeRows }] = await Promise.all([
    admin.from("stores_wa_settings").select("store_id, platform_marketing_enabled").in("store_id", storeIds),
    admin.from("stores").select("id, name, slug, custom_domain, partial_payment_enabled, partial_payment_type, partial_payment_value").in("id", storeIds),
  ]);
  const marketingOn = new Set(((settings as any[]) || []).filter((s) => s.platform_marketing_enabled === true).map((s) => s.store_id));
  const storeById = new Map(((storeRows as any[]) || []).map((s) => [s.id, s]));

  // ── 4. Coupon / advance offer per store ───────────────────────────────
  const offerCache = new Map<string, any>();
  async function resolveOffer(storeId: string, price: number) {
    let conf = offerCache.get(storeId);
    if (!conf) {
      const nowIso = new Date().toISOString();
      const { data: coupons } = await admin.from("coupons")
        .select("code, discount_type, discount_value, min_order_amount, starts_at, expires_at, wa_exclusive")
        .eq("store_id", storeId).eq("is_active", true)
        .eq(storeId === KALINGA_RECOVERY_STORE_ID ? "code" : "auto_apply", storeId === KALINGA_RECOVERY_STORE_ID ? KALINGA_RECOVERY_CODE : true)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order("wa_exclusive", { ascending: false })
        .order("discount_value", { ascending: false }).limit(5);
      conf = { coupons: (coupons || []) as any[], nowIso };
      offerCache.set(storeId, conf);
    }
    const c = conf.coupons.find((x: any) =>
      (!x.starts_at || x.starts_at <= conf.nowIso) && Number(x.min_order_amount || 0) <= price);
    const rawDiscount = !c ? 0
      : c.discount_type === "percentage"
        ? Math.round((price * Number(c.discount_value || 0)) / 100)
        : Math.round(Number(c.discount_value || 0));
    const discount = Math.max(0, Math.min(rawDiscount, price));
    const s: any = storeById.get(storeId) || {};
    const payable = Math.max(price - discount, 0);
    const rawAdvance = s?.partial_payment_enabled
      ? (s.partial_payment_type === "percentage"
        ? Math.round((payable * Number(s.partial_payment_value || 0)) / 100)
        : Math.round(Number(s.partial_payment_value || 0)))
      : 0;
    return { discount, advance: Math.max(0, Math.min(rawAdvance, payable)), coupon_code: String(c?.code || "").toUpperCase() };
  }

  // ── 5. Template ───────────────────────────────────────────────────────
  const { data: activeTpl } = await admin
    .from("platform_wa_templates")
    .select("name, variables")
    .like("name", "abandoned_cart_v%")
    .eq("is_active", true).eq("paused", false).ilike("meta_status", "approved")
    .order("name", { ascending: false }).limit(1).maybeSingle();
  const defaultTpl = (activeTpl as any)?.name || "abandoned_cart_v2";
  const tplVars: string[] = ((activeTpl as any)?.variables) || [];
  const needsOfferMath = tplVars.includes("discounted_price") || tplVars.includes("balance_due");

  const stats: Record<string, number> = {
    candidates: unique.length, store_off: 0, opted_out: 0, capped_24h: 0,
    converted: 0, no_live_product: 0, queued: 0, insert_failed: 0,
  };
  const preview: any[] = [];
  let slot = 0;

  // ── Bulk prefetch (one query per concern, not per phone) ──────────────
  const notTx = `(${TRANSACTIONAL.map((t) => `"${t}"`).join(",")})`;
  const phones = unique.map((c) => c.phone);
  const digits = (p: string) => {
    const d = String(p).replace(/\D/g, "");
    return d.startsWith("91") && d.length >= 12 ? d.slice(2) : d;
  };
  const [optRes, sentRes, queueRes, convRes, prodRes] = await Promise.all([
    admin.from("whatsapp_optouts").select("phone"),
    admin.from("whatsapp_messages").select("recipient_phone, message_type")
      .eq("sent_via", "platform").eq("direction", "outgoing").eq("status", "sent")
      .not("message_type", "in", notTx).gte("created_at", since24h).limit(20000),
    admin.from("wa_send_queue").select("recipient_phone, message_type")
      .in("status", ["pending", "sending", "sent"])
      .not("message_type", "in", notTx).gte("created_at", since24h).limit(20000),
    admin.from("orders").select("customer_phone, store_id, created_at")
      .in("status", ["confirmed", "processing", "shipped", "delivered", "partially_paid", "paid"])
      .gte("created_at", sinceIso).limit(20000),
    admin.from("products").select("id, name, slug, image_url, price, sale_price, is_active")
      .in("id", Array.from(new Set(unique.map((c) => c.productId).filter(Boolean))) as string[]),
  ]);
  const optedOut = new Set(((optRes.data as any[]) || []).map((r) => digits(r.phone)));
  const recentlyMessaged = new Set([
    ...(((sentRes.data as any[]) || []).map((r) => digits(r.recipient_phone))),
    ...(((queueRes.data as any[]) || []).map((r) => digits(r.recipient_phone))),
  ]);
  const convertedAt = new Map<string, string>(); // storeId|phone → newest confirmed order time
  for (const o of ((convRes.data as any[]) || [])) {
    const k = `${o.store_id}|${digits(o.customer_phone || "")}`;
    const prev = convertedAt.get(k);
    if (!prev || o.created_at > prev) convertedAt.set(k, o.created_at);
  }
  const productById = new Map(((prodRes.data as any[]) || []).map((p) => [p.id, p]));
  void phones;

  for (const c of unique) {
    if (!marketingOn.has(c.storeId)) { stats.store_off++; continue; }
    const pd = digits(c.phone);
    if (optedOut.has(pd)) { stats.opted_out++; continue; }
    if (recentlyMessaged.has(pd)) { stats.capped_24h++; continue; }
    const conv = convertedAt.get(`${c.storeId}|${pd}`);
    if (conv && conv >= c.at) { stats.converted++; continue; }

    // Product must be live (no dead links).
    const candidate = c.productId ? productById.get(c.productId) : null;
    const product = candidate && (candidate as any).is_active !== false ? candidate : null;
    if (!product) { stats.no_live_product++; continue; }


    const store: any = storeById.get(c.storeId) || {};
    const mrp = Number(product.price ?? 0) || 0;
    const sale = Number(product.sale_price ?? 0) || 0;
    const effectiveSale = sale > 0 ? sale : mrp;
    if (!(effectiveSale > 0)) { stats.no_live_product++; continue; }
    const offer = await resolveOffer(c.storeId, effectiveSale);
    const discountedPrice = Math.max(effectiveSale - offer.discount, 0);
    const balanceDue = Math.max(discountedPrice - offer.advance, 0);

    let template = defaultTpl;
    if (needsOfferMath && (effectiveSale < 300 || offer.discount <= 0)) template = "abandoned_cart_v2";

    const headerMediaUrl = product.image_url
      ? `https://wsrv.nl/?url=${encodeURIComponent(product.image_url)}&w=1080&h=1080&fit=cover&output=jpg&q=85`
      : null;

    // Keep the store id in the token so deleted products safely fall back to
    // the merchant homepage while retaining autologin + wa=1.
    // (unlocks the WhatsApp-exclusive coupon) and falls back to the store
    // home if the product goes inactive before the click.
    const ctaToken = `p-${product.id}~${c.phone}~${c.storeId}`;

    // Spread across days so we never exceed the Meta unique-recipient tier.
    const dayOffset = Math.floor(slot / dailyCap);
    const scheduledAt = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000 + (slot % dailyCap) * 1000).toISOString();

    const row = {
      store_id: c.storeId,
      recipient_phone: c.phone,
      recipient_name: c.name,
      template_name: template,
      message_type: "abandoned_cart",
      order_id: c.orderId,
      params: [],
      template_vars: {
        customer_name: c.name,
        product_title: String(product.name || "your item").trim(),
        store_name: store.name || "our store",
        product_price: `₹${effectiveSale.toFixed(0)}`,
        original_price: effectiveSale.toFixed(0),
        discounted_price: discountedPrice.toFixed(0),
        balance_due: balanceDue.toFixed(0),
        coupon_code: offer.coupon_code,
        cta_token: recoveryCouponToken(ctaToken, c.storeId, offer.coupon_code),
        ...(headerMediaUrl ? { header_media_url: headerMediaUrl } : {}),
      },
      priority: 4,
      scheduled_at: scheduledAt,
    } as any;

    if (dryRun) {
      if (preview.length < 5) preview.push({ phone: c.phone, template, product: product.name, discountedPrice, balanceDue, scheduledAt });
      stats.queued++;
      slot++;
      continue;
    }

    const { error: qErr } = await admin.from("wa_send_queue").insert(row);
    if (qErr) { stats.insert_failed++; continue; }
    stats.queued++;
    slot++;
  }

  return json({ dry_run: dryRun, days, daily_cap: dailyCap, template: defaultTpl, stats, preview });
});
