// pg_cron calls this every 10 minutes. Enqueues abandoned-cart recovery
// sends into wa_send_queue (the queue worker handles retries + dispatch).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, normalizePhone, loadPlatformConfig, platformConfigUsable, isValidCronHeader, hasApprovedTemplates, getMetaBreaker, isMetaBreakerOpen } from "../_shared/wa-platform.ts";

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

  const now = Date.now();
  const minAgeMs = cfg!.wa_min_cart_age_minutes * 60 * 1000;
  const maxAgeMs = cfg!.wa_max_cart_age_hours * 60 * 60 * 1000;
  const beforeIso = new Date(now - minAgeMs).toISOString();
  const afterIso = new Date(now - maxAgeMs).toISOString();

  const requireConsent = (cfg as any)?.wa_require_marketing_consent !== false;
  let q = admin
    .from("abandoned_carts")
    .select("id, store_id, customer_phone, cart_items, created_at, wa_marketing_consent, stores:store_id(name, slug, custom_domain)")
    .eq("recovered", false)
    .is("recovery_sent_at", null)
    .not("customer_phone", "is", null)
    .lte("created_at", beforeIso)
    .gte("created_at", afterIso)
    .limit(200);
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
    .limit(300);

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
        .is("recovery_sent_at", null)
        .in("customer_phone", phones)
        .gte("created_at", afterIso)
        .limit(200);
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


  // 🔒 Default: send abandoned cart recovery whenever the store has WhatsApp
  // platform marketing enabled at all. The per-feature `send_abandoned_cart`
  // sub-toggle is intentionally ignored — cart recovery is the baseline
  // marketing message every store gets by default.
  const storeIds = Array.from(new Set(carts.map((c: any) => c.store_id).filter(Boolean)));
  const { data: settings } = await admin
    .from("stores_wa_settings")
    .select("store_id, platform_marketing_enabled")
    .in("store_id", storeIds);
  const enabled = new Set(
    (settings || [])
      .filter((s: any) => s.platform_marketing_enabled === true)
      .map((s: any) => s.store_id),
  );
  const disabled = new Set(storeIds.filter((id: any) => !enabled.has(id)));

  // Do not suppress eligible carts here with a broad 24h cooldown. The sender
  // already enforces the configured daily per-phone marketing cap, while a
  // cron-side cooldown can make valid carts expire past wa_max_cart_age_hours
  // without ever being queued.

  let enqueued = 0, skipped = 0, storeOff = 0, cooldown = 0, emptyCart = 0, alreadyOrdered = 0, phoneCapped = 0;

  // Strict per-phone marketing cap (1/day). Pre-check so we don't waste queue
  // rows on phones that will just be skipped by the sender. Counts BOTH already
  // sent marketing msgs AND queued/sending rows in the last 24h.
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const TRANSACTIONAL = ["order_confirmation", "payment_received", "payment_success", "order_shipped", "order_delivered"];

  for (const c of carts) {
    if (disabled.has((c as any).store_id)) { storeOff++; continue; }
    const phone = normalizePhone((c as any).customer_phone);
    if (!phone) { skipped++; continue; }

    // 🚫 STRICT: 1 marketing msg per phone per 24h. Same shopper visiting 3 PDPs
    // must not get 3 recovery messages — only the first cart wins.
    const { count: sentMkt } = await admin
      .from("whatsapp_messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_phone", phone).eq("sent_via", "platform").eq("direction", "outgoing")
      .eq("status", "sent") // 🩹 failed msgs (Meta throttle) must not consume the cap
      .not("message_type", "in", `(${TRANSACTIONAL.map((t) => `"${t}"`).join(",")})`)
      .gte("created_at", since24h);

    const { count: pendingMkt } = await admin
      .from("wa_send_queue")
      .select("id", { count: "exact", head: true })
      .eq("recipient_phone", phone)
      .in("status", ["pending", "sending", "sent"])
      .not("message_type", "in", `(${TRANSACTIONAL.map((t) => `"${t}"`).join(",")})`)
      .gte("created_at", since24h);
    if (((sentMkt ?? 0) + (pendingMkt ?? 0)) >= 1) {
      const { data: sentForCart } = await admin
        .from("wa_send_queue")
        .select("sent_message_id, updated_at")
        .eq("abandoned_cart_id", (c as any).id)
        .eq("message_type", "abandoned_cart")
        .eq("status", "sent")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sentForCart) {
        await admin.from("abandoned_carts")
          .update({
            recovery_status: "sent",
            recovery_sent_at: (sentForCart as any).updated_at ?? new Date().toISOString(),
            recovery_message_id: (sentForCart as any).sent_message_id ?? null,
            recovery_error: null,
          })
          .eq("id", (c as any).id);
      } else {
        await admin.from("abandoned_carts")
          .update({ recovery_status: "skipped", recovery_error: "phone_daily_cap" })
          .eq("id", (c as any).id);
      }
      phoneCapped++;
      continue;
    }


    const items = Array.isArray((c as any).cart_items) ? (c as any).cart_items : [];
    const total = items.reduce((s: number, it: any) => s + (Number(it?.price ?? 0) * Number(it?.quantity ?? 1)), 0);
    // Skip empty / zero-value carts — sending "₹0 · 0 items" looks broken and
    // is a marketing-policy red flag (low-quality messaging → quality drop).
    if (!items.length || total <= 0) { emptyCart++; continue; }

    // 🛒 Product-overlap check: if this customer already placed an order in
    // this store containing ANY product from the cart (since the cart was
    // created), the cart is effectively recovered — skip and mark it.
    // Match on phone variants because orders.customer_phone may be stored
    // without the country-code that normalizePhone() adds.
    const cartProductIds = items
      .map((it: any) => String(it?.productId || it?.product_id || ""))
      .filter(Boolean);
    if (cartProductIds.length) {
      const rawPhone = String((c as any).customer_phone || "").replace(/\D/g, "");
      const phoneVariants = Array.from(new Set([
        phone,
        rawPhone,
        rawPhone.startsWith("91") ? rawPhone.slice(2) : `91${rawPhone}`,
      ].filter(Boolean)));
      const { data: matchOrders } = await admin
        .from("orders")
        .select("id, order_items(product_id)")
        .eq("store_id", (c as any).store_id)
        .in("customer_phone", phoneVariants)
        // Cancelled/failed/pending orders are not real recoveries. Pending =
        // customer opened the payment gateway but hasn't paid — still a lead.
        .not("status", "in", '("cancelled","failed","rejected","pending")')
        .gte("created_at", (c as any).created_at)
        .limit(20);
      const orderedIds = new Set<string>();
      for (const o of (matchOrders as any[]) ?? []) {
        for (const oi of (o.order_items ?? [])) {
          if (oi?.product_id) orderedIds.add(String(oi.product_id));
        }
      }
      if (cartProductIds.some((pid: string) => orderedIds.has(pid))) {
        await admin.from("abandoned_carts")
          .update({ recovered: true, recovery_status: "skipped", recovery_error: "product already ordered" })
          .eq("id", (c as any).id);
        alreadyOrdered++;
        continue;
      }
    }

    const customerName = (items[0]?.customer_name as string) || "there";
    const s = (c as any).stores || {};

    // We highlight the first cart item (the product the shopper actually
    // viewed) and pitch that single product — matches the template copy
    // "You were checking out <product> ... complete your purchase".
    const firstItem = items[0] || {};
    const firstTitle = String(firstItem?.name || firstItem?.title || "your item").trim();
    const unitPrice = Number(firstItem?.price ?? 0);
    const productPrice = unitPrice > 0 ? `₹${unitPrice.toFixed(0)}` : `₹${total.toFixed(0)}`;

    // CTA opens the product page directly (p-<product_id>). Fallback to
    // cart-recovery link when no productId is present. `~<phone10>` suffix
    // lets wa-r mint an autologin token for the marketing recipient.
    const firstProductId = firstItem?.productId || firstItem?.product_id;
    const alSuffix = phone ? `~${phone}` : "";
    const ctaToken = firstProductId ? `p-${firstProductId}${alSuffix}` : `c-${(c as any).id}`;

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
    const OFFER_DISCOUNT = 100;
    const ADVANCE_AMOUNT = 100;
    const discountedPrice = Math.max(effectiveSale - OFFER_DISCOUNT, 0);
    const balanceDue = Math.max(discountedPrice - ADVANCE_AMOUNT, 0);

    // Auto-pick the newest APPROVED + active abandoned_cart template. This lets
    // us promote v4/v5 by flipping is_active/meta_status in the DB — no code edit.
    const { data: activeTpl } = await admin
      .from("platform_wa_templates")
      .select("name, variables")
      .like("name", "abandoned_cart_v%")
      .eq("is_active", true)
      .eq("paused", false)
      .ilike("meta_status", "approved")
      .order("name", { ascending: false })
      .limit(1)
      .maybeSingle();
    let chosenTemplate = (activeTpl as any)?.name || "abandoned_cart_v2";
    // 🛡️ Offer-template guard: v4/v5 need MRP ≥ ₹300 or the copy reads broken
    // (e.g. "Ab Sirf ₹0", "delivery ₹0"). Below the floor, fall back to v2.
    const tplVars: string[] = ((activeTpl as any)?.variables) || [];
    const needsOfferMath = tplVars.includes("discounted_price") || tplVars.includes("balance_due");
    if (needsOfferMath && basePrice < 300) chosenTemplate = "abandoned_cart_v2";


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
        cta_token: ctaToken,
        // v7_img — dynamic header image. Ignored by TEXT-header templates.
        ...(headerMediaUrl ? { header_media_url: headerMediaUrl } : {}),
      },
      priority: 5,
      scheduled_at: new Date().toISOString(),
    } as any);



    if (qErr) { skipped++; continue; }
    enqueued++;

    await admin.from("abandoned_carts")
      .update({ recovery_sent_at: new Date().toISOString(), recovery_status: "queued" })
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
    .limit(200);

  if (dropOrders?.length) {
    const dropStoreIds = Array.from(new Set(dropOrders.map((o: any) => o.store_id).filter(Boolean)));
    const { data: dropSettings } = await admin
      .from("stores_wa_settings")
      .select("store_id, platform_marketing_enabled")
      .in("store_id", dropStoreIds);
    const dropEnabled = new Set(
      (dropSettings || [])
        .filter((s: any) => s.platform_marketing_enabled === true)
        .map((s: any) => s.store_id),
    );

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

      // Reuse the strict 1/24h per-phone marketing cap.
      const { count: sentMkt } = await admin
        .from("whatsapp_messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_phone", phone).eq("sent_via", "platform").eq("direction", "outgoing")
        .eq("status", "sent")
        .not("message_type", "in", `(${TRANSACTIONAL.map((t) => `"${t}"`).join(",")})`)
        .gte("created_at", since24h);
      const { count: pendingMkt } = await admin
        .from("wa_send_queue")
        .select("id", { count: "exact", head: true })
        .eq("recipient_phone", phone)
        .in("status", ["pending", "sending", "sent"])
        .not("message_type", "in", `(${TRANSACTIONAL.map((t) => `"${t}"`).join(",")})`)
        .gte("created_at", since24h);
      if (((sentMkt ?? 0) + (pendingMkt ?? 0)) >= 1) { payDropCapped++; continue; }

      const items = Array.isArray((o as any).order_items) ? (o as any).order_items : [];
      const firstItem = items[0] || {};
      const firstTitle = String(firstItem?.product_name || "your item").trim();
      const orderTotal = Number((o as any).total ?? 0);
      const unitPrice = Number(firstItem?.unit_price ?? 0);
      const productPrice = unitPrice > 0 ? `₹${unitPrice.toFixed(0)}` : `₹${orderTotal.toFixed(0)}`;
      const firstProductId = firstItem?.product_id;
      const alSuffix2 = phone ? `~${phone}` : "";
      const ctaToken = firstProductId ? `p-${firstProductId}${alSuffix2}` : `o-${(o as any).id}`;
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
      const discountedPrice = Math.max(effectiveSale2 - 100, 0);
      const balanceDue = Math.max(discountedPrice - 100, 0);

      const { data: activeTpl2 } = await admin
        .from("platform_wa_templates")
        .select("name, variables")
        .like("name", "abandoned_cart_v%")
        .eq("is_active", true).eq("paused", false).ilike("meta_status", "approved")
        .order("name", { ascending: false }).limit(1).maybeSingle();
      let chosenTemplate2 = (activeTpl2 as any)?.name || "abandoned_cart_v2";
      const tplVars2: string[] = ((activeTpl2 as any)?.variables) || [];
      const needsOfferMath2 = tplVars2.includes("discounted_price") || tplVars2.includes("balance_due");
      if (needsOfferMath2 && basePrice < 300) chosenTemplate2 = "abandoned_cart_v2";

      const { error: qErr } = await admin.from("wa_send_queue").insert({
        store_id: (o as any).store_id,
        recipient_phone: phone,
        recipient_name: customerName,
        template_name: chosenTemplate2,
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
          cta_token: ctaToken,
          ...(headerMediaUrl2 ? { header_media_url: headerMediaUrl2 } : {}),
        },
        priority: 4, // slightly higher than cart-only (5) — these are hotter leads

        scheduled_at: new Date().toISOString(),
      } as any);

      if (qErr) { payDropSkipped++; continue; }
      payDropEnqueued++;

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
