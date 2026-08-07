# Universal Shipment Tracking for ShopBanao

Goal: every order can carry one or more shipments; customers track them inside the store (Amazon/Flipkart-style timeline) instead of on the courier site; merchants only pick a courier and paste an AWB; a background job keeps everything fresh.

## What already exists (verified)

- `order_shipments` table exists (provider, courier_name, awb, tracking_url, label_url, status, dims, raw_payload) — currently 0 rows, unused.
- `store_shipping_providers` + `store_pickup_addresses` exist — 0 rows configured.
- Edge functions `shiprocket`, `delhivery`, `ekart` exist with `track` actions, plus `supabase/functions/_shared/shipping.ts`.
- Customer side today only reads flat `orders.tracking_number` / `orders.tracking_url`: `src/pages/StorefrontOrderDetail.tsx` (uses `OrderStatusTimeline`) and `src/pages/OrderTrackingPage.tsx` (guest lookup via the `get_order_tracking` RPC).
- Merchant `ShipOrderPanel.tsx` exists but is not wired into any order detail screen.
- WhatsApp send pipeline exists (`wa-order-event`, `wa-queue-worker`, `wa-send-queue`); push via `send-owner-push` / `push_subscriptions`; email via `process-email-queue`.

So this is an extension of the existing shipping module, not a new parallel system.

## Missing pieces to build

1. **`shipment_events` table** — normalized checkpoint history (one row per courier scan), unique on `(shipment_id, event_hash)` so re-syncs never duplicate.
2. **Columns added to `order_shipments`** — `normalized_status`, `current_location`, `estimated_delivery`, `last_synced_at`, `next_sync_at`, `sync_attempts`, `is_active`, `tracking_slug` (courier code), `notified_statuses text[]`.
3. **Courier registry + adapter layer** — `supabase/functions/_shared/tracking/` with one file per courier and a shared `TrackingAdapter` interface.
4. **`shipment-track` edge function** — the Tracking Service: resolve adapter → fetch → normalize → persist events → detect status change → enqueue notifications.
5. **`shipment-sync-cron` edge function** — polls only active shipments whose `next_sync_at` has passed, with adaptive intervals.
6. **RPCs** — `get_shipment_tracking(order_id/awb)` for customers (security definer, ownership/phone checked) and `store_upsert_shipment(...)` for merchants.
7. **UI** — `ShipmentTimeline` component reused by storefront order detail, guest tracking page, and merchant order detail; plus a merchant "Add shipment" dialog.

## Architecture

```text
Merchant enters courier + AWB
        v
store_upsert_shipment RPC -> order_shipments row (is_active, next_sync_at = now)
        v
shipment-sync-cron (every 15 min)  ->  Tracking Service (shipment-track)
                                            |
                                    CourierRegistry.resolve(slug)
                                       |        |        |
                                 Shiprocket  Delhivery  IndiaPost ... (adapters)
                                            |
                                  normalize() -> standard status + events
                                            v
                            order_shipments (cached snapshot) + shipment_events
                                            v
                          status changed? -> notification dispatcher
                                            v
Customer reads ONLY the DB via get_shipment_tracking (never hits courier APIs)
```

Frontend never learns the courier: it receives `{ status, statusLabel, courierName, courierLogo, awb, eta, currentLocation, events[], officialUrl }`.

### Adapter interface

```ts
interface TrackingAdapter {
  slug: string;                 // "delhivery" | "shiprocket" | "bluedart" | ...
  displayName: string;
  logo: string;
  officialUrl(awb: string): string | null;
  supportsApi: boolean;         // false => manual-only courier
  track(awb: string, ctx: Ctx): Promise<RawTracking>;
  normalize(raw: RawTracking): NormalizedTracking;
}
```

Adding a courier = drop one file into `_shared/tracking/couriers/` and register it. No changes to the cron, the RPCs, or any UI.

### Status normalization

Canonical enum: `confirmed | packed | shipped | in_transit | reached_hub | out_for_delivery | delivered | returned | cancelled | exception`. Each adapter owns its own keyword/status-code map; a shared `mapByKeywords()` helper covers text-only couriers.

### Courier coverage at launch

