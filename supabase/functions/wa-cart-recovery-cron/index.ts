// pg_cron calls this every 10 minutes. Enqueues abandoned-cart recovery
// sends into wa_send_queue (the queue worker handles retries + dispatch).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, normalizePhone, loadPlatformConfig, platformConfigUsable, isValidCronHeader } from "../_shared/wa-platform.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const cronHeader = req.headers.get("x-cron-secret") || "";
  if (!(await isValidCronHeader(admin, cronHeader))) return json({ error: "unauthorized" }, 401);

  const cfg = await loadPlatformConfig(admin);
  if (!platformConfigUsable(cfg)) return json({ skipped: true, reason: "wa_disabled" });

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

  // 🔒 Honor each store's master WhatsApp toggle. Default = true (column default),
  // so a store row only blocks if the merchant explicitly turned it OFF.
  const storeIds = Array.from(new Set(carts.map((c: any) => c.store_id).filter(Boolean)));
  const { data: settings } = await admin
    .from("stores_wa_settings")
    .select("store_id, platform_marketing_enabled")
    .in("store_id", storeIds);
  const disabled = new Set(
    (settings || [])
      .filter((s: any) => s.platform_marketing_enabled === false)
      .map((s: any) => s.store_id),
  );

  // Per-phone 24h marketing cooldown — prevents same number getting multiple
  // marketing pings across stores or repeated carts. Compare on NORMALIZED phone
  // because customers.phone and abandoned_carts.customer_phone aren't guaranteed
  // to share the same format (e.g. "+91..." vs "91..." vs "98...").
  const normPhones = Array.from(new Set(
    carts.map((c: any) => normalizePhone(c.customer_phone)).filter(Boolean) as string[],
  ));
  const cooldownSince = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const onCooldown = new Set<string>();
  if (normPhones.length) {
    const { data: recent } = await admin
      .from("whatsapp_messages")
      .select("recipient_phone")
      .in("recipient_phone", normPhones)
      .eq("sent_via", "platform").eq("direction", "outgoing")
      .gte("created_at", cooldownSince)
      .limit(5000);
    for (const r of (recent as any[]) ?? []) if (r?.recipient_phone) onCooldown.add(String(r.recipient_phone));
  }

  let enqueued = 0, skipped = 0, storeOff = 0, cooldown = 0, emptyCart = 0;
  for (const c of carts) {
    if (disabled.has((c as any).store_id)) { storeOff++; continue; }
    const phone = normalizePhone((c as any).customer_phone);
    if (!phone) { skipped++; continue; }
    if (onCooldown.has(phone)) { cooldown++; continue; }

    const items = Array.isArray((c as any).cart_items) ? (c as any).cart_items : [];
    const total = items.reduce((s: number, it: any) => s + (Number(it?.price ?? 0) * Number(it?.quantity ?? 1)), 0);
    // Skip empty / zero-value carts — sending "₹0 · 0 items" looks broken and
    // is a marketing-policy red flag (low-quality messaging → quality drop).
    if (!items.length || total <= 0) { emptyCart++; continue; }
    const customerName = (items[0]?.customer_name as string) || "there";
    const s = (c as any).stores || {};
    const itemCount = items.reduce((n: number, it: any) => n + Number(it?.quantity ?? 1), 0) || items.length || 1;

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
        store_name: (s as any).name || "our store",
        item_count: String(itemCount),
        cart_total: `₹${total.toFixed(0)}`,
        cta_token: `c-${(c as any).id}`,
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

  return json({ processed: carts.length, enqueued, skipped, store_off: storeOff, cooldown, empty_cart: emptyCart });
});


function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
