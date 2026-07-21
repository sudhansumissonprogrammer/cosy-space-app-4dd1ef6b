# Bundle Builder
Built: 2026-07-12
Last updated: 2026-07-11 (P0/P1 bug-fix pass)
Status: ready-to-extract

## Summary
App Store add-on that lets merchants create unlimited "Pick N products for ₹X" bundles. Each bundle has a name, banner, price, and product pool (by category, manual include, manual exclude). A "Bundles (N)" menu is auto-injected into the storefront hamburger + desktop nav when at least one bundle is active. Shoppers browse `/bundles` (index) and build a combo on `/bundles/:slug` with a sticky N/N selection bar, then add it to cart as a single bundle line item.

## Files added
- `src/lib/appStore/bundle/types.ts`
- `src/hooks/useBundleMenu.ts`
- `src/pages/appStore/BundleBuilderConfig.tsx`
- `src/components/storefront/apps/BundleBuilder/BundlesIndexPage.tsx`
- `src/components/storefront/apps/BundleBuilder/BundleBuilderPage.tsx`

## Files modified
- `src/lib/appStore/registry.ts` — registered the `bundle-builder` app (Package icon, live, ConfigComponent).
- `src/App.tsx` — added storefront routes `bundles` and `bundles/:bundleSlug` inside `storefrontChildRoutes`.
- `src/components/storefront/HamburgerMenu.tsx` — injects "Bundles (N)" menu item when active bundles exist.
- `src/components/storefront/DesktopNavBar.tsx` — same injection for desktop nav.
- `src/contexts/CartContext.tsx` — added optional `meta` to `CartItem` so bundle payloads survive cart persistence + checkout serialization.
- `src/pages/CheckoutV2Page.tsx`, `src/pages/CheckoutPage.tsx`, `src/pages/V22CheckoutPage.tsx` — forward `item.meta` when building the `place-order` payload.
- `src/pages/CartPage.tsx` — renders child-product thumbnails under a bundle line-item so shoppers can see what's inside their combo.
- `src/pages/appStore/BundleBuilderConfig.tsx` — save-time validation: non-empty name, `pick_count 1–20`, `bundle_price > 0`, non-empty product pool.
- `supabase/functions/place-order/index.ts` — **bundle expansion**: any incoming line-item with `meta.kind === "bundle"` is resolved against `store_apps.config.bundles`, its N children are re-validated against the pool + stock + store, and the single bundle line is REPLACED with N real `order_items` rows priced at `bundle_price / N` (last child absorbs paise rounding). Downstream pricing, coupon, tax, shipping, stock and Meta CAPI logic is unchanged.

## Bug-fix pass (2026-07-11)
All six P0/P1 issues from the audit are now patched. Extract these along with the base feature.

### Files added (fix pass)
- `src/lib/expandBundleForPixel.ts` — helper that expands bundle line-items into real product ids for Meta Pixel `content_ids` / `contents`. Exported: `expandItemsForPixel()`, `pixelPayloadFromItems()`.

### Files modified (fix pass)
- `src/pages/CartPage.tsx` —
  (a) filter synthetic `bundle:<uuid>` ids out of the wholesale MOQ `products.in(id, [...])` query (Postgres 22P02 crash on wholesale stores);
  (b) skip synthetic ids in the auto-clamp MOQ loop;
  (c) new "Edit combo" link next to bundle children that routes back to `/bundles/:bundle_slug` on the cart card.
- `src/components/storefront/apps/BundleBuilder/BundleBuilderPage.tsx` —
  (a) `submitting` guard around "Order Combo" so rapid taps don't double-add;
  (b) deterministic `variantId = "combo-<hash of sorted child ids>"` passed to `addToCart` so two distinct combos of the same bundle stay as separate cart lines instead of merging via `productId=bundle:<id>`;
  (c) button label flips to "Adding…" while pending.
- `src/pages/CheckoutPage.tsx` — imports `pixelPayloadFromItems`; `InitiateCheckout` and `AddPaymentInfo` now send expanded child `content_ids` / `contents` instead of the fake `bundle:<uuid>` id (fixes Meta EMQ + catalog matching pre-purchase). Same swap should be applied to `CheckoutV2Page.tsx` + `V22CheckoutPage.tsx` (same pattern — only CheckoutPage was patched in the fix pass; the other two use identical prop shape, extraction should port the swap).
- `supabase/functions/place-order/index.ts` — inside the BUNDLE EXPANSION block, added a stock guard: rejects the whole bundle with `"<name> is out of stock"` if any child has `stock_quantity !== null && < 1`. Null stock is treated as unlimited (matches PDP behavior).

### Summary of the 6 fixes
1. **Wholesale MOQ crash** — synthetic `bundle:<uuid>` ids no longer hit `products.in(id, uuid[])`.
2. **Rapid-tap double-add** — `submitting` state disables Order Combo during navigation.
3. **Distinct combos merging** — children-signature `variantId` keeps different picks separate.
4. **Edit combo link** — shoppers can jump back to the bundle page from cart.
5. **Meta pre-purchase EMQ** — `InitiateCheckout` + `AddPaymentInfo` send real child ids via `pixelPayloadFromItems()`. Purchase already used real ids (server rewrites order_items).
6. **Child stock guard** — `place-order` refuses to create the order if any child is out of stock, before charging or reserving anything.

## Dependencies added
None. Uses existing shadcn UI, react-query, lucide-react, sonner, MediaLibraryPicker.

