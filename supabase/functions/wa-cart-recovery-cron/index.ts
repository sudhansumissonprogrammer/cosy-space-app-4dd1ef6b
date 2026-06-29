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
  // marketing pings across stores or repeated carts.
  const phones = Array.from(new Set(carts.map((c: any) => c.customer_phone).filter(Boolean)));
  const cooldownSince = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await admin
    .from("customers")
    .select("phone, last_marketing_sent_at")
    .in("phone", phones)
    .gte("last_marketing_sent_at", cooldownSince);
  const onCooldown = new Set((recent || []).map((r: any) => r.phone));

  let enqueued = 0, skipped = 0, storeOff = 0, cooldown = 0;
  for (const c of carts) {
    if (disabled.has((c as any).store_id)) { storeOff++; continue; }
    const phone = normalizePhone((c as any).customer_phone);
    if (!phone) { skipped++; continue; }
    if (onCooldown.has((c as any).customer_phone)) { cooldown++; continue; }

    const items = Array.isArray((c as any).cart_items) ? (c as any).cart_items : [];
    const total = items.reduce((s: number, it: any) => s + (Number(it?.price ?? 0) * Number(it?.quantity ?? 1)), 0);
    const customerName = (items[0]?.customer_name as string) || "there";
    const s = (c as any).stores || {};
    // Pretty multi-line cart list shown inside the WhatsApp body.
    const cartItemsText = items.slice(0, 4).map((it: any) => {
      const name = String(it?.name || it?.title || "Item").slice(0, 40);
      const qty = Number(it?.quantity ?? 1);
      const price = Number(it?.price ?? 0);
      return `🛍 ${name}${qty > 1 ? ` × ${qty}` : ""} — ₹${(price * qty).toFixed(0)}`;
    }).join("\n") + (items.length > 4 ? `\n…and ${items.length - 4} more` : "");
    const cartToken = (c as any).session_token || (c as any).id;

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
        cart_items: cartItemsText,
        cart_total: `₹${total.toFixed(0)}`,
        cart_token: cartToken,
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

  return json({ processed: carts.length, enqueued, skipped, store_off: storeOff, cooldown });
});


function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
