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

  const { data: carts, error } = await admin
    .from("abandoned_carts")
    .select("id, store_id, customer_phone, cart_items, created_at, stores:store_id(slug, custom_domain)")
    .eq("recovered", false)
    .is("recovery_sent_at", null)
    .not("customer_phone", "is", null)
    .lte("created_at", beforeIso)
    .gte("created_at", afterIso)
    .limit(200);

  if (error) return json({ error: error.message }, 500);
  if (!carts?.length) return json({ processed: 0 });

  let enqueued = 0, skipped = 0;
  for (const c of carts) {
    const phone = normalizePhone((c as any).customer_phone);
    if (!phone) { skipped++; continue; }

    const items = Array.isArray((c as any).cart_items) ? (c as any).cart_items : [];
    const total = items.reduce((s: number, it: any) => s + (Number(it?.price ?? 0) * Number(it?.quantity ?? 1)), 0);
    const customerName = (items[0]?.customer_name as string) || "there";
    const s = (c as any).stores || {};
    const base = s.custom_domain ? `https://${s.custom_domain}` : (s.slug ? `https://${s.slug}.shopbanao.in` : "https://shopbanao.in");
    const checkoutUrl = `${base}/cart`;

    const { error: qErr } = await admin.from("wa_send_queue").insert({
      store_id: (c as any).store_id,
      recipient_phone: phone,
      recipient_name: customerName,
      template_name: "abandoned_cart_v1",
      message_type: "abandoned_cart",
      abandoned_cart_id: (c as any).id,
      params: [],
      template_vars: { customer_name: customerName, cart_total: `₹${total}`, checkout_url: checkoutUrl },
      priority: 5,
      scheduled_at: new Date().toISOString(),
    } as any);

    if (qErr) { skipped++; continue; }
    enqueued++;

    await admin.from("abandoned_carts")
      .update({ recovery_sent_at: new Date().toISOString(), recovery_status: "queued" })
      .eq("id", (c as any).id);
  }

  return json({ processed: carts.length, enqueued, skipped });
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