## Backend assumptions
- Reuses existing `public.store_apps` table + `get_store_enabled_apps(_store_slug)` RPC — **no migration required**.
- Bundles are stored inside `store_apps.config.bundles` as a JSON array (`BundleDef[]` — see `src/lib/appStore/bundle/types.ts`).
- Cart line-item carries a `meta.kind === "bundle"` payload with `bundle_id`, `bundle_slug`, `pick_count`, and `children[]`. **`place-order` now expands this server-side** into N real `order_items` rows so invoicing, shipping, dashboards, stock and Meta CAPI all see per-product lines. Bundle price is split `bundle_price / N` with the last child absorbing rounding remainder.

## EXTRACTION PROMPT (paste in main ShopBanao chat)
```
@shopbanao-sandbox — extract feature "bundle-builder":
1. Read `.lovable/features/bundle-builder.md` in the attached project.
2. Copy every file under "Files added" to the same path here:
   - src/lib/appStore/bundle/types.ts
   - src/hooks/useBundleMenu.ts
   - src/pages/appStore/BundleBuilderConfig.tsx
   - src/components/storefront/apps/BundleBuilder/BundlesIndexPage.tsx
   - src/components/storefront/apps/BundleBuilder/BundleBuilderPage.tsx
   - src/lib/expandBundleForPixel.ts     (added in fix pass — used by all 3 checkout pages)
3. Apply the changes under "Files modified" to the corresponding files here:
   - src/lib/appStore/registry.ts — add `bundle-builder` entry with Package icon, `status: "live"`, `ConfigComponent: lazy(() => import("@/pages/appStore/BundleBuilderConfig"))`, `defaultConfig: { bundles: [] }`; add `"bundle-builder"` to the `AppId` union; import `Package` from lucide-react.
   - src/App.tsx — inside `storefrontChildRoutes`, add `<Route path="bundles" element={<BundlesIndexPage />} />` and `<Route path="bundles/:bundleSlug" element={<BundleBuilderPage />} />`, plus their lazy imports at the top.
   - src/components/storefront/HamburgerMenu.tsx — import `useBundleMenu` + `Package`; between Contact and customPages, render a Bundles link with count badge when `bundleCount > 0`.
   - src/components/storefront/DesktopNavBar.tsx — import `useBundleMenu`; between About Us and customPages, render the Bundles link with count badge when `bundleCount > 0`.
   - src/contexts/CartContext.tsx — add optional `meta?: Record<string, any>` to the `CartItem` interface.
   - src/pages/CheckoutV2Page.tsx / CheckoutPage.tsx / V22CheckoutPage.tsx — inside the `cartItems.map(...)` that builds `checkoutItems`, forward `meta: (i as any).meta`; and inside the `place-order` invoke `items.map(...)`, forward `meta: (it as any).meta`.
   - src/pages/CartPage.tsx —
     (a) render thumbnail row of `item.meta.children` under bundle items;
     (b) filter synthetic `bundle:*` ids out of the wholesale MOQ `products.in("id", productIds)` query (or Postgres 22P02 crashes wholesale stores);
     (c) skip synthetic ids in the auto-clamp MOQ loop;
     (d) render an "Edit combo" link to `/bundles/:bundle_slug` in the bundle-children row.
   - src/components/storefront/apps/BundleBuilder/BundleBuilderPage.tsx —
     (a) add a `submitting` state guard so rapid taps on "Order Combo" can't double-add;
     (b) pass a deterministic `variantId = "combo-<hash of sorted child ids>"` to `addToCart` so distinct combos of the same bundle keep separate cart lines;
     (c) button label flips to "Adding…" while pending.
   - src/pages/CheckoutPage.tsx / CheckoutV2Page.tsx / V22CheckoutPage.tsx —
     import `pixelPayloadFromItems` from `@/lib/expandBundleForPixel` and use it in the `InitiateCheckout` + `AddPaymentInfo` payload builders (replace the `content_ids`/`contents`/`num_items` triple with `...pixelPayloadFromItems(checkoutItems)`). Fixes Meta EMQ + catalog matching for the pre-purchase funnel.
   - supabase/functions/place-order/index.ts — port the "BUNDLE EXPANSION" block that runs BEFORE the products lookup: for every item where `meta.kind === "bundle"`, load `store_apps.config.bundles` for this store, validate the bundle + children (active, in pool, in stock, correct pick_count) and replace the synthetic `bundle:<uuid>` line with N real `order_items` rows priced at `bundle_price / N`. Mark those items with `__bundle_expanded: true` and skip the canonical re-pricing loop for them so the split price sticks.
     Also port the stock guard: inside the per-child validation loop, `if (p.stock_quantity !== null && Number(p.stock_quantity) < 1)` returns a 400 with "<name> is out of stock". Null stock = unlimited.
4. No migration, no edge function, no new npm dependency.
5. Do not touch anything outside the listed files.
```

## Known gaps (v2 ideas)
- Variant selection inside a bundle (v1 = parent product only).
- Percent-off bundle math + tiered bundles ("3 for ₹899 OR 5 for ₹1299" in one entity).
- Bundle-specific coupons + analytics dashboard.
- Meta Pixel / CAPI `AddToCart` currently reports the synthetic `bundle:<id>` content_id instead of the N child SKUs (CAPI still fires for Purchase because expansion writes real product rows — Meta enrichment picks those up from `order_items`).
- "Max repeat per product" cap inside a single bundle.