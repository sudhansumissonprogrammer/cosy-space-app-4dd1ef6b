# Bundle Builder v2 — Multi-type upgrade
Built: 2026-07-12
Status: ready-to-extract

## Summary
Adds two new bundle types on top of the v1 Pick-N engine — **Fixed Combo** (curated set of exact products sold together) and **Frequently Bought Together** (anchor + companion products with pre-checked checkboxes). All three types share the same cart contract, server-side pricing dispatcher, and place-order expansion so downstream logic (order_items, coupons, tax, shipping, Meta CAPI, dashboards) is unchanged.

No new database tables, no new edge functions, no new npm dependencies. Everything lives in `store_apps.config.bundles` JSON. Fully backward compatible: legacy Pick-N bundles keep working unchanged.

## Files added
- `src/lib/appStore/bundle/pricingEngine.ts` — shared pure-function pricing engine used for client previews and mirrored inline in `place-order` server code.
- `src/components/storefront/apps/BundleBuilder/FixedBundleCard.tsx` — storefront renderer for `fixed` + `fbt` bundle types on `/bundles/:slug`.

## Files modified
- `src/lib/appStore/bundle/types.ts` — added optional `type`, `discount_mode`, `discount_percent`, `discount_amount`, `fixed_children`, `fbt_anchor_product_ids`, `fbt_companion_product_ids` fields on `BundleDef`; added `BundleType`, `BundleDiscountMode` types + `bundleTypeOf(b)` helper; added `bundle_type` snapshot to `BundleCartMeta`.
- `src/pages/appStore/BundleBuilderConfig.tsx` — 3-way type selector, per-type product pickers (fixed_children, fbt_anchors, fbt_companions), pricing mode selector (flat / % off / ₹ off), per-type save validation. Legacy pool section (categories + manual tweaks) shown only for `pick_n`.
- `src/components/storefront/apps/BundleBuilder/BundleBuilderPage.tsx` — dispatches non-`pick_n` bundles to `FixedBundleCard` after all hooks (React hook order stays stable across bundle switches).
- `supabase/functions/place-order/index.ts` — extended `StoredBundle` type with v2 optional fields; bundle expansion block now type-dispatches — pick_n keeps existing pool + N-child validation; fixed asserts exact `fixed_children` set match; fbt validates every child is anchor or companion + min 2. Server-side total dispatch mirrors client `pricingEngine.ts` (flat / percent_off / amount_off). Never charges more than MRP.

## Data model (additive, all optional)
```ts
BundleDef {
  // v1 fields unchanged...
  type?: "pick_n" | "fixed" | "fbt";           // default "pick_n"
  discount_mode?: "flat" | "percent_off" | "amount_off";  // default "flat"
  discount_percent?: number;                    // percent_off mode
  discount_amount?: number;                     // amount_off mode
  fixed_children?: string[];                    // fixed
  fbt_anchor_product_ids?: string[];            // fbt
  fbt_companion_product_ids?: string[];         // fbt
}
```

## Cart contract (unchanged)
Same `meta.kind === "bundle"` + `children[]` shape. New optional `meta.bundle_type` snapshot for cart UI labelling. Deterministic `variantId = "combo-<hash of sorted child ids>"` keeps distinct combos as separate lines (v1 fix pass rule).

## Server pricing (mirrors client `pricingEngine.ts`)
```
pick_n         → totalPaise = bundle.bundle_price * 100
fixed / fbt:
  flat         → totalPaise = bundle.bundle_price * 100
  percent_off  → totalPaise = round(mrpPaise * (1 - pct/100))
  amount_off   → totalPaise = max(0, mrpPaise - discount_amount*100)
Then clamp: totalPaise = min(totalPaise, mrpPaise)     // never charge above MRP
Split totalPaise across N children (last child absorbs paise remainder).
```

