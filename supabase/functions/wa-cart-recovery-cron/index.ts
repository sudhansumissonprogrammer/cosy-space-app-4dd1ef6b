// pg_cron calls this every 10 minutes. Picks abandoned carts in the recovery
// window, fires platform send via wa-platform-send, marks recovery_sent_at.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, normalizePhone, loadPlatformConfig, platformConfigUsable, isValidCronHeader, getCronSecret } from "../_shared/wa-platform.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const cronHeader = req.headers.get("x-cron-secret") || "";
  if (!(await isValidCronHeader(admin, cronHeader))) {
    return json({ error: "unauthorized" }, 401);
  }
  const downstreamSecret = (await getCronSecret(admin)) || "";
  const cfg = await loadPlatformConfig(admin);
  if (!platformConfigUsable(cfg)) return json({ skipped: true, reason: "wa_disabled" });

  const now = Date.now();
  const minAgeMs = cfg!.wa_min_cart_age_minutes * 60 * 1000;
  const maxAgeMs = cfg!.wa_max_cart_age_hours * 60 * 60 * 1000;
  const beforeIso = new Date(now - minAgeMs).toISOString();
  const afterIso = new Date(now - maxAgeMs).toISOString();

  const { data: carts, error } = await admin
    .from("abandoned_carts")
    .select("id, store_id, customer_phone, customer_email, cart_items, created_at")
    .eq("recovered", false)
    .is("recovery_sent_at", null)
    .not("customer_phone", "is", null)
    .lte("created_at", beforeIso)
    .gte("created_at", afterIso)
    .limit(200);

  if (error) return json({ error: error.message }, 500);
  if (!carts?.length) return json({ processed: 0 });

  let sent = 0, skipped = 0, failed = 0;
  for (const c of carts) {
    const phone = normalizePhone((c as any).customer_phone);
    if (!phone) { skipped++; continue; }

    // store name + toggle
    const { data: storeRow } = await admin
      .from("stores")
      .select("name, slug")
      .eq("id", (c as any).store_id)
      .maybeSingle();
    const storeName = (storeRow as any)?.name || "Our store";
    const storeSlug = (storeRow as any)?.slug || "";

    const items = Array.isArray((c as any).cart_items) ? (c as any).cart_items : [];
    const total = items.reduce((s: number, it: any) => s + (Number(it?.price ?? 0) * Number(it?.quantity ?? 1)), 0);
    const checkoutUrl = storeSlug ? `https://${storeSlug}.shopbanao.in/cart` : "https://shopbanao.in";
    const customerName = (items[0]?.customer_name as string) || "there";

    // call wa-platform-send via HTTP with the cron secret
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/wa-platform-send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": downstreamSecret,
        Authorization: `Bearer ${SERVICE_KEY}`, // verify_jwt is false but Supabase routing wants a key
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify({
        mode: "automation",
        store_id: (c as any).store_id,
        recipient_phone: phone,
        recipient_name: customerName,
        template_name: "abandoned_cart_v1",
        template_params: [customerName, storeName, `₹${total}`, checkoutUrl],
        message_type: "abandoned_cart",
        abandoned_cart_id: (c as any).id,
      }),
    });
    const j = await resp.json().catch(() => ({}));

    const status = resp.ok && !j?.skipped ? "sent" : (j?.skipped ? "skipped" : "failed");
    if (status === "sent") sent++;
    else if (status === "skipped") skipped++;
    else failed++;

    await admin
      .from("abandoned_carts")
      .update({
        recovery_sent_at: new Date().toISOString(),
        recovery_status: status,
        recovery_message_id: j?.message_id ?? null,
        recovery_error: status === "failed" ? JSON.stringify(j) : null,
      })
      .eq("id", (c as any).id);
  }

  return json({ processed: carts.length, sent, skipped, failed });
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
