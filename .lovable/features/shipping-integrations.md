# Shipping Integrations (Shiprocket + Delhivery + Ekart)
Built: 2026-07-10
Status: ready-to-extract

## Summary
Hybrid shipping stack for Indian ecommerce: **Shiprocket aggregator** (covers 20+ couriers including Bluedart, DTDC, India Post) + **direct Delhivery** and **direct Ekart** integrations for high-volume sellers who want native rates and faster tracking sync. Includes pickup-address management, per-order shipment creation (with courier picker for Shiprocket), label + tracking URLs written back to the order, and a test-credentials flow.

## Files added
- supabase/migrations/*_shipping_integrations.sql — 3 tables: `store_shipping_providers`, `store_pickup_addresses`, `order_shipments`
- supabase/functions/_shared/shipping.ts — CORS, auth, provider loader, Shiprocket token cache
- supabase/functions/shiprocket/index.ts — actions: `rate | create | track | cancel | label | pickup_locations | register_pickup`
- supabase/functions/delhivery/index.ts — actions: `serviceability | rate | create | track | cancel`
- supabase/functions/ekart/index.ts — actions: `serviceability | create | track | cancel`
- src/pages/StoreShippingIntegrations.tsx — merchant config UI (tabs per provider + pickup CRUD + register-pickup with Shiprocket + credentials test)
- src/components/shipping/ShipOrderPanel.tsx — drop-in "Ship this order" card for order detail pages (rate compare + create shipment)

## Files modified
- src/routes/AuthRoutes.tsx — added `/dashboard/stores/:storeSlug/shipping-integrations` route
- src/components/AppSidebar.tsx — added "Shipping Integrations" nav item under Payments group

## Dependencies added
- none (uses existing Supabase client, React Query, shadcn/ui)

## Backend assumptions
- **Tables (migration in this repo)**: `store_shipping_providers`, `store_pickup_addresses`, `order_shipments` with owner-scoped RLS via `stores.owner_id = auth.uid()`.
- **Edge functions**: `shiprocket`, `delhivery`, `ekart` — all authenticated (JWT check inside), all call provider APIs directly through `fetchWithTimeout`.
- **Provider credentials**: merchant enters their own API keys in the UI. **No global secrets required** — each store has its own row in `store_shipping_providers`.
- **Shiprocket auth**: email+password login mints a 10-day token, cached on the provider row.
- **Delhivery auth**: static API token from Delhivery One dashboard.
- **Ekart auth**: merchant code + auth key from Ekart onboarding.
- Reads `orders`, `order_items`, `stores` tables. Writes `tracking_number` + `tracking_url` back to `orders` on shipment creation.

## Known gaps (v2 candidates)
- No webhook receiver for status updates — status is snapshot-at-create; need a periodic `track` poller or webhook endpoint per provider.
- No bulk-shipment creation (one order at a time).
- Label PDF for Delhivery uses the `packing_slip` endpoint via URL (works with Bearer token via query string doesn't work — user has to be logged into Delhivery One to view, or we proxy through an edge function).
- Ekart endpoints follow the public B2C v2 spec; contract-specific hosts may differ per merchant — verify with account manager and expose a custom `base_url` in `extra` jsonb column if needed.
- ShipOrderPanel isn't wired into a specific order-detail page yet; drop `<ShipOrderPanel order={order} />` into StoreOrders order-detail view or AdminOrders as needed.
- Return/RTO flow not implemented (all providers support it via a "reverse" flag on the create endpoint).
- No multi-pickup selection per shipment (always uses the default pickup address).
- Merchant-facing shipping cost isn't auto-quoted at checkout — that would layer on top of this using the `rate` / `serviceability` actions.

## EXTRACTION PROMPT (paste in main ShopBanao chat)
```
@<this-sandbox-project-name> — extract feature "shipping-integrations":
1. Read `.lovable/features/shipping-integrations.md` in the attached project.
2. Copy every file under "Files added" to the same path here. For the SQL migration, create a NEW migration file with the same content (fresh timestamp).
3. Apply the changes under "Files modified" to the corresponding files here.
4. Install deps: none.
5. Deploy the 3 new edge functions (shiprocket, delhivery, ekart). No new secrets needed — provider credentials come from `store_shipping_providers` rows.
6. Optionally drop `<ShipOrderPanel order={order} />` into the order detail component so merchants can create shipments from the order screen.
7. Do not touch anything outside the listed files.
```