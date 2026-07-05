// Cron-driven worker. Claims up to N pending wa_send_queue rows with
// FOR UPDATE SKIP LOCKED, fires wa-platform-send, and either marks them
// sent or schedules a retry with exponential backoff.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, isValidCronHeader, getCronSecret, loadPlatformConfig, platformConfigUsable, hasApprovedTemplates, getMetaBreaker, isMetaBreakerOpen } from "../_shared/wa-platform.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BACKOFF_MIN = [1, 5, 30, 120]; // minutes per attempt (1 → 5 → 30 → 2h)

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const cronHeader = req.headers.get("x-cron-secret") || "";
  const authHeader = req.headers.get("Authorization") || "";
  let authorized = await isValidCronHeader(admin, cronHeader);

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

  if (!authorized) {
    return json({ error: "unauthorized" }, 401);
  }

  const cfg = await loadPlatformConfig(admin);
  if (!platformConfigUsable(cfg)) return json({ skipped: true, reason: "wa_disabled" });

  const breaker = await getMetaBreaker(admin);
  if (isMetaBreakerOpen(breaker)) return json({ skipped: true, reason: "meta_breaker_open", open_until: breaker.open_until });
  if (!(await hasApprovedTemplates(admin))) return json({ skipped: true, reason: "no_approved_templates" });
  const batchSize = (cfg as any)?.wa_queue_batch_size || 50;
  const downstreamSecret = (await getCronSecret(admin)) || "";

  // Claim a batch atomically via SQL RPC fallback: select+update by id.
  // We do best-effort: select pending rows due, then update to 'sending' guarded by status=pending.
  const { data: candidates } = await admin
    .from("wa_send_queue")
    .select("id")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .order("priority", { ascending: true })
    .order("scheduled_at", { ascending: true })
    .limit(batchSize);
  if (!candidates?.length) return json({ processed: 0 });

  const ids = (candidates as any[]).map((r) => r.id);
  const { data: claimed } = await admin
    .from("wa_send_queue")
    .update({ status: "sending", locked_until: new Date(Date.now() + 2 * 60_000).toISOString() } as any)
    .in("id", ids)
    .eq("status", "pending")
    .select("*");

  // Skip any rows whose campaign was paused/cancelled while queued.
  const campaignIds = Array.from(new Set(((claimed as any[]) ?? []).map((r) => r.campaign_id).filter(Boolean)));
  let blocked = new Set<string>();
  if (campaignIds.length) {
    const { data: camps } = await admin
      .from("platform_wa_campaigns")
      .select("id,status")
      .in("id", campaignIds);
    blocked = new Set(((camps as any[]) || []).filter((c) => c.status === "paused" || c.status === "cancelled").map((c) => c.id));
  }

  let sent = 0, retried = 0, failed = 0, skippedPaused = 0;
  const STAGGER_MS = Number((cfg as any)?.wa_send_stagger_ms ?? 250);
  let firstIter = true;
  for (const row of (claimed as any[]) ?? []) {
    // Pace sends to protect Meta quality score. Bursty sending (>10/sec) is a
    // known trigger for 131049 marketing throttle. 250ms gap ≈ 4 msgs/sec.
    if (!firstIter && STAGGER_MS > 0) {
      await new Promise((r) => setTimeout(r, STAGGER_MS));
    }
    firstIter = false;
    if (row.campaign_id && blocked.has(row.campaign_id)) {
      await admin.from("wa_send_queue").update({
        status: "skipped", last_error: "campaign_paused_or_cancelled", locked_until: null,
      } as any).eq("id", row.id);
      skippedPaused++;
      continue;
    }

    // 🛒 Just-in-time abandoned-cart guard. Between enqueue and now, the
    // customer may have COMPLETED the order (recovered=true) or the cart was
    // manually skipped. Sending "come back!" to someone who just bought is a
    // major quality-score risk (they'll block/report). Re-check right before send.
    if (row.message_type === "abandoned_cart" && row.abandoned_cart_id) {
      const { data: cart } = await admin
        .from("abandoned_carts")
        .select("recovered")
        .eq("id", row.abandoned_cart_id)
        .maybeSingle();
      if (!cart || (cart as any).recovered === true) {
        await admin.from("wa_send_queue").update({
          status: "skipped", last_error: "cart_already_recovered", locked_until: null,
        } as any).eq("id", row.id);
        skippedPaused++;
        continue;
      }
    }

    // 🛒 Second guard: if the SAME customer placed a confirmed order in this
    // store AFTER the cart was enqueued (any product), skip — they're not
    // abandoning anymore, they converted through another path.
    if (row.message_type === "abandoned_cart" && row.recipient_phone && row.store_id) {
      const rawPhone = String(row.recipient_phone).replace(/\D/g, "");
      const bare = rawPhone.startsWith("91") && rawPhone.length >= 12 ? rawPhone.slice(2) : rawPhone;
      const withCc = bare.length === 10 ? `91${bare}` : rawPhone;
      const phoneVariants = Array.from(new Set([rawPhone, bare, withCc, `+${withCc}`].filter(Boolean)));
      const { count: recentConfirmed } = await admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("store_id", row.store_id)
        .in("customer_phone", phoneVariants)
        .in("status", ["confirmed", "partially_paid", "paid", "processing", "shipped", "delivered"])
        .gte("created_at", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString());
      if ((recentConfirmed ?? 0) > 0) {
        await admin.from("wa_send_queue").update({
          status: "skipped", last_error: "recent_confirmed_order", locked_until: null,
        } as any).eq("id", row.id);
        if (row.abandoned_cart_id) {
          await admin.from("abandoned_carts")
            .update({ recovered: true, recovery_status: "skipped", recovery_error: "customer_converted" })
            .eq("id", row.abandoned_cart_id);
        }
        skippedPaused++;
        continue;
      }
    }




    const resp = await fetch(`${SUPABASE_URL}/functions/v1/wa-platform-send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": downstreamSecret,
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify({
        mode: "automation",
        store_id: row.store_id,
        recipient_phone: row.recipient_phone,
        recipient_name: row.recipient_name,
        template_name: row.template_name,
        template_params: row.params,
        template_vars: row.template_vars || undefined,
        message_type: row.message_type,
        order_id: row.order_id,
        abandoned_cart_id: row.abandoned_cart_id,
      }),
    });
    const j = await resp.json().catch(() => ({}));

    if (resp.ok && j?.success) {
      await admin.from("wa_send_queue").update({
        status: "sent",
        sent_message_id: j?.message_id ?? null,
        locked_until: null,
      } as any).eq("id", row.id);
      sent++;
    } else if (resp.ok && j?.skipped) {
      await admin.from("wa_send_queue").update({
        status: "skipped",
        last_error: j?.reason || "skipped",
        locked_until: null,
      } as any).eq("id", row.id);
      // 🩹 R3: cart-recovery skipped due to daily_cap/quality_throttle/tier_limit
      // is a TRANSIENT skip. Unstamp abandoned_carts.recovery_sent_at so the
      // next cron cycle can retry (still bounded by wa_max_cart_age_hours).
      const transientSkipReasons = new Set(["daily_cap", "quality_throttle", "tier_limit", "meta_breaker_open"]);
      if (row.message_type === "abandoned_cart" && row.abandoned_cart_id && transientSkipReasons.has(String(j?.reason || ""))) {
        await admin.from("abandoned_carts")
          .update({ recovery_sent_at: null, recovery_status: "pending", recovery_error: `skipped:${j?.reason}` })
          .eq("id", row.abandoned_cart_id);
      }
    } else {
      const cls = j?.error_class || (resp.status >= 500 || resp.status === 429 ? "transient" : "permanent");
      const attempts = (row.attempts || 0) + 1;
      const isPermanent = cls === "permanent" || attempts >= (row.max_attempts || 4);
      if (isPermanent) {
        await admin.from("wa_send_queue").update({
          status: "failed",
          attempts,
          last_error: typeof j === "string" ? j : JSON.stringify(j),
          last_error_class: cls,
          locked_until: null,
        } as any).eq("id", row.id);
        failed++;
        // 🩹 R3: on transient permanent-cap-exhaustion for cart recovery,
        // unstamp so a fresh cart-recovery attempt is possible next window.
        // For truly permanent errors (invalid_phone, template_bad), keep it
        // stamped so we don't spam-retry a known-broken send.
        if (row.message_type === "abandoned_cart" && row.abandoned_cart_id && cls === "transient") {
          await admin.from("abandoned_carts")
            .update({ recovery_sent_at: null, recovery_status: "pending", recovery_error: "attempts_exhausted" })
            .eq("id", row.abandoned_cart_id);
        }
      } else {
        const delayMin = BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)];
        await admin.from("wa_send_queue").update({
          status: "pending",
          attempts,
          scheduled_at: new Date(Date.now() + delayMin * 60_000).toISOString(),
          last_error: typeof j === "string" ? j : JSON.stringify(j),
          last_error_class: cls,
          locked_until: null,
        } as any).eq("id", row.id);
        retried++;
      }
    }

  }

  return json({ processed: (claimed as any[])?.length ?? 0, sent, retried, failed, skipped_paused: skippedPaused });
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