- **API-backed**: Shiprocket (covers Blue Dart, DTDC, Ekart, Xpressbees, Delhivery via the aggregator), Delhivery direct, Ekart direct — all three edge functions already exist and get refactored into adapters.
- **Manual couriers** (India Post, Blue Dart direct, DTDC direct, "Other"): adapter with `supportsApi: false`. Merchant sets status manually from the order screen; we still render the same timeline plus the official deep-link. When a merchant later adds Shiprocket/Delhivery credentials, the same AWB starts auto-syncing with zero UI change.

## Backend details

- **Caching**: customers always read the DB snapshot. `get_shipment_tracking` is a security-definer RPC; no courier call on page load, ever.
- **Adaptive sync**: `next_sync_at` = 30 min when `out_for_delivery`, 3 h `in_transit`, 6 h `shipped`, stop after `delivered` / `returned` / `cancelled` (sets `is_active = false`). Auto-deactivate after 30 days or 20 consecutive failures.
- **Rate limiting**: reuse the existing `edge_rate_limits` table for the on-demand "Refresh tracking" button (1 manual refresh per shipment per 10 min).
- **Indexes**: `order_shipments(is_active, next_sync_at)`, `order_shipments(order_id)`, `order_shipments(store_id, created_at desc)`, `shipment_events(shipment_id, event_time desc)`, unique `(shipment_id, event_hash)`.
- **Cron**: `shipment-sync-cron` scheduled every 15 minutes via `cron.schedule` + `net.http_post` (same pattern as the existing recovery crons), batch-limited to 200 shipments per run.

## Notifications

On a status transition the tracking service appends the new status to `notified_statuses` inside the same transaction-ish update, and only enqueues if it was not already present — that is the duplicate guard. Milestones that notify: `shipped`, `out_for_delivery`, `delivered`, `exception/returned`.

- WhatsApp → push a row into `wa_send_queue` (existing worker sends it), only if the store has WA enabled and the number is not opted out.
- Push → existing `send-owner-push` path for merchant, customer push subscription if present.
- Email → existing email queue when the order has an email.
- SMS → left as a stub adapter in the dispatcher (no SMS provider is connected today); wiring one later is a single function.

## Security

- `shipment_events` and `order_shipments`: RLS — merchants via `stores.owner_id = auth.uid()`; no direct anon select.
- Customer access only through `get_shipment_tracking`, which requires either the logged-in storefront customer owning the order, or the existing guest proof used by `get_order_tracking` (order number + phone). Returns no PII beyond what the order page already shows.
- Merchant writes go through `store_upsert_shipment` with an ownership check; AWB and courier slug validated (slug must be in the registry, AWB `[A-Za-z0-9-]{5,30}`).

## UI

**New** `src/components/shipping/ShipmentTimeline.tsx` — shared, theme-token driven (no hardcoded colors), mobile-first:
- header: courier logo + name, status badge, AWB with copy button, ETA ("Arriving Sat, 9 Aug")
- latest checkpoint highlighted with location + relative time
- vertical event timeline, newest first, grouped by date, collapsed to 4 events with "View all"
- optional "View official courier tracking" secondary button
- skeleton state; data comes from one RPC call

**Wired into**:
- `src/pages/StorefrontOrderDetail.tsx` — below the existing `OrderStatusTimeline`, one card per shipment (multi-shipment supported).
- `src/pages/OrderTrackingPage.tsx` — same component for guest lookups.
- Merchant order detail in `src/pages/StoreOrders.tsx` — read-only timeline + an "Add / edit shipment" dialog (courier dropdown from the registry, AWB field, optional manual status) and the existing `ShipOrderPanel` for Shiprocket label flows.

## Build order

1. Migration: extend `order_shipments`, create `shipment_events`, indexes, RLS, grants, the two RPCs.
2. `_shared/tracking/` registry + adapters (shiprocket, delhivery, ekart, manual/India Post/Blue Dart/DTDC).
3. `shipment-track` + `shipment-sync-cron` edge functions; schedule the cron.
4. Notification dispatcher inside the tracking service.
5. `ShipmentTimeline` + merchant shipment dialog; wire into the three screens.
6. Verify end-to-end with a manual-courier shipment and one Delhivery AWB.

## Not in scope

- Shipping-rate quoting at checkout.
- Bulk AWB upload (can follow; the RPC is already bulk-friendly).
- RTO/return label flows.
