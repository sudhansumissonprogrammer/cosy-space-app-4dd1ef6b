# Mobile category scroll readiness

## Confirmed cause

Published Imitation World category cards activate at zero viewport margin. At entry only four cards were mounted; the next four were placeholders. Photos started downloading only upon arrival. A throttled scroll exposed two visible blank photos. Native lazy loading added another scheduling gate after card mounting. Nested `content-visibility:auto` also skipped paint for previously activated cards. Activation itself was already sticky: no evidence of upward image re-download was found.

## Changes

- Category grid only: bounded 600px vertical look-ahead, approximately two mobile rows.
- Opening visible/priority photos load first. The upcoming rows arm after these photos finish, or sooner if scrolling starts. This intentionally adds up to four background card requests after opening readiness; it does not download the whole catalogue.
- Shared intersection observers, one passive scroll arming listener rather than per-card per-frame state updates.
- Activated card main photos load eagerly at existing low fetch priority. Hover photos remain intent-gated. No PDP/zoom warming on card visibility.
- Keep activated cards mounted and painted on upward return. Distant inactive cards still use placeholders.
- Existing 800px/card selection, original image quality, PDP/zoom URLs, shopping actions, and tracking untouched.

## Verification

Browser: Chromium, 390×844 effective mobile viewport, DPR2, 4× CPU, 100ms latency, 400KiB/s download. Browser context starts at required 1280×1800; device metrics overridden for mobile investigation.

- Published before: opening four mounted/ready, next rows unmounted; after scrolling 120px, next row still unmounted.
- Preview after: next four cards prepared; sampled continuous scroll 0→2100px→0 at 100px/300ms down, 200px/300ms up, after opening photos plus 3.5s background preparation: zero blank visible cards across 33 samples, zero page errors.
- Category recorded zero 1200px and zero 2000px requests.
- Initial priority photo scheduling unchanged; settled unscrolled image totals intentionally increase by the bounded buffer. No equal-production LCP claim: local Vite processing is not comparable with published chunks.
- Screenshot-only forwarding used for platform-hosted badge assets; local asset endpoint returned app HTML, while published endpoint serves the correct badge. No application badge code changed.
- CPU is not fully solved: the development browser still recorded 13 long tasks, 51–353ms. This update fixes late photo readiness/paint retention, not every source of processing cost or guaranteed 60fps.
- The attempted PDP count returned zero matching product-path 1200px URLs; it is inconclusive and is not a passed PDP performance test. Existing targeted variant/preload regressions remain applicable.
- Very fast flings or very slow networks can still outrun any bounded buffer; full-catalogue preloading was deliberately avoided.

Publish the frontend update before production scroll/CPU/LCP comparison. No Worker change or deployment is required for this fix. Cross-theme physical-device testing remains unverified; shared card styles preserve priority behavior for direct non-gated consumers.