// pg_cron calls this every 10 minutes. Enqueues abandoned-cart recovery
// sends into wa_send_queue (the queue worker handles retries + dispatch).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, normalizePhone, loadPlatformConfig, platformConfigUsable, isValidCronHeader, hasApprovedTemplates, getMetaBreaker, isMetaBreakerOpen, recoveryDripDecision, DRIP_WINDOW_MS } from "../_shared/wa-platform.ts";
import { loadRecentBuyer } from "../_shared/wa-recent-buyer.ts";
import { KALINGA_RECOVERY_STORE_ID, KALINGA_RECOVERY_CODE, recoveryCouponToken } from "../_shared/kalinga-recovery-offer.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const cronHeader = req.headers.get("x-cron-secret") || "";
  if (!(await isValidCronHeader(admin, cronHeader))) return json({ error: "unauthorized" }, 401);

  const cfg = await loadPlatformConfig(admin);
  if (!platformConfigUsable(cfg)) return json({ skipped: true, reason: "wa_disabled" });

  // Prevent hammering Meta when we couldn't send anyway.
  const breaker = await getMetaBreaker(admin);
  if (isMetaBreakerOpen(breaker)) return json({ skipped: true, reason: "meta_breaker_open", open_until: breaker.open_until });
  if (!(await hasApprovedTemplates(admin))) return json({ skipped: true, reason: "no_approved_templates" });

  // 🎟️ Per-store offer resolver — the recovery copy promises "₹X off + ₹Y
  // advance". Those numbers MUST match what checkout actually charges, or the
  // shopper lands on a different price and drops. Discount comes from the
  // store's live auto-apply coupon, advance from stores.partial_payment_*.
  const offerCache = new Map<string, any>();
  async function resolveOffer(storeId: string, price: number) {
    let conf = offerCache.get(storeId);
    if (!conf) {
      const nowIso = new Date().toISOString();
      const [{ data: coupons }, { data: st }] = await Promise.all([
        admin.from("coupons")
          .select("code, discount_type, discount_value, min_order_amount, starts_at, expires_at, wa_exclusive")
          .eq("store_id", storeId).eq("is_active", true)
          .eq(storeId === KALINGA_RECOVERY_STORE_ID ? "code" : "auto_apply", storeId === KALINGA_RECOVERY_STORE_ID ? KALINGA_RECOVERY_CODE : true)
          .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
          // WhatsApp-exclusive coupons win for recovery recipients — they are
          // the ones checkout will auto-apply when the shopper taps the link.
          .order("wa_exclusive", { ascending: false })
          .order("discount_value", { ascending: false }).limit(5),
        admin.from("stores")
          .select("partial_payment_enabled, partial_payment_type, partial_payment_value")
          .eq("id", storeId).maybeSingle(),
      ]);
      conf = { coupons: (coupons || []) as any[], store: (st || {}) as any, nowIso };
      offerCache.set(storeId, conf);
    }
    const c = conf.coupons.find((x: any) =>
      (!x.starts_at || x.starts_at <= conf.nowIso) && Number(x.min_order_amount || 0) <= price
    );
    const rawDiscount = !c ? 0
      : c.discount_type === "percentage"
        ? Math.round((price * Number(c.discount_value || 0)) / 100)
        : Math.round(Number(c.discount_value || 0));
    const discount = Math.max(0, Math.min(rawDiscount, price));
    const s = conf.store;
    const payable = Math.max(price - discount, 0);
    const rawAdvance = s?.partial_payment_enabled
      ? (s.partial_payment_type === "percentage"
          ? Math.round((payable * Number(s.partial_payment_value || 0)) / 100)
          : Math.round(Number(s.partial_payment_value || 0)))
      : 0;
    return {
      discount,
      advance: Math.max(0, Math.min(rawAdvance, payable)),
      coupon_code: c?.code ? String(c.code).toUpperCase() : "",
    };
  }


  const now = Date.now();

  const minAgeMs = cfg!.wa_min_cart_age_minutes * 60 * 1000;
  const maxAgeMs = cfg!.wa_max_cart_age_hours * 60 * 60 * 1000;
  const beforeIso = new Date(now - minAgeMs).toISOString();
  // 🔁 Drip: follow-up lands at +12h (from step 1), so the scan window
  // must cover the whole 3-message sequence, not just wa_max_cart_age_hours.
  const scanWindowMs = Math.max(maxAgeMs, DRIP_WINDOW_MS);
  const afterIso = new Date(now - scanWindowMs).toISOString();

  const requireConsent = (cfg as any)?.wa_require_marketing_consent !== false;
  let q = admin
    .from("abandoned_carts")
    .select("id, store_id, customer_phone, cart_items, created_at, wa_marketing_consent, stores:store_id(name, slug, custom_domain)")
    .eq("recovered", false)
    .not("customer_phone", "is", null)
    .lte("created_at", beforeIso)
    .gte("created_at", afterIso)
    // Newest first + higher ceiling: with 300+ live carts in the 72h window the
    // old unordered limit(200) starved older leads waiting for step 2.
    .order("created_at", { ascending: false })
    .limit(600);
  if (requireConsent) q = q.eq("wa_marketing_consent", true);
  const { data: normalCarts, error } = await q;

  // ⚡ Fast-lane: carts whose customer started an online payment (order.status='pending')
  // that has been sitting for the strict min age (30 min) without becoming
  // confirmed/partially_paid. Uses the same wa_min_cart_age_minutes as normal
  // carts so pending/cancelled orders follow the same 30-min rule.
  const pendingCutoffIso = new Date(now - minAgeMs).toISOString();
  const { data: pendingOrders } = await admin
    .from("orders")
    .select("store_id, customer_phone, created_at")
    .eq("status", "pending")
    .lte("created_at", pendingCutoffIso)
    .gte("created_at", afterIso)
    .order("created_at", { ascending: false })
    .limit(600);

  let fastLaneCarts: any[] = [];
  if (pendingOrders?.length) {
    // Build ALL plausible phone variants because orders + abandoned_carts may
    // store the same phone in different formats (with/without +91, 10-digit,
    // 12-digit, 13-digit with '+'). Missing a variant means the shopper never
    // gets recovery even though we detected drop-off.
    const phoneSet = new Set<string>();
    for (const o of pendingOrders) {
      const raw = String((o as any).customer_phone || "").replace(/\D/g, "");
      if (!raw) continue;
      const bare = raw.startsWith("91") && raw.length >= 12 ? raw.slice(2) : raw;
      const withCc = bare.length === 10 ? `91${bare}` : raw;
      // All observed storage formats:
      phoneSet.add(raw);            // as-stored
      phoneSet.add(bare);           // 10-digit
      phoneSet.add(withCc);         // 12-digit 91XXXXXXXXXX
      phoneSet.add(`+${withCc}`);   // +91 prefix
      phoneSet.add(`+91${bare}`);   // explicit
    }
    const phones = Array.from(phoneSet).filter(Boolean);
    if (phones.length) {
      let fq = admin
        .from("abandoned_carts")
        .select("id, store_id, customer_phone, cart_items, created_at, wa_marketing_consent, stores:store_id(name, slug, custom_domain)")
        .eq("recovered", false)
        .in("customer_phone", phones)
        .gte("created_at", afterIso)
        .order("created_at", { ascending: false })
        .limit(400);
      if (requireConsent) fq = fq.eq("wa_marketing_consent", true);
      const { data: fc } = await fq;
      fastLaneCarts = fc ?? [];
    }
  }


  // Merge (dedupe by cart id) — normal batch first, then any fast-lane carts not already included.
  const seen = new Set<string>((normalCarts ?? []).map((c: any) => c.id));
  const carts = [
    ...(normalCarts ?? []),
    ...fastLaneCarts.filter((c: any) => !seen.has(c.id)),
  ];

  if (error && !fastLaneCarts.length) return json({ error: error.message }, 500);
  // NOTE: do NOT early-return when carts is empty — the payment drop-off lane
  // at the bottom of this function must still run to catch pay-and-drop users.


  // 🔒 Cart recovery requires BOTH the store master switch and the
  // `send_abandoned_cart` toggle to be explicitly ON. Default is OFF.
  const storeIds = Array.from(new Set(carts.map((c: any) => c.store_id).filter(Boolean)));
  const { data: settings } = await admin
    .from("stores_wa_settings")
    .select("store_id, platform_marketing_enabled, send_abandoned_cart, recovery_template_name")
    .in("store_id", storeIds);
  const enabled = new Set(
    (settings || [])
      .filter((s: any) => s.platform_marketing_enabled === true && s.send_abandoned_cart === true)
      .map((s: any) => s.store_id),
  );

  const disabled = new Set(storeIds.filter((id: any) => !enabled.has(id)));

  // 🏪 Per-store recovery template override (e.g. COD-only stores use the COD
  // copy instead of the ₹100-advance partial-payment copy). Only honored when
  // the named template is APPROVED + active — otherwise the global default wins.
  const tplOverrideByStore = new Map<string, string>();
  for (const s of (settings || []) as any[]) {
    if (s?.recovery_template_name) tplOverrideByStore.set(s.store_id, String(s.recovery_template_name));
  }
  // Approved + active abandoned_cart templates, fetched ONCE per cron run
  // (was: one query per cart / per drop-off order).
  const { data: approvedTpls } = await admin
    .from("platform_wa_templates")
    .select("name, variables")
    .like("name", "abandoned_cart_v%")
    .eq("is_active", true)
    .eq("paused", false)
    .ilike("meta_status", "approved")
    .order("name", { ascending: false });
  const tplByName = new Map<string, any>(((approvedTpls as any[]) || []).map((t: any) => [t.name, t]));
  // Store-specific variants (…_cod) must never become the global default just
  // because their name sorts highest — the default skips them.
  const defaultTpl = ((approvedTpls as any[]) || []).find((t: any) => !/_(cod|adv)$/i.test(String(t?.name || "")))
    || ((approvedTpls as any[]) || [])[0] || null;
  const pickRecoveryTemplate = (storeId: any): any => {
    const ov = storeId ? tplOverrideByStore.get(String(storeId)) : undefined;
    if (ov && tplByName.has(ov)) return tplByName.get(ov);
    return defaultTpl;
  };

  // Do not suppress eligible carts here with a broad 24h cooldown. The sender
  // already enforces the configured daily per-phone marketing cap, while a
  // cron-side cooldown can make valid carts expire past wa_max_cart_age_hours
  // without ever being queued.

  let enqueued = 0, skipped = 0, storeOff = 0, cooldown = 0, emptyCart = 0, alreadyOrdered = 0, phoneCapped = 0;

  const TRANSACTIONAL = ["order_confirmation", "payment_received", "payment_success", "order_shipped", "order_delivered"];

  // 🔁 One recovery message per phone per cron run, across BOTH lanes
  // (cart lane + payment drop-off lane). The drip helper handles pacing.
  const handledPhones = new Set<string>();

  // Newest cart first so a shopper with several carts gets pitched the latest one.
  carts.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  for (const c of carts) {
    if (disabled.has((c as any).store_id)) { storeOff++; continue; }
    const phone = normalizePhone((c as any).customer_phone);
    if (!phone) { skipped++; continue; }
    if (handledPhones.has(phone)) { phoneCapped++; continue; }

    // 🔁 DRIP GATE: step 1 now (cart is already ≥30 min old), step 2 at +12h.
    // Never a 3rd message.
    const drip = await recoveryDripDecision(admin, phone);
    if (!drip.allow) {
      await admin.from("abandoned_carts")
        .update({ recovery_status: "skipped", recovery_error: drip.reason || "drip_blocked" })
        .eq("id", (c as any).id);
      phoneCapped++;
      continue;
    }



    const items = Array.isArray((c as any).cart_items) ? (c as any).cart_items : [];
    const total = items.reduce((s: number, it: any) => s + (Number(it?.price ?? 0) * Number(it?.quantity ?? 1)), 0);
    // Skip empty / zero-value carts — sending "₹0 · 0 items" looks broken and
    // is a marketing-policy red flag (low-quality messaging → quality drop).
    if (!items.length || total <= 0) { emptyCart++; continue; }

    // 🛡️ RECENT-BUYER GUARD (4 days, platform-wide, STRICT):
    // anyone who actually paid for an order in the last 4 days gets NO
    // marketing message at all — any product, in ANY store, regardless of
    // whether the order came before or after the cart.
    const cartProductIds = items
      .map((it: any) => String(it?.productId || it?.product_id || ""))
      .filter(Boolean);
    const buyer = await loadRecentBuyer(admin, (c as any).customer_phone);
    const buyerBlock = buyer.blocks(cartProductIds);
    if (buyerBlock.blocked) {
      await admin.from("abandoned_carts")
        .update({ recovered: true, recovery_status: "skipped", recovery_error: buyerBlock.reason })
        .eq("id", (c as any).id);
      alreadyOrdered++;
      continue;
    }


    const customerName = (items[0]?.customer_name as string) || "there";
    const s = (c as any).stores || {};

    // 🚫 Dead-link guard: a cart can reference a product the merchant has
    // since disabled (is_active = false). The PDP 404s ("Product not found"),
    // so the whole marketing message burns a WhatsApp conversation and lands
    // the shopper on a dead page. Pitch the first item that is still live,
    // and skip the cart entirely when nothing is purchasable anymore.
    let liveItems = items;
    if (cartProductIds.length) {
      const { data: activeRows } = await admin
        .from("products")
        .select("id")
        .eq("store_id", (c as any).store_id)
        .eq("is_active", true)
        .in("id", cartProductIds);
      const activeIds = new Set((activeRows as any[] ?? []).map((r) => String(r.id)));
      liveItems = items.filter((it: any) => {
        const pid = String(it?.productId || it?.product_id || "");
        // Items without a product id can't be verified — keep them, they fall
        // back to the `c-` cart-recovery link which never 404s.
        return !pid || activeIds.has(pid);
      });
      if (!liveItems.length) {
        await admin.from("abandoned_carts")
          .update({ recovery_status: "skipped", recovery_error: "product no longer available" })
          .eq("id", (c as any).id);
        skipped++;
        continue;
      }
    }

    // We highlight the first LIVE cart item (the product the shopper actually
    // viewed) and pitch that single product — matches the template copy
    // "You were checking out <product> ... complete your purchase".
    const firstItem = liveItems[0] || {};
    const firstTitle = String(firstItem?.name || firstItem?.title || "your item").trim();
    const unitPrice = Number(firstItem?.price ?? 0);
    const productPrice = unitPrice > 0 ? `₹${unitPrice.toFixed(0)}` : `₹${total.toFixed(0)}`;

    // CTA opens the product page directly. The final store-id segment lets
    // wa-r return an expired/deleted product to this store's homepage.
    const firstProductId = firstItem?.productId || firstItem?.product_id;
    const alSuffix = phone ? `~${phone}` : "";
    const ctaToken = firstProductId
      ? `p-${firstProductId}${alSuffix}~${(c as any).store_id}`
      : `c-${(c as any).id}`;


    // 🖼️ Header image for IMAGE-type templates (v7_img+). Route the product
    // photo through wsrv.nl to guarantee JPG output — Meta rejects WebP in
    // template headers, and our R2 CDN serves WebP.
    // Also fetch products.price (MRP) + sale_price so the template shows the
    // *real* regular price crossed out, not the effective sale price.
    let rawImg: string | null = String((firstItem as any)?.image || (firstItem as any)?.image_url || "") || null;
    let productMrp: number | null = null;
    let productSale: number | null = null;
    if (firstProductId) {
      const { data: p } = await admin
        .from("products")
        .select("image_url, price, sale_price")
        .eq("id", firstProductId)
        .maybeSingle();
      if (!rawImg) rawImg = (p as any)?.image_url || null;
      productMrp = Number((p as any)?.price ?? 0) || null;
      productSale = Number((p as any)?.sale_price ?? 0) || null;
    }
    const headerMediaUrl = rawImg
      ? `https://wsrv.nl/?url=${encodeURIComponent(rawImg)}&w=1080&h=1080&fit=cover&output=jpg&q=85`
      : null;

    // 💰 Offer math (v6/v8 IMAGE template) — MRP shown = SALE PRICE (not the
    // inflated regular price). ₹100 coupon off, then ₹100 advance, rest COD.
    //  • MRP  = products.sale_price (falls back to price/unit if missing)
    //  • Sale = same effective sale price minus ₹100 coupon
    const effectiveSale = productSale && productSale > 0
      ? productSale
      : (productMrp && productMrp > 0 ? productMrp : (unitPrice > 0 ? unitPrice : total));
    const mrpPrice = effectiveSale; // ← use sale price as the crossed-out MRP
    const basePrice = effectiveSale;
    const offer = await resolveOffer((c as any).store_id, effectiveSale);
    const OFFER_DISCOUNT = offer.discount;
    const ADVANCE_AMOUNT = offer.advance;
    const discountedPrice = Math.max(effectiveSale - OFFER_DISCOUNT, 0);
    const balanceDue = Math.max(discountedPrice - ADVANCE_AMOUNT, 0);


    // Auto-pick the newest APPROVED + active abandoned_cart template, honoring
    // the per-store override when one is configured. Promote by flipping
    // is_active/meta_status in the DB — no code edit.
    const activeTpl = pickRecoveryTemplate((c as any).store_id);
    let chosenTemplate = (activeTpl as any)?.name || "abandoned_cart_v2";
    // 🛡️ Offer-template guard: v4/v5 need MRP ≥ ₹300 or the copy reads broken
    // (e.g. "Ab Sirf ₹0", "delivery ₹0"). Below the floor, fall back to v2.
    const tplVars: string[] = ((activeTpl as any)?.variables) || [];
    const needsOfferMath = tplVars.includes("discounted_price") || tplVars.includes("balance_due");
    // Offer copy is only truthful when there IS a real auto-apply coupon to
    // deduct at checkout. No coupon → the "Ab Sirf ₹X" line would repeat the
    // same price, so fall back to the plain v2 template.
    if (needsOfferMath && (basePrice < 300 || OFFER_DISCOUNT <= 0)) chosenTemplate = "abandoned_cart_v2";



    const { error: qErr } = await admin.from("wa_send_queue").insert({
      store_id: (c as any).store_id,
      recipient_phone: phone,
      recipient_name: customerName,
      template_name: chosenTemplate,
      message_type: "abandoned_cart",
      abandoned_cart_id: (c as any).id,
      params: [],
      template_vars: {
        // v2 vars (kept for backwards compatibility)
        customer_name: customerName,
        product_title: firstTitle,
        store_name: (s as any).name || "our store",
        product_price: productPrice,
        // v4 offer vars — resolved by wa-branding only if template asks for them
        original_price: mrpPrice.toFixed(0),
        discounted_price: discountedPrice.toFixed(0),
        balance_due: balanceDue.toFixed(0),
        // v10 vars — advance/discount/coupon are now dynamic per store
        advance_amount: ADVANCE_AMOUNT.toFixed(0),
        discount_amount: OFFER_DISCOUNT.toFixed(0),
        coupon_code: offer.coupon_code,
        cta_token: recoveryCouponToken(ctaToken, (c as any).store_id, offer.coupon_code),
        // v7_img — dynamic header image. Ignored by TEXT-header templates.
        ...(headerMediaUrl ? { header_media_url: headerMediaUrl } : {}),
      },
      priority: 5,
      scheduled_at: new Date().toISOString(),
    } as any);



    if (qErr) { skipped++; continue; }
    enqueued++;
    handledPhones.add(phone);

    await admin.from("abandoned_carts")
      .update({
        recovery_sent_at: new Date().toISOString(),
        recovery_status: "queued",
        recovery_error: `drip_step_${drip.step}`,
      })
      .eq("id", (c as any).id);


    // 🔥 SPEED: warm the destination host + PDP HTML now (fire-and-forget) so
    // when the shopper taps the WA button ~minutes later, DNS/TLS is warm at
    // Cloudflare and the storefront edge cache is hot. Cuts perceived
    // click-to-paint by ~1-2s on cold origins.
    try {
      const host = (s as any).custom_domain || `${(s as any).slug}.shopbanao.in`;
      const slug = firstItem?.slug || null;
      const warmUrl = firstProductId && slug
        ? `https://${host}/product/${encodeURIComponent(slug)}`
        : `https://${host}/`;
      fetch(warmUrl, {
        method: "GET",
        redirect: "manual",
        headers: { "user-agent": "shopbanao-wa-prewarm/1.0", "x-warmer": "wa-cart-cron" },
      }).catch(() => {});
    } catch { /* noop */ }

    // Stamp cooldown on customers row across all phone-format variants
    // (normalized/bare/raw) so we don't miss the row if stored differently.
    const rawP = String((c as any).customer_phone || "").replace(/\D/g, "");
    const bareP = rawP.startsWith("91") && rawP.length >= 12 ? rawP.slice(2) : rawP;
    const withCcP = bareP.length === 10 ? `91${bareP}` : rawP;
    const phoneVars = Array.from(new Set([
      (c as any).customer_phone, rawP, bareP, withCcP, `+${withCcP}`, phone,
    ].filter(Boolean)));
    await admin.from("customers")
      .update({ last_marketing_sent_at: new Date().toISOString() })
      .in("phone", phoneVars as string[]);


  }

  // ══════════════════════════════════════════════════════════════════════
  // 💳 PAYMENT DROP-OFF LANE — orders where customer clicked pay but never
  // completed. These live in `orders` (status=pending|cancelled,
  // payment_verified=false) and are NOT in abandoned_carts. Without this
  // lane, ~60% of highest-intent leads never receive any reminder.
  // ══════════════════════════════════════════════════════════════════════
  let payDropEnqueued = 0, payDropSkipped = 0, payDropStoreOff = 0, payDropCapped = 0, payDropCompleted = 0;

  const payDropMinAgeIso = new Date(now - minAgeMs).toISOString();
  const { data: dropOrders } = await admin
    .from("orders")
    .select("id, store_id, customer_phone, customer_name, total, created_at, order_items(product_id, product_name, unit_price), stores:store_id(name, slug, custom_domain)")
    .in("status", ["pending", "cancelled"])
    .eq("payment_verified", false)
    .not("customer_phone", "is", null)
    .lte("created_at", payDropMinAgeIso)
    .gte("created_at", afterIso)
    .order("created_at", { ascending: false })
    .limit(400);

  if (dropOrders?.length) {
    const dropStoreIds = Array.from(new Set(dropOrders.map((o: any) => o.store_id).filter(Boolean)));
    const { data: dropSettings } = await admin
      .from("stores_wa_settings")
      .select("store_id, platform_marketing_enabled, send_abandoned_cart, recovery_template_name")
      .in("store_id", dropStoreIds);
    const dropEnabled = new Set(
      (dropSettings || [])
        .filter((s: any) => s.platform_marketing_enabled === true && s.send_abandoned_cart === true)
        .map((s: any) => s.store_id),

    );
    // Lane-2 stores may not appear in the cart-lane settings fetch — merge
    // their template overrides too.
    for (const s of (dropSettings || []) as any[]) {
      if (s?.recovery_template_name) tplOverrideByStore.set(s.store_id, String(s.recovery_template_name));
    }

    // Dedup by phone: only keep the newest drop-off per phone.
    const seenPhone = new Set<string>();
    const uniqueDrops: any[] = [];
    for (const o of dropOrders) {
      const p = normalizePhone((o as any).customer_phone);
      if (!p || seenPhone.has(p)) continue;
      seenPhone.add(p);
      uniqueDrops.push(o);
    }

    for (const o of uniqueDrops) {
      if (!dropEnabled.has((o as any).store_id)) { payDropStoreOff++; continue; }
      const phone = normalizePhone((o as any).customer_phone);
      if (!phone) { payDropSkipped++; continue; }
      if (handledPhones.has(phone)) { payDropCapped++; continue; }

      // Skip if customer has ANY confirmed order in this store since drop-off
      // (they eventually completed via COD, retry, or another gateway).
      const rawPhone = String((o as any).customer_phone || "").replace(/\D/g, "");
      const phoneVariants = Array.from(new Set([
        phone, rawPhone,
        rawPhone.startsWith("91") ? rawPhone.slice(2) : `91${rawPhone}`,
      ].filter(Boolean)));
      const { count: completedCount } = await admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("store_id", (o as any).store_id)
        .in("customer_phone", phoneVariants)
        .in("status", ["confirmed", "processing", "shipped", "delivered", "partially_paid"])
        .gte("created_at", (o as any).created_at);
      if ((completedCount ?? 0) > 0) { payDropCompleted++; continue; }

      // 🛡️ RECENT-BUYER GUARD (4 days, platform-wide, STRICT — no marketing at all).
      const dropItems0 = Array.isArray((o as any).order_items) ? (o as any).order_items : [];
      const dropProductIds = dropItems0
        .map((it: any) => String(it?.product_id || ""))
        .filter(Boolean);
      const dropBuyer = await loadRecentBuyer(admin, (o as any).customer_phone);
      if (dropBuyer.blocks(dropProductIds).blocked) { payDropCompleted++; continue; }

      // 🔁 Same 2-step drip: +30min, +12h. Shared with the cart lane so a
      // lead present in both places still gets exactly one message per step.
      const dripDrop = await recoveryDripDecision(admin, phone);
      if (!dripDrop.allow) { payDropCapped++; continue; }




      const items = Array.isArray((o as any).order_items) ? (o as any).order_items : [];
      const firstItem = items[0] || {};
      const firstTitle = String(firstItem?.product_name || "your item").trim();
      const orderTotal = Number((o as any).total ?? 0);
      const unitPrice = Number(firstItem?.unit_price ?? 0);
      const productPrice = unitPrice > 0 ? `₹${unitPrice.toFixed(0)}` : `₹${orderTotal.toFixed(0)}`;
      const firstProductId = firstItem?.product_id;
      const ctaToken = `r-${(o as any).id}`;
      const customerName = String((o as any).customer_name || "there").trim() || "there";
      const s = (o as any).stores || {};

      // 🖼️ Fetch product image + real MRP/sale for the v8 IMAGE template.
      let rawImg2: string | null = null;
      let productMrp2: number | null = null;
      let productSale2: number | null = null;
      if (firstProductId) {
        const { data: p2 } = await admin
          .from("products")
          .select("image_url, price, sale_price")
          .eq("id", firstProductId)
          .maybeSingle();
        rawImg2 = (p2 as any)?.image_url || null;
        productMrp2 = Number((p2 as any)?.price ?? 0) || null;
        productSale2 = Number((p2 as any)?.sale_price ?? 0) || null;
      }
      const headerMediaUrl2 = rawImg2
        ? `https://wsrv.nl/?url=${encodeURIComponent(rawImg2)}&w=1080&h=1080&fit=cover&output=jpg&q=85`
        : null;

      // 💰 Offer math — MRP shown = SALE PRICE (not inflated regular price),
      // ₹100 coupon off, then ₹100 advance, rest COD.
      const effectiveSale2 = productSale2 && productSale2 > 0
        ? productSale2
        : (productMrp2 && productMrp2 > 0 ? productMrp2 : (unitPrice > 0 ? unitPrice : orderTotal));
      const mrpPrice2 = effectiveSale2; // ← sale price as crossed-out MRP
      const basePrice = effectiveSale2;
      const offer2 = await resolveOffer((o as any).store_id, effectiveSale2);
      const discountedPrice = Math.max(effectiveSale2 - offer2.discount, 0);
      const balanceDue = Math.max(discountedPrice - offer2.advance, 0);


      const activeTpl2 = pickRecoveryTemplate((o as any).store_id);
      let chosenTemplate2 = (activeTpl2 as any)?.name || "abandoned_cart_v2";
      const tplVars2: string[] = ((activeTpl2 as any)?.variables) || [];
      const needsOfferMath2 = tplVars2.includes("discounted_price") || tplVars2.includes("balance_due");
      if (needsOfferMath2 && (basePrice < 300 || offer2.discount <= 0)) chosenTemplate2 = "abandoned_cart_v2";


      const { error: qErr } = await admin.from("wa_send_queue").insert({
        store_id: (o as any).store_id,
        recipient_phone: phone,
        recipient_name: customerName,
        template_name: chosenTemplate2, order_id: (o as any).id,
        message_type: "abandoned_cart",
        params: [],
        template_vars: {
          customer_name: customerName,
          product_title: firstTitle,
          store_name: (s as any).name || "our store",
          product_price: productPrice,
          original_price: mrpPrice2.toFixed(0),
          discounted_price: discountedPrice.toFixed(0),
          balance_due: balanceDue.toFixed(0),
          advance_amount: offer2.advance.toFixed(0),
          discount_amount: offer2.discount.toFixed(0),
          coupon_code: offer2.coupon_code,
          cta_token: recoveryCouponToken(ctaToken, (o as any).store_id, offer2.coupon_code),
          ...(headerMediaUrl2 ? { header_media_url: headerMediaUrl2 } : {}),
        },
        priority: 4, // slightly higher than cart-only (5) — these are hotter leads

        scheduled_at: new Date().toISOString(),
      } as any);

      if (qErr) { payDropSkipped++; continue; }
      payDropEnqueued++;
      handledPhones.add(phone);

      await admin.from("customers")
        .update({ last_marketing_sent_at: new Date().toISOString() })
        .in("phone", phoneVariants as string[]);
    }
  }

  return json({
    processed: carts.length,
    enqueued, skipped, store_off: storeOff, cooldown,
    empty_cart: emptyCart, already_ordered: alreadyOrdered, phone_capped: phoneCapped,
    pay_dropoff: {
      scanned: dropOrders?.length ?? 0,
      enqueued: payDropEnqueued,
      skipped: payDropSkipped,
      store_off: payDropStoreOff,
      already_completed: payDropCompleted,
      phone_capped: payDropCapped,
    },
  });
});


function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