## Known gaps (v2 → v3)
- **PDP embed for FBT** — the strip currently lives only at `/bundles/:slug`. A `<FBTStrip anchorId={product.id} />` component that auto-embeds on `ProductDetail.tsx`, `V19ProductDetail.tsx`, `V20ProductDetail.tsx`, `V22ProductDetail.tsx` should be a follow-up pass.
- **Volume / Tiered discount** (Phase 2 of plan).
- **Variants inside bundles** (Phase 2).
- **BOGO** (Phase 3).
- **Build-a-Box** (Phase 3).
- **Analytics dashboard** (Phase 3) — needs `bundle_events` table.

## EXTRACTION PROMPT (paste in main ShopBanao chat)
```
@shopbanao-sandbox — extract feature "bundle-builder-v2":

Prerequisite: feature "bundle-builder" (v1) must already be extracted.

1. Copy new files:
   - src/lib/appStore/bundle/pricingEngine.ts
   - src/components/storefront/apps/BundleBuilder/FixedBundleCard.tsx

2. Update src/lib/appStore/bundle/types.ts — add:
   - export type BundleType = "pick_n" | "fixed" | "fbt";
   - export type BundleDiscountMode = "flat" | "percent_off" | "amount_off";
   - optional fields on BundleDef: type, discount_mode, discount_percent, discount_amount, fixed_children, fbt_anchor_product_ids, fbt_companion_product_ids
   - optional `bundle_type` on BundleCartMeta
   - export function bundleTypeOf(b): returns b.type || "pick_n"

3. Update src/pages/appStore/BundleBuilderConfig.tsx:
   - Import BundleType, BundleDiscountMode, bundleTypeOf from the types module.
   - newBundle() defaults: type "pick_n", discount_mode "flat", discount_percent 10, discount_amount 0, fixed_children [], fbt_anchor_product_ids [], fbt_companion_product_ids [].
   - Save validation branches per type (see file for exact rules).
   - BundleRow — add `const effType = bundleTypeOf(bundle)` + `const effMode = (bundle.discount_mode || "flat")`.
   - Insert 3-way type selector at top of expanded editor.
   - For non-pick_n: show pricing mode strip (flat / % off / ₹ off) + relevant input.
   - Gate pick_count+bundle_price row inside `effType === "pick_n" && (...)`.
   - Add fixed-combo product picker section (writes bundle.fixed_children).
   - Add fbt section with anchors picker + companions picker.
   - Gate categories + manual product tweaks sections for pick_n only.

4. Update src/components/storefront/apps/BundleBuilder/BundleBuilderPage.tsx:
   - Import bundleTypeOf + FixedBundleCard.
   - After all hooks + the "bundle not found" early return, dispatch:
       if (bundle && bundleTypeOf(bundle) !== "pick_n") return <FixedBundleCard store={store} bundle={bundle} />;
   - CRITICAL: this dispatch MUST come after all React hooks so hook order stays stable.

5. Update supabase/functions/place-order/index.ts BUNDLE EXPANSION block:
   - Extend StoredBundle with v2 optional fields.
   - Replace fixed "pick_count" child-length check with per-type validation:
       pick_n → children.length === bundle.pick_count
       fixed  → children set matches bundle.fixed_children exactly
       fbt    → every child is anchor or companion; children.length >= 2
   - Pool eligibility (include_categories / manual / exclude) only runs when bundleType === "pick_n".
   - Replace hardcoded totalPaise = bundle_price * 100 with dispatcher:
       pick_n              → bundle_price * 100
       fixed/fbt flat      → bundle_price * 100
       fixed/fbt percent   → round(mrpPaise * (1 - pct/100))
       fixed/fbt amount    → max(0, mrpPaise - discount_amount * 100)
     Where mrpPaise = sum of canonical (sale_price ?? price) * 100 per child.
     Clamp: if (totalPaise > mrpPaise && mrpPaise > 0) totalPaise = mrpPaise.
   - N = children.length (was bundle.pick_count). Split total across N paise-safe as before.

6. No migration, no new edge function, no npm dependency.
7. Do not touch anything outside the listed files.
```