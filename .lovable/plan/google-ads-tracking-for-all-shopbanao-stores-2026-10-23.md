# Google Ads + Tracking for ALL ShopBanao Stores

## Goal
Every store on ShopBanao can run Google Ads with accurate conversion tracking. Each store owner enters their own Google Ads ID in the dashboard (same pattern as the Meta Pixel). Off by default; works the moment a store fills in its IDs.

## What we already have (audit result)
- `useGA4.ts` loads gtag.js per store (`features.ga4_measurement_id`), production hosts only.
- Meta Pixel + CAPI with shared event IDs, purchase dedup, per-store `facebook_pixel_id`.
- Pageview beacon already captures **gclid** (Google click ID) into sessionStorage.
- `meta-product-feed` edge function serves a per-store catalog CSV — a proven template for a Google feed.
- Checkout already collects phone/email; orders have unique IDs.

## What Google needs (researched)
- Google tag (gtag.js) with the store's **AW- conversion ID**, plus a **conversion label** per action.
- **Purchase** conversion must send a unique `transaction_id` (order ID) so reloads never double-count ([Google docs](https://support.google.com/google-ads/answer/6386790)).
- **Enhanced conversions**: SHA256-hashed phone/email sent with the tag improves match rate; from April 2026 it's one unified on/off setting in Google Ads ([Google docs](https://support.google.com/google-ads/answer/13262500)).
- Google Tag Manager is optional — the plain Google tag does the same job with less code. Plan supports both, defaults to the plain tag for speed.

## Build plan

### 1. Per-store Google settings (dashboard, every store)
- New fields in the store's tracking settings (next to Meta Pixel / GA4):
  - Google Ads Conversion ID (`AW-XXXXXXXXX`)
  - Purchase Conversion Label
  - Optional: Google Tag Manager Container ID (`GTM-XXXX`) — only used if filled
- Stored in `stores.features` (same place as `ga4_measurement_id`). No DB migration needed.

### 2. Storefront tag loading (all storefronts)
- If `features.google_ads_id` set: reuse the already-loaded gtag.js, call `gtag('config', 'AW-…')`. **Zero extra script download.**
- If only GTM ID set: load the GTM container deferred (after main photo, idle callback) so page speed is untouched.
- Production hosts only, same guard as GA4/Meta. Stores with nothing filled: no change at all.

### 3. Conversion events (new `src/lib/trackGoogleAds.ts`, mirrors `trackInitiateCheckout.ts`)
- `view_item` on PDP open, `add_to_cart`, `begin_checkout` (wired into the existing shared checkout tracker).
- `purchase` on the order-confirmation page only, with:
  - `transaction_id` = order ID (reload-safe dedup)
  - `value`, `currency: INR`
  - Enhanced conversions: SHA256-hashed phone + email from checkout
  - sessionStorage guard so it fires once per order (same pattern as Meta purchase)
- COD and prepaid both fire on confirmation; cancelled/failed payments never fire.

### 4. gclid saved on the order (all stores)
- Checkout reads gclid from sessionStorage (already captured) and stores it in the order's metadata.
- Enables offline conversion import later (e.g. count only delivered orders) with no extra tracking code.

### 5. Google Merchant Center feed (for Shopping ads, any store)
- New edge function `google-product-feed?slug=<store>` mirroring `meta-product-feed`, output in Google's TSV format (id, title, description, link, image_link, price, sale_price, availability, condition, brand, google_product_category).
- Any store owner pastes their URL into Merchant Center → scheduled fetch. Needed only for Shopping ads.

### 6. Rollout
- Works for every store as soon as they enter their IDs — Kalinga, Serdiya, Sanvariya, and all future stores.
- For Kalinga specifically: you create the conversion actions in your Google Ads account, give me the AW- ID + purchase label, I enter them and verify with a test order.

## Speed safety (hard rules)
- No new render-blocking scripts; Google tag reuses the existing gtag.js file.
- GTM (if a store uses it) loads after the main photo, never before.
- PDP instant-preview, image budgets, and all existing performance work untouched.
- No consent banner added (per project policy).

## Not included (tell me if you want these)
- Server-side GTM / Google Ads API offline uploads (phase 2, needs Google Ads API credentials).
- GA4 e-commerce reporting wiring (GA4 already gets begin_checkout; can add purchase).

## Verification
- Test order on Kalinga: purchase tag fires once with correct value + transaction ID (browser network tab + Google Ads Tag diagnostics).
- Confirm zero extra scripts on stores with Google Ads off, and page speed unchanged.
