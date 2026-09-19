// Tracking Service — resolves a courier adapter, fetches, normalizes,
// persists events, detects status changes and fires notifications.
// The frontend never calls a courier: it reads the DB snapshot.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { resolveAdapter, listAdapters } from "../_shared/tracking/registry.ts";
import { hasPublicFeed, publicTrack } from "../_shared/tracking/couriers/public.ts";
import { hashEvent, statusRank, TERMINAL_STATUSES, NormalizedTracking } from "../_shared/tracking/types.ts";
import { dispatchShipmentNotification, NOTIFY_STATUSES } from "../_shared/tracking/notify.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

/** Adaptive re-sync interval (minutes) by current status. */
const SYNC_MINUTES: Record<string, number> = {
  confirmed: 360,
  packed: 360,
  shipped: 360,
  in_transit: 180,
  reached_hub: 180,
  out_for_delivery: 30,
  exception: 240,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  let body: any = {};
  try { body = await req.json(); } catch { /* GET-ish call */ }

  // Public, cheap: courier list for the merchant dropdown.
  if (body.action === "couriers") return json({ couriers: listAdapters() });

  const shipmentId: string | undefined = body.shipment_id;
  if (!shipmentId) return json({ error: "shipment_id required" }, 400);

  // Internal (cron) calls carry the service key. Merchant calls must own the
  // store. Customer calls (order-tracking page) are allowed too — they only
  // trigger the same courier fetch — and every non-internal caller shares one
  // 10-minute-per-shipment throttle so courier quota can't be burned.
  const authHeader = req.headers.get("Authorization") ?? "";
  // Never trust a caller-provided flag to bypass ownership and rate limits.
  const isInternal = authHeader === `Bearer ${SERVICE_KEY}`;
  const isPublic = body.public === true;

  const { data: shipment, error: shipErr } = await admin
    .from("order_shipments").select("*").eq("id", shipmentId).maybeSingle();
  if (shipErr) return json({ error: shipErr.message }, 500);
  if (!shipment) return json({ error: "shipment not found" }, 404);

  if (!isInternal) {
    if (!isPublic) {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: "unauthorized" }, 401);
      const { data: store } = await admin
        .from("stores").select("owner_id").eq("id", shipment.store_id).maybeSingle();
      if (!store || store.owner_id !== user.id) return json({ error: "forbidden" }, 403);
    }

    const rlKey = `ship_track:${shipmentId}`;
    const { data: rl } = await admin
      .from("edge_rate_limits").select("*").eq("key", rlKey).maybeSingle();
    const now = Date.now();
    if (rl?.window_start && now - new Date(rl.window_start).getTime() < 10 * 60 * 1000) {
      return json({ throttled: true, message: "Tracking was refreshed recently. Try again in a few minutes." }, 429);
    }
    await admin.from("edge_rate_limits").upsert(
      { key: rlKey, window_start: new Date().toISOString(), count: 1 },
      { onConflict: "key" },
    );
  }


  const slug = shipment.tracking_slug || shipment.provider;
  const adapter = resolveAdapter(slug);
  const awb = shipment.awb ?? "";
  const canPublic = hasPublicFeed(slug) && !!awb;

  if ((!adapter || !adapter.supportsApi || !adapter.track) && !canPublic) {
    // Manual courier — nothing to fetch, just keep it out of the sync loop.
    await admin.from("order_shipments").update({
      last_synced_at: new Date().toISOString(),
      next_sync_at: null,
      is_active: !TERMINAL_STATUSES.includes(shipment.normalized_status),
      tracking_url: shipment.tracking_url ?? adapter?.officialUrl(awb) ?? null,
    }).eq("id", shipmentId);
    return json({ manual: true, status: shipment.normalized_status });
  }

  let tracking: NormalizedTracking;
  try {
    if (adapter?.track) {
      try {
        tracking = await adapter.track({
          storeId: shipment.store_id,
          awb,
          loadProvider: async (provider: string) => {
            const { data } = await admin
              .from("store_shipping_providers").select("*")
              .eq("store_id", shipment.store_id).eq("provider", provider).maybeSingle();
            if (!data) throw new Error(`${provider} not configured for this store`);
            if (!data.is_enabled) throw new Error(`${provider} is disabled`);
            return data;
          },
        });
      } catch (inner) {
        // Merchant hasn't connected this courier (or the key broke): fall back
        // to the courier's own public feed so tracking still works.
        if (!canPublic) throw inner;
        tracking = await publicTrack(slug, awb, adapter.officialUrl(awb));
      }
    } else {
      tracking = await publicTrack(slug, awb, adapter?.officialUrl(awb) ?? null);
    }
  } catch (e) {
    const msg = (e as Error).message;
    // India Post put its tracking feed behind a captcha (Aug 2026). There is
    // nothing to retry — park the shipment on a daily re-check instead of
    // burning attempts and eventually deactivating it.
    const blocked = /captcha/i.test(msg);
    const attempts = blocked ? (shipment.sync_attempts ?? 0) : (shipment.sync_attempts ?? 0) + 1;
    await admin.from("order_shipments").update({
      sync_attempts: attempts,
      last_error: msg.slice(0, 500),
      last_synced_at: new Date().toISOString(),
      next_sync_at: new Date(
        Date.now() + (blocked ? 24 : Math.min(attempts, 6)) * 60 * 60 * 1000,
      ).toISOString(),
      is_active: blocked ? true : attempts < 20,
    }).eq("id", shipmentId);
    // Provider outages are a valid tracking state, not an application failure.
    // Return 200 so the UI can explain the outage while retaining cached scans.
    return json({ unavailable: true, error: msg, blocked, status: shipment.normalized_status });
  }



  // Persist events (unique on shipment_id + event_hash → no duplicates).
  if (tracking.events.length) {
    const rows = tracking.events.map((e) => ({
      shipment_id: shipmentId,
      store_id: shipment.store_id,
      status: e.status,
      raw_status: e.rawStatus ?? null,
      description: e.description ?? null,
      location: e.location ?? null,
      event_time: e.eventTime,
      event_hash: hashEvent(e),
    }));
    await admin.from("shipment_events").upsert(rows, {
      onConflict: "shipment_id,event_hash",
      ignoreDuplicates: true,
    });
  }

  // Never go backwards on a terminal status.
  const prev = shipment.normalized_status as string;
  const next = TERMINAL_STATUSES.includes(prev) && !TERMINAL_STATUSES.includes(tracking.status)
    ? prev
    : tracking.status;
  const changed = next !== prev;
  const terminal = TERMINAL_STATUSES.includes(next);
  const minutes = SYNC_MINUTES[next] ?? 240;

  const notified: string[] = shipment.notified_statuses ?? [];
  // 🔕 Seller opt-out: if "Notify customer on WhatsApp" was unticked when the
  // tracking was saved, no customer notification goes out for this shipment —
  // not now, and not on any later automatic courier sync.
  const notifyCustomer = (shipment as any).notify_customer !== false;
  const shouldNotify = notifyCustomer && changed && NOTIFY_STATUSES.includes(next) && !notified.includes(next);

  await admin.from("order_shipments").update({
    normalized_status: next,
    status: next,
    current_location: tracking.currentLocation ?? shipment.current_location,
    estimated_delivery: tracking.estimatedDelivery ?? shipment.estimated_delivery,
    tracking_url: tracking.officialUrl ?? shipment.tracking_url,
    last_synced_at: new Date().toISOString(),
    next_sync_at: terminal ? null : new Date(Date.now() + minutes * 60 * 1000).toISOString(),
    is_active: !terminal,
    sync_attempts: 0,
    last_error: null,
    notified_statuses: shouldNotify ? [...notified, next] : notified,
    updated_at: new Date().toISOString(),
  }).eq("id", shipmentId);

  // Keep the order row in sync so existing screens / WA templates work.
  if (changed) {
    const orderStatus = next === "delivered" ? "delivered"
      : next === "returned" ? "rto"
      : statusRank(next) >= statusRank("shipped") && statusRank(next) < 99 ? "shipped"
      : null;
    const patch: Record<string, unknown> = {
      tracking_number: shipment.awb,
      tracking_url: tracking.officialUrl ?? shipment.tracking_url,
      updated_at: new Date().toISOString(),
    };
    if (orderStatus) patch.status = orderStatus;
    await admin.from("orders").update(patch).eq("id", shipment.order_id);
  }

  let notifications: unknown = null;
  if (shouldNotify) {
    notifications = await dispatchShipmentNotification({
      admin,
      orderId: shipment.order_id,
      storeId: shipment.store_id,
      status: next,
      courierName: shipment.courier_name,
      awb: shipment.awb,
      location: tracking.currentLocation,
    });
  }

  return json({
    status: next,
    changed,
    events: tracking.events.length,
    location: tracking.currentLocation,
    estimated_delivery: tracking.estimatedDelivery,
    notifications,
  });
});
