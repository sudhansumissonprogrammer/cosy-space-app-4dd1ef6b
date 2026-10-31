# Shopify-inspired analytics Live View

## Verified research
- [Shopify Live View documentation](https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/live-view): 3D globe and 2D map, drag/zoom, visitors active in the last five minutes, customer behaviour measured over ten minutes. Shopify's checking-out metric requires submitted contact details; a checkout-start event alone is not equivalent.
- [A World Rendered Beautifully (2020)](https://shopify.engineering/bfcm-3d-data-visualization): Three.js and a shared layer-oriented globe design for Live View and BFCM.
- [BFCM data pipeline (2021)](https://shopify.engineering/bfcm-live-map-2021-apache-flink-redesign): Apache Flink for that public live-map system.
- [SSE at scale](https://shopify.engineering/server-sent-events-data-streaming): real-time delivery for Shopify's published visualization system.
- [2023 globe](https://shopify.engineering/how-we-built-shopifys-bfcm-2023-globe) and [2025 globe](https://shopify.engineering/2025-bfcm-live-globe): Three.js, React Three Fiber and SSE are disclosed for these BFCM globes. They do not prove the current merchant-admin backend uses those exact services.

An exact copy of Shopify's private production implementation cannot be established from public documentation. This dashboard recreates the useful visual experience with maintained Three.js-based react-globe.gl, Natural Earth boundaries and d3-geo's Equal Earth world projection.

## Our measurements
- Visitors: existing visible-tab heartbeats active within **90 seconds**, not Shopify's five-minute window; idle tabs stop reporting.
- Added to cart: distinct tracked sessions with an add-to-cart event in ten minutes. Not a guarantee the cart is still nonempty.
- Started checkout: distinct sessions with begin-checkout in ten minutes. Not a claim contact details were submitted.
- Orders/sales: authoritative confirmed, paid, partially-paid, shipped, delivered or completed non-migrated orders created in ten minutes; excludes pending/cancelled orders. Full order value is used consistently with the existing dashboard, not cash collected.
- Purchase dots: confirmed orders in the last 24 hours, matched conservatively to an Indian city plus state. Ambiguous/missing cities remain unplotted and counted as unavailable; no address or customer identity is returned.
- Visitor dots: trusted country-level Cloudflare geography joined to active sessions. No precise visitor tracking. Missing country stays unknown; no country/city is guessed.
- Polling: 15 seconds in the foreground. This is not Shopify's SSE architecture or instantaneous delivery.

## History repair
Confirmed deployed mismatch: cleanup_app_logs deleted raw page views after 30 days, while get_analytics_traffic assumed 95 days remained and read raw-only for 30/90 days. Daily history existed but was bypassed. The older cleanup also overwrote daily data using partial UTC days.

New server-side traffic series chooses complete retained raw days and archived daily rows without adding both for a day. Range totals use distinct IDs when only raw data is needed; ranges containing archived days use summed daily counts and are labelled accordingly. Cross-day unique visitors/sessions cannot be reconstructed from daily totals. Past data already removed or damaged cannot be recovered exactly. Custom intraday archived data has calendar-day granularity.

cleanup_app_logs no longer deletes/rewrites analytics; the existing per-store analytics retention job remains responsible. Daily rollup normalizes empty IDs and uses store-local dates. All queries verify owner/admin access.

## Deployment and coverage
Publish frontend changes. Manually deploy docs/cloudflare-worker-current.js for trusted geographic enrichment and the corrected landing_path field; without that deployment visitor country data may remain unavailable. Existing history has null country values and cannot be backfilled from those records.

### Data attribution
Earth boundaries: [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) public domain, distributed by world-atlas (ISC).
City references: [GeoNames cities15000](https://download.geonames.org/export/dump/) and admin1CodesASCII, [CC BY 4.0](https://www.geonames.org/about.html); downloaded 2026-10-31. City-centre reference data, not a geocoding service or precise shopper location.

## Useful next steps, not included
Live country/city enrichment beyond country-level visitor data needs a trusted collection source. Exact historical range-unique sessions beyond raw retention need preserved session-level identities or sketches. Exact live nonempty-cart and contact-submitted-checkout metrics need authoritative cart/contact instrumentation. Merchant-to-buyer order arcs need a verified dispatch location; they are deliberately omitted rather than invented.