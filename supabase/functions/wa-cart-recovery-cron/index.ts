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
  // that has been sitting for >5 minutes without becoming confirmed/partially_paid.
  // Waiting 5 min (not 1 min) prevents false-positive recovery messages during
  // slow gateway roundtrips (UPI intents, 3DS, bank OTP flows can take 2-4 min).
  const pendingCutoffIso = new Date(now - 5 * 60 * 1000).toISOString();
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
  if (!carts.length) return json({ processed: 0 });


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
    // cart-recovery link when no productId is present.
    const firstProductId = firstItem?.productId || firstItem?.product_id;
    const ctaToken = firstProductId ? `p-${firstProductId}` : `c-${(c as any).id}`;

    const { error: qErr } = await admin.from("wa_send_queue").insert({
      store_id: (c as any).store_id,
      recipient_phone: phone,
      recipient_name: customerName,
      template_name: "abandoned_cart_v2",
      message_type: "abandoned_cart",
      abandoned_cart_id: (c as any).id,
      params: [],
      template_vars: {
        customer_name: customerName,
        product_title: firstTitle,
        store_name: (s as any).name || "our store",
        product_price: productPrice,
        cta_token: ctaToken,
      },
      priority: 5,
      scheduled_at: new Date().toISOString(),
    } as any);


    if (qErr) { skipped++; continue; }
    enqueued++;

    await admin.from("abandoned_carts")
      .update({ recovery_sent_at: new Date().toISOString(), recovery_status: "queued" })
      .eq("id", (c as any).id);
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

  return json({ processed: carts.length, enqueued, skipped, store_off: storeOff, cooldown, empty_cart: emptyCart, already_ordered: alreadyOrdered, phone_capped: phoneCapped });
});


function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
