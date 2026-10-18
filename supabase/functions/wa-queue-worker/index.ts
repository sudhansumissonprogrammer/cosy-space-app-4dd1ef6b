// Cron-driven worker. Claims up to N pending wa_send_queue rows with
// FOR UPDATE SKIP LOCKED, fires wa-platform-send, and either marks them
// sent or schedules a retry with exponential backoff.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, isValidCronHeader, getCronSecret, loadPlatformConfig, platformConfigUsable, hasApprovedTemplates, getMetaBreaker, isMetaBreakerOpen } from "../_shared/wa-platform.ts";
import { loadRecentBuyer } from "../_shared/wa-recent-buyer.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BACKOFF_MIN = [1, 5, 30, 120]; // minutes per attempt (1 → 5 → 30 → 2h)

async function removeParcelPhoto(admin: any, row: any) {
  const scanId = String(row?.template_vars?.parcel_scan_id || "");
  if (!scanId) return;
  const { data: scan } = await admin
    .from("parcel_label_scans")
    .select("id,temp_object_path")
    .eq("id", scanId)
    .eq("order_id", row.order_id)
    .maybeSingle();
  const path = String((scan as any)?.temp_object_path || "");
  if (path) await admin.storage.from("parcel-label-temp").remove([path]);
  await admin.from("parcel_label_scans").update({
    temp_object_path: null,
    photo_deleted_at: new Date().toISOString(),
  }).eq("id", scanId);
}

