# Post-update storefront performance audit

## Scope and method

Tested Imitation World homepage, Chain with Pendant category, and Radhe pendant PDP on the public custom domain after the user's publishing/Worker update. Fresh Chromium contexts, cache disabled, mobile 390×844 and desktop 1280×1800, 150 ms latency, 200 KB/s download, 35 seconds of observation after DOMContentLoaded. Mobile live entries repeated three times; desktop once. These are controlled browser observations, not Lighthouse scores or real-user Core Web Vitals. The tall desktop viewport intentionally activates more visible rows.

No production order, payment, OTP, or message was created. Checkout verification stops at the phone-entry screen.

## Live measurements before this turn's new changes

| Mobile entry (three runs) | Unique product-photo URLs | Main-content paint (LCP), median | Layout shift (CLS), median | Total encoded transfer, median |
|---|---:|---:|---:|---:|
| Homepage | 21–22 | 16.05 s | 0.478 | 4.48 MB |
| Category | 13 | 12.56 s | 0.076 | 4.03 MB |
| PDP | 6 | 4.61 s | 0.015 | 2.28 MB |

Desktop single-run results: homepage 44 photos / LCP 28.75 s / CLS 1.632; category 33 photos / LCP 16.24 s / CLS 0.898; PDP 12 photos / LCP 6.46 s / CLS 0.217. Single-run desktop figures are diagnostic, not stable benchmarks.

Product-photo counts exclude logos, badge graphics and other images. Mobile opening network requests included 40/45/63 script requests and seven font requests for home/category/PDP respectively; request counts alone do not establish script execution cost.

### Deployment evidence

The updated Worker now emits two 800w category photo preloads. However, fetched public category HTML still contained the older `injected<6` inline loader, raw photo hints, PDP extra-gallery hint loop, and `display=block` fallback. This is a served HTML finding; it does not establish whether the cause is publication timing or stale edge/origin HTML.

The old inline loader adds six 1200w URLs on the category despite the Worker's correct 800w hints. Every mobile repeat downloaded six 800w card photos, six unnecessary 1200w photos, plus one raw photo.

## Changes made and checked

- Inline photo hints are now route-scoped: one PDP main photo, at most two known card variants on categories, no arbitrary homepage catalog preloads or saved homepage photo hints.
- Known timestamped canonical uploads map to actual 400w/800w card siblings. Raw imports and unknown/single-file families are preserved.
- Category/PDP bootstrap no longer starts an unrelated homepage product fetch.
- Fallback Google font loading no longer asks for `display=block`.
- Category collage photo sources wait for actual visibility, including clipping in horizontal strips and hidden desktop/mobile branches.
- Three homepage banner implementations defer nonvisible slides and only begin rotation after interaction, respecting reduced-motion preferences.
- Category hooks reuse categories already present in the public shell cache rather than racing its parent seeding effect with an extra request; no permissions were widened.
- New manually uploaded product-photo families include a real 160px derivative. A `thumb160` family marker proves that the sibling exists; existing families continue their old fallback. Existing images and raw Meesho imports were not recompressed or overwritten. This does **not** backfill tiny photos for the current catalogue.
- Twenty automated tests passed; latest observed preview compilation succeeded.

### Photo request verification

Unthrottled cache-disabled preview, 15 s opening:

- Category: six product-path photos, five 800w plus one raw; zero 1200w/2000w. Scrolling activates four additional images.
- PDP: one 1200w main photo plus five visible 800w Similar designs photos; exactly one sourced gallery slide, thirteen similar links, zero opening 2000w.
- Zoom requests the 2000w file only after opening.

An isolated browser experiment intercepted **only the category document in the test browser**, substituted the corrected inline loader, and retained the published JavaScript/CSS and live data. Three slow-network repetitions consistently downloaded seven product-path photos (six 800w plus one raw) and **zero 1200w/2000w**. The live site itself was not modified by this experiment. This establishes the inline loader's role in all six duplicate requests without treating a development-server speed as a production benchmark.

The slow localhost trials contain Vite development modules (~7–8 MB) and several images still downloading at screenshot time. Their LCP/transfer values cannot be compared to published production bundles and are deliberately not advertised as improvements. They showed no horizontal overflow or JavaScript page errors, but did show remaining layout movement.

## Shopping checks

- Live Radhe pendant: thirteen Similar designs links; first link opened the intended Mahakal product.
- Live and preview Elegant Aura PDP: one gallery photo on entry; selecting slide two requested exactly its second 1200w photo. No page errors.
- Live zoom: on-demand 2000w photo verified; close button works. Escape did not close this custom lightbox in the test, so keyboard behavior remains an accessibility gap.
- Live cart: add succeeded and expected item appeared; checkout link opened `/checkout` with the item and phone-entry screen.
- No phone number submitted; address, OTP, payment handoff, payment completion, and Purchase deduplication remain untested.
- Facebook SDK and pixel configuration script downloaded. No PageView/ViewContent/AddToCart/InitiateCheckout transmission was captured by the test request filter; event delivery is **unverified**, not passed. Server-side CAPI and deduplication require a dedicated trace.

## Remaining work — not a completion claim

1. Publish this turn's frontend changes, then verify the served HTML no longer contains the old six-photo loader; purge affected HTML caches if necessary. No further Worker edit was made in this turn.
2. Backfill genuine tiny derivatives for existing Similar designs, category collage and gallery thumbnail photos using an explicit manifest/family mapping; preserve original imported media. The current Similar rail still costs five 800w downloads on mobile.
3. Homepage and desktop category CLS remain excessive. Category placeholders, late inserted merchandising/rows, font swaps, and per-theme card skeleton geometry need attribution traces and targeted fixes; this audit does not claim they are solved.
4. The public homepage had two `get_storefront_categories` HTTP 401 responses per cold visit. Shell-cache reuse was added; repeat live after publishing and investigate any residual endpoint failures without loosening customer-data access.
5. Current catalogue data differed between cached public pages and preview: some visited products showed older titles/prices on live navigation. Validate product-cache consistency separately; no price/title records were changed during this performance audit.
6. Managed Festival Sale images rendered publicly but appeared broken on localhost screenshots. Verify the preview asset-serving path; do not replace the supplied artwork merely to conceal the issue.
7. Broader stores/themes, videos, touch-swipe gestures, variants, checkout beyond phone entry and ad-event delivery still require regression checks. Representative tests here do not establish every store is complete.

**Conclusion:** the Worker update is visible, and the category's duplicate-download source is now isolated and corrected in source. PDP main-photo scheduling and shopping-to-checkout opening work. Full performance optimization and live rollout are not yet complete.