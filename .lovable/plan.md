# Plan — Safe Pixel/CAPI Hardening (Anti-Ban)

## Goal

Eliminate the three technical signals that Meta's spam/quality classifier can read as "low-quality pixel" — without touching any merchant business logic, catalog data, or storefront UI.

All changes are **defensive guards** around existing tracking code. No new events. No removed events. No schema changes.

---

## Fix 1 — PageView hard-navigation dedupe

**Problem:** On a hard reload, `index.html` inline bootstrap fires `PageView`, then `useFacebookPixel` mounts and fires it again → Meta sees 2 PVs per real visit → "inflated/bot-like traffic" signal.

**Change:** In `src/hooks/useFacebookPixel.ts`, when the pixel boots, check a `window.__fbq_pv_fired__` flag set by the inline bootstrap. If true within the same navigation, skip the first auto-PV (still allow SPA route-change PVs).

**Risk:** None — dedupe is per-pageload, route changes still tracked.

---

## Fix 2 — AddToCart rapid-tap dedupe

**Problem:** Multiple taps on "Add to Cart" within 1–2s fire multiple `AddToCart` events for the same product → Meta sees event inflation.

**Change:** In the Add-to-Cart handler (track call site is via `fbPixelTrack("AddToCart", …)` — find call sites in `useProductCardActions.ts`, `ProductDetail.tsx`, V19/V20/V22 PDPs, CartContext), wrap with a 1500ms per-(productId+variantId) dedupe. Cart quantity still increments — only the **tracking event** is throttled.

**Risk:** None — cart UX unchanged. Only the pixel signal is debounced.

---

## Fix 3 — Stale subdomain cookie purge

**Problem:** A user who visited `brand.shopbanao.in` then later visits the merchant's custom domain still carries `_fbp`/`_fbc` cookies scoped to `.shopbanao.in`. Meta cross-references and links the two stores' audiences → all stores look like one site → shared reputation poisoning.

**Change:** Add a one-time client guard (runs once per session) that, on custom-domain hosts only, deletes any cookie whose domain ends with `.shopbanao.in`. New `_fbp` will be minted scoped to the custom domain only.

Location: new file `src/lib/purgeSharedDomainCookies.ts`, called from `StorefrontShell.tsx` mount (custom domain branch only).

**Risk:** None — only deletes cookies on the *wrong* domain. The merchant's own custom-domain cookies are untouched.

---

## Fix 4 — Per-store CAPI hard isolation flag

**Problem:** Both audited stores have `meta_access_token = NULL` so CAPI is already skipped, but the codepath in `firePurchaseCapi` / `fireMetaCAPI` doesn't currently *log* the skip clearly. A future merchant who pastes the wrong store's token will silently send events to the wrong pixel.

**Change:** In `src/lib/metaCapi.ts`, before firing, assert that the `storeId` argument matches the pixel that owns the token (resolved via the store row already in context). If mismatch → no-op and console.warn. No event sent.

**Risk:** None — defensive only. Properly-configured stores unaffected.

---

## Files touched

- `src/hooks/useFacebookPixel.ts` — PV dedupe flag
- `src/lib/metaCapi.ts` — store↔pixel mismatch guard
- `src/lib/purgeSharedDomainCookies.ts` *(new)* — cookie cleanup
- `src/layouts/StorefrontShell.tsx` — call cookie purge once on custom domains
- Add-to-Cart call sites (5 files: `useProductCardActions.ts`, `ProductDetail.tsx`, `V19ProductDetail.tsx`, `V20ProductDetail.tsx`, `V22ProductDetail.tsx`) — wrap pixel call with debounce helper from a new `src/lib/pixelDedupe.ts`

**Not touched:** index.html inline bootstrap, catalog feed, product form, edge functions, worker, database, RLS, any UI.

---

## Verification

1. Open storefront, hard-reload → Network tab shows exactly **one** `tr?…&ev=PageView` request.
2. Spam "Add to Cart" 5×  → exactly **one** `AddToCart` request; cart count still goes to 5.
3. Visit `brand.shopbanao.in` then custom domain → DevTools → Application → Cookies → no `.shopbanao.in`-domain entries remain on the custom domain.
4. Existing single-tap, single-PV, single-purchase flows unchanged.

## Rollout

One PR, all 4 fixes together. Pure additive guards — safe to ship without migration or worker redeploy. do all safely should no issue

&nbsp;