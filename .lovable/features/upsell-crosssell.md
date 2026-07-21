# Upsell & Cross-sell App
Built: 2026-07-12
Last updated: 2026-07-12 (Phase 1 wired + payment-integrity audit pass)
Status: ready-to-extract

## Summary
App Store add-on delivering 5 upsell surfaces on one shared rule engine and analytics pipeline:

```text
pdp · cart_drawer · cart_page · pre_checkout · post_purchase
```

Merchants create Offers with a placement set, a trigger (any / product / category / cart_value / cart_qty), a recommendation strategy (manual / auto_best_sellers / auto_same_category / [auto_frequently_bought | auto_ai in Phase 2]), an optional incentive (percent_off / flat_off / free_gift), and display config.

All merchant config lives in `store_apps.config.offers` (JSON, no dedicated tables). One analytics table `public.upsell_events` powers the dashboard.

## Files added
- `src/lib/appStore/upsell/types.ts`
- `src/lib/appStore/upsell/matchEngine.ts`
- `src/lib/appStore/upsell/track.ts`
- `src/hooks/useUpsellOffers.ts`
- `src/components/storefront/apps/Upsell/UpsellStrip.tsx`
- `src/components/storefront/apps/Upsell/PreCheckoutModal.tsx`
- `src/pages/appStore/UpsellCrossSellConfig.tsx`
- `src/components/appStore/MultiProductPicker.tsx` — reusable multi-select product picker (used by config for manual mode + trigger + exclude)
- `supabase/functions/upsell-track/index.ts`
- Migration creating `public.upsell_events` + RLS + GRANTs.

## Files modified
- `src/lib/appStore/registry.ts` — registered `upsell-crosssell` (ShoppingBag icon, `status: "beta"`, `ConfigComponent: lazy(() => import("@/pages/appStore/UpsellCrossSellConfig"))`, `defaultConfig: { offers: [] }`; added `"upsell-crosssell"` to `AppId` union; imported `ShoppingBag`).
- `src/pages/ProductDetail.tsx` — added `useUpsellOffers` + inline `matchOffers` call rendering `<UpsellStrip placement="pdp" triggerCategoryId={product.category_id}>` where the removed FBT block used to sit. **`triggerCategoryId` is required for `auto_same_category` strategy to work** — without it the strip silently falls back to best sellers.
- `src/pages/CartPage.tsx` — added upsell context memo, renders `<UpsellStrip placement="cart_page">` below the items list, and wraps the "Proceed to Checkout" button with `<PreCheckoutModal offers={preCheckoutOffers}>`.
- `src/components/storefront/SideCart.tsx` — replaced legacy `CartUpsell` with `<UpsellStrip placement="cart_drawer">` (matched offers computed with `matchOffers()` locally).
- `supabase/functions/place-order/index.ts` — added **UPSELL EXPANSION** block: for every line-item with `meta.kind === "upsell"`, looks up the offer in `store_apps.config.offers`, verifies active, re-derives the unit price via the incentive rule (percent_off / flat_off / free_gift / none) using the current product's price/sale_price, mutates `item.price`, **and sets `item.__upsell_priced = true`**. After `order_items.insert`, writes one `upsell_events` row per item with `event_type='purchase'` and computed `revenue_paise` — **only if the offer still exists** and `placement ∈ ALLOWED_UPSELL_PLACEMENTS`.

## ⚠️ Critical extraction gotchas (from payment-integrity audit)
These fixes are subtle — miss any and customers get billed wrong. Preserve exactly:

1. **`__upsell_priced` guard in canonical-price override loop.** `place-order` has a loop (near line ~580) that does `item.price = canonicalPrice` for every non-bundle item to prevent client price tampering. Upsell items MUST be excluded or the incentive discount is silently reverted. Pattern:
   ```ts
   const isBundleExpanded = (it as any).__bundle_expanded === true;
   const isUpsellPriced   = (it as any).__upsell_priced   === true;
   if (!isBundleExpanded && !isUpsellPriced) item.price = cp;
   ```
2. **`upsell_events` purchase-row hygiene.** Only insert when: (a) `offer` was found in `store_apps.config.offers`, (b) `placement ∈ {pdp, cart_drawer, cart_page, pre_checkout, post_purchase}`. Sanitize `rawPlacement` via `ALLOWED_UPSELL_PLACEMENTS.has(rawPlacement) ? rawPlacement : "cart_page"` before insert. Prevents dashboard pollution from deleted/renamed offers.
3. **`CheckoutPage.tsx` must forward `item.meta`** in the `place-order` invocation payload (line ~1328 in sandbox). Without it the upsell branch never fires and customer is billed base price.
4. **`UpsellStrip.tsx` `silent` prop.** When the cart drawer / cart page / pre-checkout modal is already open, `handleAdd` should silent-add (no toast, no drawer re-open). Prop wiring exists on all placements — preserve.
5. **`UpsellStrip.tsx` `embedded` prop.** Set on `<UpsellStrip>` inside `PreCheckoutModal` to remove redundant heading/divider.
6. **`PreCheckoutModal` session dedup.** Uses `sessionStorage['upsell_precheckout_shown_<store_id>']` to show at most once per cart session. Preserve.
7. **`UpsellCrossSellConfig.tsx` — `post_purchase` placement is disabled ("Coming soon").** Do NOT re-enable until `post-purchase-add-item` edge fn ships (Phase 2). Also keep the "Manual mode with 0 products" validation warning.
8. **`UpsellOffer.trigger.type === "category"`** requires `triggerCategoryId` prop on `<UpsellStrip>` from the PDP (`product.category_id`). Cart placements pass first item's category.

