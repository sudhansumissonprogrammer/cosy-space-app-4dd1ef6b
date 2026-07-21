---
name: upsell-crosssell
description: App Store add-on delivering PDP + cart-drawer + cart-page + pre-checkout + post-purchase upsells with a shared rule engine, stored in store_apps.config.offers, analytics in public.upsell_events.
type: feature
---

# Upsell & Cross-sell App

Single App Store add-on covering every high-revenue upsell surface. Sandbox-first pattern, extractable to main ShopBanao via `.lovable/features/upsell-crosssell.md`.

## App id + storage
- App id: `upsell-crosssell` (registered in `src/lib/appStore/registry.ts`).
- All merchant config in `store_apps.config.offers` JSON — no dedicated merchant tables (matches Bundle Builder pattern).
- One new analytics table: `public.upsell_events` (INSERT via service_role only; owner reads own store).

## 5 placements
`pdp` · `cart_drawer` · `cart_page` · `pre_checkout` · `post_purchase`

Every placement reads the same `UpsellOffer[]` and passes through a single `matchOffers()` rule engine (`src/lib/appStore/upsell/matchEngine.ts`) that filters by trigger type (any / product / category / cart_value / cart_qty), active flag, and date window. Highest-priority match wins per placement.

## Recommendation strategies
Stored in `offer.recommend.mode`:
- `manual` — merchant picks product IDs.
- `auto_best_sellers` — sort by `is_best_selling` (Phase 1).
- `auto_same_category` — Phase 1.
- `auto_frequently_bought` — Phase 2, needs 90d co-purchase query + KV cache.
- `auto_ai` — Phase 2, Lovable AI Gateway (`google/gemini-2.5-flash`), fallback to best sellers.

## Incentive types
`none` · `percent_off` · `flat_off` · `free_gift`. Client uses `applyIncentivePreview()` for UI only; `place-order` MUST re-derive from `store_apps.config.offers` (never trust client snapshot). Cart line meta: `{ kind: "upsell", offer_id, placement, incentive_snapshot }`.

## Files (sandbox, ready to extract)
### Added
- `src/lib/appStore/upsell/types.ts` — offer/placement/strategy/incentive unions + `newUpsellOffer()`.
- `src/lib/appStore/upsell/matchEngine.ts` — pure client-side offer matching + incentive preview.
- `src/lib/appStore/upsell/track.ts` — batched beacon (5s debounce + `pagehide` flush).
- `src/hooks/useUpsellOffers.ts` — reads via `get_store_enabled_apps` RPC.
- `src/components/storefront/apps/Upsell/UpsellStrip.tsx` — shared themed card strip/grid (works for pdp / cart_drawer / cart_page / pre_checkout).
- `src/components/storefront/apps/Upsell/PreCheckoutModal.tsx` — wraps "Proceed to checkout" CTA.
- `src/pages/appStore/UpsellCrossSellConfig.tsx` — merchant config UI (offers CRUD, placement checkboxes, trigger/strategy/incentive/display).
- `supabase/functions/upsell-track/index.ts` — event ingest, service_role writes.
- Migration: `public.upsell_events (store_id, offer_id, placement, event_type, product_id, order_id, revenue_paise, session_id, customer_id, meta)` + RLS (owner reads own; service_role writes).

### Wired in sandbox (Phase 1 complete)
- `src/pages/ProductDetail.tsx` — PDP placement live (below FBT slot).
- `src/pages/CartPage.tsx` — cart_page + pre_checkout live; checkout CTA is wrapped in `PreCheckoutModal`.
- `src/components/storefront/SideCart.tsx` — cart_drawer live; legacy `CartUpsell.tsx` deleted.
- `supabase/functions/place-order/index.ts` — UPSELL EXPANSION block: re-derives incentive server-side, mutates unit_price, sets `__upsell_priced=true` so the canonical-price override loop skips it, writes `upsell_events` (event_type='purchase') after order_items insert — guarded by offer-exists + `ALLOWED_UPSELL_PLACEMENTS` sanitization.
- Merchant config now has a live analytics strip (Views / Adds / Revenue / Conv rate — last 30d) plus per-offer breakdown; manual mode + trigger + exclude fields all use the new `MultiProductPicker`.

## Critical invariants (do not break on extraction)
1. Canonical-price override loop in `place-order` MUST skip both `__bundle_expanded` and `__upsell_priced` items — otherwise the incentive discount is silently reverted and customers get billed base price.
2. `CheckoutPage.tsx` MUST forward `item.meta` in the place-order payload — without it the server never sees `meta.kind === "upsell"`.
3. `upsell_events` insert is guarded by offer-existence + placement whitelist — prevents dashboard pollution from deleted offers.
4. `<UpsellStrip triggerCategoryId>` required for `auto_same_category` — falls back to best sellers otherwise.
5. `post_purchase` placement is UI-disabled in config until the Phase 2 edge fn ships.

### Still to wire on extraction / follow-up
- `V19CartPage.tsx`, `V20CartPage.tsx`, `V22CartPage.tsx` — port the same PreCheckoutModal + UpsellStrip pattern from `CartPage.tsx`.
- `V19ProductDetail.tsx`, `V20ProductDetail.tsx`, `V22ProductDetail.tsx` — port the PDP `<UpsellStrip placement="pdp">` slot.

## Compatibility
- Uses `--storefront-*` CSS tokens — safe across all 20 themes.
- Never recommends bundle-child SKUs when a bundle line exists in cart (filter by cart product IDs).
- Respects wholesale `min_order_qty` (skip products where cart cannot meet MOQ).
- Meta Pixel + CAPI: fires `AddToCart` on add (existing `useFacebookPixel`), `Purchase` handled by existing place-order pixel path.
- Guest + logged-in supported via `session_id` (sessionStorage) / `customer_id`.

## Roadmap
- **Phase 1a (next):** wire PDP + cart page + pre-checkout + cart drawer; place-order upsell expansion.
- **Phase 1b:** analytics dashboard tab in config page (views / adds / revenue / conv-rate).
- **Phase 2:** post-purchase one-click add (edge fn `post-purchase-add-item`, COD-only first, prepaid via saved token later); `auto_frequently_bought` + `auto_ai` strategies; ProductPickerField in config.

## Extraction doc
Full step-by-step at `.lovable/features/upsell-crosssell.md`.