async function removeExpiredParcelPhotos(admin: any) {
  const { data: scans } = await admin
    .from("parcel_label_scans")
    .select("id,temp_object_path")
    .not("temp_object_path", "is", null)
    .is("photo_deleted_at", null)
    .lte("temp_expires_at", new Date().toISOString())
    .limit(100);
  for (const scan of scans ?? []) {
    const path = String((scan as any).temp_object_path || "");
    if (path) await admin.storage.from("parcel-label-temp").remove([path]);
    await admin.from("parcel_label_scans").update({
      temp_object_path: null,
      photo_deleted_at: new Date().toISOString(),
    }).eq("id", (scan as any).id);
  }
}

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
  await removeExpiredParcelPhotos(admin);

  const cfg = await loadPlatformConfig(admin);
  if (!platformConfigUsable(cfg)) return json({ skipped: true, reason: "wa_disabled" });

  const breaker = await getMetaBreaker(admin);
  if (isMetaBreakerOpen(breaker)) return json({ skipped: true, reason: "meta_breaker_open", open_until: breaker.open_until });
  if (!(await hasApprovedTemplates(admin))) return json({ skipped: true, reason: "no_approved_templates" });
  const batchSize = (cfg as any)?.wa_queue_batch_size || 50;
  const downstreamSecret = (await getCronSecret(admin)) || "";

  // 🔓 Reclaim rows stuck in 'sending'. A worker invocation can die mid-batch
  // (CPU/wall limit, thrown error, cold-shutdown) after rows were flipped to
  // 'sending'. Nothing else ever unlocks them, so those messages silently
  // never reach the customer. Anything whose lock expired >5 min ago goes back
  // to 'pending' (or 'failed' once attempts are exhausted).
  let reclaimed = { requeued: 0, failed: 0 };
  try {
    const { data: rec } = await admin.rpc("wa_reclaim_stale_sending", { p_grace_minutes: 5, p_limit: 500 });
    const r = Array.isArray(rec) ? rec[0] : rec;
    if (r) reclaimed = { requeued: r.requeued ?? 0, failed: r.failed ?? 0 };
  } catch (e) {
    console.error("wa-queue-worker: stale reclaim failed", e);
  }

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
  if (!candidates?.length) return json({ processed: 0, reclaimed });

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
  const claimedIds = ((claimed as any[]) ?? []).map((r) => r.id);
  let loopError: string | null = null;
  try {
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

    // 🛡️ Second guard (send-time backstop): a shopper who actually PAID for an
    // order in the last 4 days — in any store — gets NO marketing message at
    // all (abandoned-cart recovery or bulk campaign). Utility/order messages
    // (confirmation, shipping, delivery) are not marketing and pass through.
    const MARKETING_TYPES = new Set(["abandoned_cart", "campaign"]);
    if (MARKETING_TYPES.has(row.message_type) && row.recipient_phone) {
      const buyer = await loadRecentBuyer(admin, row.recipient_phone);
      let candidateIds: string[] = [];
      const tok = String((row as any).cta_token || "");
      const m = tok.match(/^p-([0-9a-fA-F-]{36})/);
      if (m) candidateIds = [m[1]];
      else if ((row as any).abandoned_cart_id) {
        const { data: cartRow } = await admin
          .from("abandoned_carts").select("cart_items")
          .eq("id", (row as any).abandoned_cart_id).maybeSingle();
        const its = Array.isArray((cartRow as any)?.cart_items) ? (cartRow as any).cart_items : [];
        candidateIds = its.map((it: any) => String(it?.productId || it?.product_id || "")).filter(Boolean);
      }
      const decision = buyer.blocks(candidateIds);
      if (decision.blocked) {
        await admin.from("wa_send_queue").update({
          status: "skipped", last_error: decision.reason || "recent_buyer_4d", locked_until: null,
        } as any).eq("id", row.id);
        if (row.abandoned_cart_id) {
          await admin.from("abandoned_carts")
            .update({ recovered: true, recovery_status: "skipped", recovery_error: decision.reason || "recent_buyer_4d" })
            .eq("id", row.abandoned_cart_id);
        }
        skippedPaused++;
        continue;
      }

    }




    let sendTemplateName = row.template_name;
    const sendTemplateVars = { ...(row.template_vars || {}) };
    const parcelScanId = String(sendTemplateVars.parcel_scan_id || "");
    const requiresParcelPhoto = row.message_type === "order_shipped" && row.template_name === "order_shipped_v3_img";
    if (requiresParcelPhoto) {
      if (!parcelScanId) {
        await admin.from("wa_send_queue").update({
          status: "failed",
          attempts: (row.attempts || 0) + 1,
          last_error: "parcel_photo_required_but_scan_missing",
          last_error_class: "permanent",
          locked_until: null,
        } as any).eq("id", row.id);
        failed++;
        continue;
      }
      const { data: scan } = await admin
        .from("parcel_label_scans")
        .select("temp_object_path,temp_expires_at,photo_deleted_at")
        .eq("id", parcelScanId)
        .eq("order_id", row.order_id)
        .maybeSingle();
      const usable = scan && !(scan as any).photo_deleted_at && (scan as any).temp_object_path &&
        new Date((scan as any).temp_expires_at || 0).getTime() > Date.now();
      if (usable) {
        const secondsLeft = Math.max(60, Math.floor(
          (new Date((scan as any).temp_expires_at).getTime() - Date.now()) / 1000,
        ));
        const { data: signed } = await admin.storage
          .from("parcel-label-temp")
          .createSignedUrl((scan as any).temp_object_path, secondsLeft);
        if (signed?.signedUrl) sendTemplateVars.header_media_url = signed.signedUrl;
      }
      if (!usable || !sendTemplateVars.header_media_url) {
        await admin.from("wa_send_queue").update({
          status: "failed",
          attempts: (row.attempts || 0) + 1,
          last_error: usable ? "parcel_photo_signed_url_failed" : "parcel_photo_unavailable_or_expired",
          last_error_class: "permanent",
          locked_until: null,
        } as any).eq("id", row.id);
        failed++;
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
        template_name: sendTemplateName,
        template_params: row.params,
        template_vars: sendTemplateVars,
        message_type: row.message_type,
        order_id: row.order_id,
        abandoned_cart_id: row.abandoned_cart_id,
      }),
    });
    const j = await resp.json().catch(() => ({}));

    if (resp.ok && j?.success) {
      const sentAt = new Date().toISOString();
      await admin.from("wa_send_queue").update({
        status: "sent",
        sent_message_id: j?.message_id ?? null,
        last_error: null,
        last_error_class: null,
        locked_until: null,
      } as any).eq("id", row.id);
      await markAbandonedCartSent(admin, row, j?.message_id ?? null, sentAt);
      // Meta accepts template sends before it fetches an image-header URL.
      // Keep the private parcel photo available until its short TTL expires;
      // deleting it here causes the later delivery callback to fail with 131053.
      // removeExpiredParcelPhotos() remains the sole successful-send cleanup path.
      sent++;
    } else if (resp.ok && j?.skipped) {
      await admin.from("wa_send_queue").update({
        status: "skipped",
        last_error: j?.reason || "skipped",
        locked_until: null,
      } as any).eq("id", row.id);
      await removeParcelPhoto(admin, row);
      // Cart-recovery skips caused by temporary platform conditions can be
      // is a TRANSIENT skip. Unstamp abandoned_carts.recovery_sent_at so the
      // next cron cycle can retry (still bounded by wa_max_cart_age_hours).
      // A weekly cap is deliberately final for this rolling window and must
      // stay skipped; unstamping it would make every cron re-enqueue noise.
      const transientSkipReasons = new Set(["daily_cap", "quality_throttle", "tier_limit", "meta_breaker_open", "weekly_gate_unavailable"]);
      if (row.message_type === "abandoned_cart" && row.abandoned_cart_id && transientSkipReasons.has(String(j?.reason || ""))) {
        await syncAbandonedCartAfterTransientBlock(admin, row, `skipped:${j?.reason}`);
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
        await removeParcelPhoto(admin, row);
        failed++;
        // 🩹 R3: on transient permanent-cap-exhaustion for cart recovery,
        // unstamp so a fresh cart-recovery attempt is possible next window.
        // For truly permanent errors (invalid_phone, template_bad), keep it
        // stamped so we don't spam-retry a known-broken send.
        if (row.message_type === "abandoned_cart" && row.abandoned_cart_id && cls === "transient") {
          await syncAbandonedCartAfterTransientBlock(admin, row, "attempts_exhausted");
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
  } catch (e) {
    // A thrown error used to abort the batch and leave every remaining row
    // frozen in 'sending' forever. Record it and fall through to the unlock.
    loopError = e instanceof Error ? e.message : String(e);
    console.error("wa-queue-worker: batch aborted", loopError);
  }

  // 🧹 Safety net: release any row from THIS batch still sitting in 'sending'
  // (crash, early return, timeout) so the next cron cycle retries it.
  let released = 0;
  if (claimedIds.length) {
    const { data: leftovers } = await admin
      .from("wa_send_queue")
      .update({
        status: "pending",
        locked_until: null,
        scheduled_at: new Date(Date.now() + 60_000).toISOString(),
        last_error: loopError ? `batch_aborted: ${loopError}` : "batch_incomplete",
        last_error_class: "transient",
      } as any)
      .in("id", claimedIds)
      .eq("status", "sending")
      .select("id");
    released = ((leftovers as any[]) ?? []).length;
  }

  return json({ processed: (claimed as any[])?.length ?? 0, sent, retried, failed, skipped_paused: skippedPaused, released, reclaimed, error: loopError });
});


function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function markAbandonedCartSent(admin: any, row: any, messageId: string | null, sentAt?: string) {
  if (row.message_type !== "abandoned_cart" || !row.abandoned_cart_id) return;
  await admin.from("abandoned_carts")
    .update({
      recovery_sent_at: sentAt || new Date().toISOString(),
      recovery_status: "sent",
      recovery_message_id: messageId,
      recovery_error: null,
    })
    .eq("id", row.abandoned_cart_id);
}

async function syncAbandonedCartAfterTransientBlock(admin: any, row: any, pendingError: string) {
  if (row.message_type !== "abandoned_cart" || !row.abandoned_cart_id) return;

  const { data: sentRow } = await admin
    .from("wa_send_queue")
    .select("sent_message_id, updated_at")
    .eq("abandoned_cart_id", row.abandoned_cart_id)
    .eq("message_type", "abandoned_cart")
    .eq("status", "sent")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sentRow) {
    await markAbandonedCartSent(admin, row, sentRow.sent_message_id ?? null, sentRow.updated_at ?? undefined);
    return;
  }

  await admin.from("abandoned_carts")
    .update({ recovery_sent_at: null, recovery_status: "pending", recovery_error: pendingError })
    .eq("id", row.abandoned_cart_id);
}
