# Google Ads + Tracking Setup for Storefronts (Kalinga first)

## Goal
Let any store run Google Ads with accurate conversion tracking, starting with Kalinga Jewels. Off by default for every store; enabled per store from the dashboard, same pattern as the Meta Pixel.

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
- Google Tag Manager is optional — Google itself says the plain Google tag does the same job. GTM adds an extra container script on every page (slower). Plan supports both, defaults to the plain tag.

## Build plan

### 1. Per-store Google settings (dashboard)
- New fields on the store's tracking settings section (next to Meta Pixel / GA4):
  - Google Ads Conversion ID (`AW-XXXXXXXXX`)
  - Purchase Conversion Label
  - Optional: Google Tag Manager Container ID (`GTM-XXXX`) — only used if filled
- Stored in `stores.features` (same place as `ga4_measurement_id`). No DB migration needed.

### 2. Storefront tag loading (`useGA4.ts` / new `useGoogleAds.ts`)
- If `features.google_ads_id` set: reuse the already-loaded gtag.js, call `gtag('config', 'AW-…')`. **Zero extra script download.**
- If only GTM ID set: load the GTM container script deferred (after main photo, idle callback) so speed is untouched.
- Production hosts only, same guard as GA4/Meta.

### 3. Conversion events (new `src/lib/trackGoogleAds.ts`, mirrors `trackInitiateCheckout.ts`)
- `view_item` on PDP open, `add_to_cart`, `begin_checkout` (wired into the existing shared checkout tracker).
- `purchase` on the order-confirmation page only, with:
  - `transaction_id` = order ID (reload-safe dedup)
  - `value`, `currency: INR`
  - Enhanced conversions: SHA256-hashed phone + email from checkout
  - sessionStorage guard so it fires once per order (same pattern as Meta purchase)
- COD and prepaid both fire on confirmation; cancelled/failed payments never fire.

### 4. gclid saved on the order
- Checkout reads gclid from sessionStorage (already captured) and stores it in the order's metadata.
- Enables offline conversion import later (e.g. mark only delivered orders as conversions) with no extra tracking code.

### 5. Google Merchant Center feed (for Shopping ads)
- New edge function `google-product-feed?slug=<store>` mirroring `meta-product-feed`, output in Google's TSV format (id, title, description, link, image_link, price, sale_price, availability, condition, brand, google_product_category).
- Paste the URL into Merchant Center → scheduled fetch. Needed only if/when running Shopping ads.

### 6. Enable for Kalinga Jewels
- You create the Google Ads conversion actions in your Google Ads account and give me the AW- ID + purchase label (or the GTM container ID if you prefer Tag Manager).
- I enter them for Kalinga only, verify with a real test order flow that the purchase tag fires once with the right value.

## Speed safety (hard rules)
- No new render-blocking scripts; Google tag reuses the existing gtag.js file.
- GTM (if ever used) loads after the main photo, never before.
- PDP instant-preview, image budgets, and all existing performance work untouched.
- No consent banner added (per project policy).

## Not included (tell me if you want these)
- Server-side GTM / Google Ads API offline uploads (phase 2, needs Google Ads API credentials).
- GA4 e-commerce reporting wiring (GA4 already gets begin_checkout; can add purchase).

## Verification
- Test order on Kalinga: confirm purchase tag fires once with correct value + transaction ID (browser network tab + Google Ads "Tag diagnostics").
- Confirm no extra scripts on stores with Google Ads off, and page-speed unchanged on Kalinga PDP.
