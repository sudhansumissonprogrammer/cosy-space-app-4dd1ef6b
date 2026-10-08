# PDP and category browsing audit — 8 October 2026

## Confirmed findings and fixes

- **Downloaded but invisible PDP main photo:** a live Imitation World cached-reload check showed a completed 1200w main photo behind the loading placeholder. Standard and V22 galleries cleared `imageLoaded` when Embla became available, after the child's cached readiness effect could already have fired. Removed this readiness reset; media-source changes now remount the gallery by a product/media key. Kept stable passive cached checks rather than callback-ref updates.
- **Stale gallery select closure:** memoized slide lists and tied select listeners to the actual slide list, not just its length.
- **Category readiness polling:** a failed opening image could keep every offscreen card polling indefinitely. Completed failed images now settle preparation too; no-photo grids also stop polling. Requests with no assigned source are still pending, preserving the opening-photo budget.
- **Stale product cards:** the custom memo comparator ignored changed names, slugs and photo URLs. It now requires the same product object rather than comparing an incomplete field subset, so refreshed immutable query data updates the card and its destination.
- **V19/V20 zoom correctness:** photo zoom indexes now count image slides instead of including intervening video slides; zero-width scroll measurements are ignored and indexes bounded; empty image galleries cannot mount zoom.
- **Gallery URL normalization:** trim gallery-row URLs before deduplication, preserving URL order and original media.

## Browser evidence

Read-only live custom-domain checks and preview checks; no order, OTP, payment or notification created. Initial desktop-context runs used 1280×1800 with mobile CDP override; ordinary screenshots reset that override, so those screenshots are desktop evidence only. Subsequent mobile verification uses CDP capture without resetting emulation.

- Live and preview Imitation World category: down/up samples at 0, 400, 800, 1400, 2100, 1000 and 0px; sampled visible card photos ready after an 800ms settle. Zero 1200w/2000w category photo requests, zero JavaScript page errors and HTTP errors in those runs. This is not a continuous-frame or slow-network smoothness guarantee.
- After the fix: main photos visibly ready on initial entry plus three cached reloads each on Imitation World Mahakal and Serdiya Jewellers Chain PDPs. Waited for actual image completion and opacity, not an arbitrary network deadline. All eight completed readiness checks passed; zoom opened in both stores; no JavaScript page errors.
- Preview Festival badge asset path resolves differently on localhost; live badge served correctly. This is a preview asset-delivery limitation, not a product-photo failure; no badge changed.

## Limits and follow-up

Frontend publication and fresh production verification of these new fixes are still required. No Worker edit is needed.

The audit also identified category sorting applied only to loaded pages: current category RPCs do not accept a sort argument, so merely passing `sort` to the hook would not fix it. Correct global sorting requires a dedicated query/pagination change; it is not changed in this loading-only fix. Brand-carousel category mode still intentionally fetches remaining pages to group all brands; redesigning this view is separate work.

No claim of guaranteed 60fps, all-theme physical-device coverage, completed payment testing or advertising delivery. Earlier homepage movement, price consistency and opening CPU concerns remain separate priorities.