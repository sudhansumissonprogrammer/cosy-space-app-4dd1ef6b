# Storefront loading optimization — 2026-11-01

## Scope
Shared client-side storefront loading, with real Serdiya Jewellers and Utkal Watch data. No merchant product, price, stock, payment, tracking configuration or original media changed. No database migrations or Worker changes.

## Changes
- PDP accepts the first valid edge/fresh product response rather than awaiting the edge first. Late fresh product/media reconciliation and existing error/missing fallbacks remain.
- Category metadata/product payload seeds page zero before the infinite-query fallback starts. Existing inline freshness refresh is lifecycle-cancelled and waits for opening readiness, rather than a fixed timer during render.
- Opening readiness checks document load, visible-page state, explicit route loading markers and visible image completion throughout the delay. Failed completed images do not hang the gate. Trust tile reveal and muted autoplay wait for readiness plus three seconds. Original full reel source, sound toggle, audible reel activation and data-saving fallback remain.
- Merchant app/upsell consumers share the same cached query. Disabled/absent storefront app UI does not mount; only current registered storefront app (Spin Wheel) has a lightweight shopper loader, separate from dashboard registry metadata.
- Automatic gift implementation waits for a nonempty cart with an applicable configured offer, or a saved gift needing cleanup. Existing server pricing enforcement is unchanged.
- Side-cart implementation loads on opening intent and stays mounted after activation. Checkout chunks warm on Buy Now intent, not automatically during opening.
- Bundled PDP shipping configuration seeds before its fallback observer. Legacy missing-shipping payloads still read configuration after product resolution.
- Non-home routes no longer prefetch home pages. Homepage-only hero/carousels no longer have explicit shared-shell manual chunk membership. No route-containing manual chunks introduced.

## Verification and limits
Focused unit coverage checks first-valid recovery, visible-photo readiness and the exact three-second delay, cancellation, feature gates, stale-gift cleanup, shared app requests, sound, gallery readiness, mobile card buffering and pageview ingest.

Local mobile checks use real public store data and forwarded hosted image assets. Both category pages render/scroll; both product pages, review sheets, preview unmute/mute and cart open work. Buy Now reaches phone capture without placing an order. No uncaught page errors in completed checks.

Observed readiness-to-tile/media intervals: Serdiya 3.302 seconds; Utkal 3.033 seconds (50ms browser sampling plus React commit/scheduler overhead). No checkout, automatic-gift, app-overlay, upsell-strip or homepage source requests on the untouched category entries in those local checks.

Production baseline used fresh browser contexts, disabled browser cache, unique query parameters, simulated 1.6 Mbps/150ms/4x CPU and 390px mobile screens. It showed significant category image delays and approximately 6.4–7MB background trust video traffic. Video started after initial loading, so video was not the only category bottleneck.

Source/dev measurements are not a production before/after comparison. Publishing is required for production bundle changes and renewed cold-4G measurements. No numeric speed improvement, instant loading, exhaustive all-theme safety or zero video bandwidth impact is claimed. Retained full-length video still consumes bandwidth after opening; no preview-copy transcode performed. Adjacent gallery preparation, image freshness and merchant review surfaces remain intact.