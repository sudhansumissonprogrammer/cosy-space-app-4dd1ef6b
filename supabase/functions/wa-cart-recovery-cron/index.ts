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
  const { data: carts, error } = await q;

  if (error) return json({ error: error.message }, 500);
  if (!carts?.length) return json({ processed: 0 });

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

  let enqueued = 0, skipped = 0, storeOff = 0, cooldown = 0, emptyCart = 0, alreadyOrdered = 0;
  for (const c of carts) {
    if (disabled.has((c as any).store_id)) { storeOff++; continue; }
    const phone = normalizePhone((c as any).customer_phone);
    if (!phone) { skipped++; continue; }

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
        // Cancelled/failed orders are not real recoveries. If the shopper
        // cancelled the same-product order, they should still get cart recovery.
        .not("status", "in", '("cancelled","failed","rejected")')
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
    // Stamp cooldown on customers row (no-op if customer row doesn't exist yet).
    await admin.from("customers")
      .update({ last_marketing_sent_at: new Date().toISOString() })
      .eq("phone", (c as any).customer_phone);
  }

  return json({ processed: carts.length, enqueued, skipped, store_off: storeOff, cooldown, empty_cart: emptyCart, already_ordered: alreadyOrdered });
});


function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
