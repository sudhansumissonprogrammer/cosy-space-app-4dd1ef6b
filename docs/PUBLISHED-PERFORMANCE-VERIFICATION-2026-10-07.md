# Published performance verification — 7 October 2026

## Verdict

The latest changes are live on imitationworld.in. Category/PDP photo scheduling and small-copy delivery pass the representative checks, but overall performance is not finished: homepage photo activation and layout movement, desktop layout movement, opening script/font weight, advertising-event delivery, and inconsistent product/cart/checkout data remain concerns.

No application code, customer records, orders, payments, OTPs, or notification services were changed. A cart was created only in a disposable browser session.

## Method

- Actual published custom-domain homepage, `/category/chain-with-pendant`, and `/product/new-micro-gold-plated-chain-pendant-hp04dx`; no HTML replacement or intercepted substitutions.
- Three fresh contexts per mobile entry: effective 390×844 CSS viewport, DPR 2, 150 ms latency, 200 KiB/s download, 100 KiB/s upload, 4× CPU slowdown, browser cache disabled, service workers blocked, 35 seconds observed after DOMContentLoaded. Runs were sequential, not a load test.
- One diagnostic desktop run per entry at 1280×1800 under the same throttling. Tall desktop activates more visible rows.
- LCP from PerformanceObserver; CLS calculated using maximum layout-shift session window. Transfer includes completed CDP encoded transfers and HTTP overhead, not unfinished requests. Photos are unique requested URLs under both `/product-images/` and `/products/`; small asset copies counted separately.
- These are controlled Chromium observations, not Lighthouse scores or real-user Core Web Vitals. The earlier audit did not apply CPU slowdown, so its timings are not a like-for-like speed comparison.
- Screenshot capture used CDP on mobile to preserve emulated dimensions; ordinary Playwright screenshots reset the CDP emulation in the first exploratory batch. The reported three-run batch was repeated with corrected capture and photo counting. Earlier exploratory figures are not the reported baseline.

## Mobile results

| Page | Median LCP | Median CLS | Median transfer | Unique original product-photo URLs | Opening scripts | Fonts |
|---|---:|---:|---:|---:|---:|---:|
| Homepage | 11.88 s | 0.467 | 3.81 MB | 18–19 | 47 | 7 |
| Category | 7.99 s | 0.060 | 1.79 MB | 5 | 52 | 7 |
| PDP | 5.14 s | 0.002 | 1.94 MB | 1 | 70–72 | 7 |

LCP ranges: homepage 11.30–15.39 s, category 7.34–9.02 s, PDP 4.72–8.24 s. All remain above the usual good LCP threshold of 2.5 s in this constrained setup. Category and PDP mobile CLS are below 0.1; homepage is not.

Opening script encoded transfer: approximately 702 / 754 / 845 KiB for home/category/PDP; fonts approximately 150 KiB each. These include third-party scripts. Observed long-task blocking sums were substantial (mobile medians approximately 3389 / 1628 / 1508 ms respectively); this is a 35-second observer diagnostic, not Lighthouse TBT. It does not establish that the earlier unused-JS/CSS warnings are resolved.

## Photo and deployment checks

- Served HTML contains the route-scoped v8.74 loader; the old `injected<6` loader is absent. Inline data may contain gallery URLs without downloading them: payload URLs are not request counts.
- Category: four 800w card files plus one raw/legacy file on mobile; zero 1200w and zero 2000w product photos in all three reported cold runs. Five opening photos are within the intended 4–6 range.
- Normal mobile scrolling to 1200 CSS pixels activated eight additional unique product photos, all 800w; no extra 1200w photos were observed in that check.
- PDP: exactly one unique full-size 1200w main-photo URL on opening, no 800w full-size Similar-design photos and no opening 2000w zoom. Small copies work: 11 unique small asset URLs appeared on mobile PDP; this is all small assets requested during observation, not eleven Similar tiles or gallery photos.
- A cache-disabled PDP sometimes requested the same main 1200w URL twice (two runs). A separate fresh normal-cache mobile run requested it once. Distinct card/PDP variant duplication is resolved on the tested category; absolutely zero repeated requests under forced cache disabling is not claimed.
- Homepage: 14 small-copy URLs, but still 18–19 original product-photo URLs without scrolling. Some originals appear in category collage paths not covered by the explicit manifest; moving/replaced sections also activate photos. This remains too broad an opening set.
- No HTTP 4xx/5xx responses, JavaScript page errors, or horizontal document overflow were observed in the reported cold runs. This is bounded evidence, not a whole-site availability guarantee.

## Desktop diagnostics

| Page | LCP | CLS | Transfer | Unique original product-photo URLs |
|---|---:|---:|---:|---:|
| Homepage | 23.26 s | 0.218 | 5.51 MB | 30 |
| Category | 7.52 s | 0.731 | 4.11 MB | 25 |
| PDP | 7.64 s | 0.338 | 2.86 MB | 13 |

Single-run desktop data is not a stable benchmark. Observer evidence shows homepage sections moving by roughly 524 px; category stagger-card boxes collapsing from approximately 412 px to 2 px and the footer moving; PDP footer moving from y≈818 to y≈1749 while content replaces the opening state. Targeted placeholder/section-geometry investigation is required; exact source causes have not been proven by these traces alone.

## Shopping interactions

Separate unthrottled published checks on Elegant Aura multi-photo PDP:

- Exactly one unique 1200w gallery URL on opening.
- Selecting slide 2 requested exactly its second 1200w file.
- Real mobile touch swipe separately requested that same second 1200w file.
- Opening zoom requested the second photo's 2000w file only then. Visible X closes it; Escape did not. Close control has no accessible name in the observed dialog.
- Thirteen Similar designs links retained; first tile navigated to its intended Mahakal product.
- Add succeeded and cart opened; Checkout reached `/checkout` with one item and a telephone field. No number was entered and no payment/order was submitted.
- No JavaScript page errors in the completed interaction run.

### Product-data consistency warning

The Mahakal destination offered a ₹599 discounted cart amount, while checkout showed ₹649 and an older product title; its category card showed ₹649. The Radhe PDP showed ₹179 while its category card showed ₹699. These are directly observed inconsistencies, not proof of a particular cache/database cause. The automatically applied coupon complicates exact total comparison; current source-of-truth records and cache keys need a dedicated review before billing behavior is declared correct. No prices were edited in this audit.

## Advertising checks

Meta SDK and pixel configuration scripts loaded; `fbq` exists and reports loaded. No `/tr` event transmissions were captured for the tested page entries, Similar navigation, Add, or checkout opening. This does not prove production advertising is broken (headless/browser-environment behavior can differ), and does not verify PageView/ViewContent/AddToCart/InitiateCheckout or server-side CAPI. Advertising delivery remains unverified and needs a dedicated event trace. Purchase/deduplication requires an authorized safe test flow.

## Remaining priorities

1. Resolve observed product/card/cart/checkout title and amount inconsistencies without changing intended prices.
2. Stabilize homepage sections and desktop card/PDP opening geometry; homepage mobile CLS is still poor.
3. Reduce homepage original photo activation and extend explicit small-copy coverage where genuinely small photos still use originals, preserving original media.
4. Attribute opening CPU cost and reduce safely: 47–72 scripts, approximately 702–845 KiB scripts, seven fonts. Do not disable tracking or shopping features to improve measurements.
5. Dedicated browser/server ad-event trace; payment completion, video behavior and cross-store/theme regressions remain unverified.

Publication is confirmed; no further publication is required merely for this report. No claim is made that every store or all Lighthouse warnings are fixed.