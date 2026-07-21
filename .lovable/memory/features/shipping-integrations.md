---
name: shipping-integrations
description: Hybrid courier stack — Shiprocket aggregator + direct Delhivery + direct Ekart. Per-store credentials, pickup addresses, per-order shipment creation.
type: feature
---

Sandbox scaffold for shipping. Later extract to main ShopBanao via `.lovable/features/shipping-integrations.md`.

## Data model
- `store_shipping_providers` — one row per (store, provider). Holds credentials (`api_email`/`api_password` for Shiprocket, `api_key`/`client_id` for Delhivery + Ekart), `is_enabled`, `sandbox`, and Shiprocket's cached auth token (`cached_token`, `token_expires_at` — refreshed inside the edge function, 10-day TTL).
- `store_pickup_addresses` — warehouse addresses. `is_default` picks the one used for shipment creation. `shiprocket_pickup_name` stores the nickname Shiprocket assigned when we registered it.
- `order_shipments` — one row per shipment attached to an order. Records provider, courier, awb, tracking/label URLs, status, weight/dims, cod amount, raw provider payload for debugging.
- RLS: all scoped through `stores.owner_id = auth.uid()`. Service role has full access for edge functions.

## Edge functions
- `shiprocket` — actions: `rate | create | track | cancel | label | pickup_locations | register_pickup`. Uses `apiv2.shiprocket.in/v1/external`. On `create` it (a) creates the order, (b) assigns AWB with `courier_id` if provided, (c) fetches label.
- `delhivery` — actions: `serviceability | rate | create | track | cancel`. Uses `track.delhivery.com` (or staging). `create` uses the `format=json&data=...` form-encoded convention from the Delhivery One `cmu/create.json` endpoint.
- `ekart` — actions: `serviceability | create | track | cancel`. Uses `api.ekartlogistics.com`. Auth via `X-Merchant-Code` + `X-Api-Auth-Key` headers.
- All three: JWT-auth the caller, assert store ownership via `assertStoreOwner`, then load the provider config row.

## UI
- `/dashboard/stores/:storeSlug/shipping-integrations` (page: `StoreShippingIntegrations.tsx`) — pickup CRUD + tabbed provider config + credential test + Shiprocket pickup-registration.
- `ShipOrderPanel` (in `src/components/shipping/`) — drop into any order detail page. Compares rates (Shiprocket returns a full courier list; the panel radio-selects), then creates the shipment. Writes `tracking_number` + `tracking_url` back to `orders`.
- Sidebar link added under Payments group with `menuKey: "shipping"` (reuses shipping visibility toggle).

## Not yet built
- Status webhooks / periodic tracking poller.
- Bulk shipment creation.
- Return/RTO flow.
- Delhivery label proxy (label URL requires Delhivery One session — proxy through an edge function for one-click download).
- Shipping-rate quote at checkout (endpoints exist as `rate`/`serviceability`; wire into checkout when needed).

## Provider onboarding notes
- **Shiprocket**: self-serve signup, SME-friendly. Merchant just pastes login. Must register pickup nickname before first shipment (button in UI).
- **Delhivery**: self-serve via Delhivery One. Merchant pastes API token. Direct integration avoids Shiprocket's markup.
- **Ekart**: SME onboarding at ekartlogistics.com but requires KYC + merchant contract. Contract-specific base URL — expose `extra.base_url` if a merchant reports 404s.
- **Blue Dart, DTDC, India Post**: no self-serve direct integration for SMEs; use them via Shiprocket.