## Payment / checkout compatibility (verified in sandbox)
- Bundle expansion and upsell expansion operate on disjoint items (`meta.kind` mutually exclusive) — no crosstalk. Run bundle first, then upsell.
- All 3 gateways (Razorpay, Cashfree, PayU) reload `orders.total` from DB — post-upsell discounted total is what the customer actually pays.
- Cashfree webhook validates paid amount vs `orders.total`/`advance_paid` — rejects mismatched captures.
- Coupons, free-shipping thresholds, tax (inclusive + exclusive), prepaid discount, partial-payment advance all compute on the already-discounted `serverSubtotal`.
- Meta CAPI Purchase event matches client Pixel `cartTotal` (both include discounted upsell price).
- Free-gift incentive (price=0): serverSubtotal contribution=0. Razorpay rejects total ≤ 0 so accidental all-free carts can't be charged online. COD-only in that edge case.

## Files deleted
- `src/components/storefront/CartUpsell.tsx` — replaced by `UpsellStrip`.

## Wiring to complete on extraction (Phase 1a)
### Storefront placement mounts
1. **PDP** — in `src/pages/ProductDetailPage.tsx` (+ all V10-V22 variants), below "Add to cart":
   ```tsx
   const offers = useMatchedUpsellOffers(storeSlug, ctx, "pdp");
   <UpsellStrip storeId={storeId} currency={currency} offers={offers} placement="pdp" excludeProductIds={[product.id]} />
   ```
2. **Cart page** — in `CartPage.tsx`, `V19CartPage.tsx`, `V20CartPage.tsx`, `V22CartPage.tsx`, below line items:
   ```tsx
   const offers = useMatchedUpsellOffers(storeSlug, ctx, "cart_page");
   <UpsellStrip storeId={storeId} currency={currency} offers={offers} placement="cart_page" excludeProductIds={items.map(i=>i.productId)} />
   ```
   And wrap the checkout CTA:
   ```tsx
   const preCheckout = useMatchedUpsellOffers(storeSlug, ctx, "pre_checkout");
   <PreCheckoutModal offers={preCheckout} storeId={storeId} currency={currency} onProceed={goToCheckout}>
     <Button>Proceed to checkout</Button>
   </PreCheckoutModal>
   ```
3. **Cart drawer** — in `src/components/storefront/SideCart.tsx`, replace `<CartUpsell />` with `<UpsellStrip placement="cart_drawer" ... />`. Legacy `src/components/storefront/CartUpsell.tsx` can be deleted after Phase 1a stable.

### Server-side (`place-order`) — UPSELL EXPANSION
Mirror the bundle expansion pattern. Before order insert, for every `item.meta?.kind === "upsell"`:
1. Load `store_apps.config.offers` for the store; find the referenced offer id.
2. Re-derive incentive from the offer (never trust `incentive_snapshot`).
3. Recompute `unit_price` using the same formula as `applyIncentivePreview()`.
4. Write the order_items row with the corrected price.
5. After successful `orders.insert`, emit an `upsell_events` row: `event_type='purchase'`, `revenue_paise=Math.round(final_price*100)`, `order_id`, `product_id`.

### Config UX polish (Phase 1b)
- Swap the manual-mode textarea for `ProductPickerField` (already used by Bundle Builder).
- Add analytics tab: views / adds / revenue / conversion per offer, last 30d, aggregated from `upsell_events`.
- Add category picker for `trigger.type === "category"`.

### Phase 2 (post-MVP)
- `supabase/functions/post-purchase-add-item/index.ts` — order-token-authed, COD-only add-to-order path.
- `supabase/functions/upsell-recommendations/index.ts` — implements `auto_frequently_bought` (90d co-purchase query, KV-cached) + `auto_ai` (Lovable AI Gateway `google/gemini-2.5-flash`, fallback to best sellers).
- Replace `<PostPurchaseUpsell />` on thank-you page with new `<PostPurchaseCard />`.
- Delete `src/components/storefront/CartUpsell.tsx` + `src/components/storefront/PostPurchaseUpsell.tsx`.

## Data model
### `public.upsell_events`
Columns: `id, store_id, offer_id, placement, event_type ('view'|'click'|'add'|'purchase'), product_id, order_id, revenue_paise, session_id, customer_id, meta, created_at`.

Indexes: `(store_id, created_at desc)`, `(store_id, offer_id, event_type)`.

RLS: store owner reads own via `stores.owner_id = auth.uid()`. No client INSERT — only service_role via `upsell-track` edge function.

### `store_apps.config.offers`
`UpsellOffer[]` — see `src/lib/appStore/upsell/types.ts` for the exact shape.

## Cart contract
`CartItem.meta = { kind: "upsell", offer_id, placement, incentive_snapshot }` — same optional `meta` field bundle uses. No schema change; the field is already on `CartItem` from the bundle extraction.

## EXTRACTION PROMPT (paste in main ShopBanao chat)
```
@shopbanao-sandbox — extract feature "upsell-crosssell":
1. Read `.lovable/features/upsell-crosssell.md` in the attached project.
2. Copy every file under "Files added" to the same path here.
3. Apply the change under "Files modified" to `src/lib/appStore/registry.ts`.
4. Run the migration creating public.upsell_events (grants + RLS + indexes; see `.lovable/memory/features/upsell-crosssell.md`).
5. Wire the storefront placements as described under "Wiring to complete on extraction" — PDP, cart page (all 4 variants), cart drawer, and pre-checkout modal.
6. Add the UPSELL EXPANSION block in `supabase/functions/place-order/index.ts` mirroring the existing BUNDLE EXPANSION.
7. Test end-to-end: create an offer with placement=cart_page, auto_best_sellers, no incentive → visible on storefront cart → add → cart line has meta.kind === "upsell" → checkout → order_items priced correctly → upsell_events row with event_type='purchase' present.
```