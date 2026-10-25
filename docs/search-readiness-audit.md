# Search readiness audit — 2026-10-24

Reference: approved Universal Google Search readiness plan archived in `.lovable/plan/`.

## Result

Not fully rolled out. Shared technical corrections and deployed search functions are verified in the checks below; production Worker behavior still differs from those functions. Ranking, indexing and sales-source claims remain unverified.

## Corrections

- Addressable 20-product catalogue pages, strict page parsing, sequential links and query-aware canonical/OG URL updates.
- Shop/category/best-seller metadata ownership; homepage shell cannot override product metadata.
- Real category slug resolution with truthful Shop All fallback; independent of product-photo readiness.
- Removal of invented manufacturer/internal-ID identifiers, condition and price-expiry claims.
- Error-preserving paged sitemap/gallery reads and non-fabricated modification dates.
- Hidden-category eligibility and no unfiltered fallback when category membership lookup fails.
- Anonymous direct product queries rely on existing visibility RLS, not ungranted internal columns. Browser verification found and corrected a permission-denied regression without widening column grants.
- Worker source preserves upstream failures/noindex/no-store and page identity; production deployment still required.
- Follow-up: shared utility-route noindex with query-free canonicals; case-insensitive category seed membership aligned with paged reads; unsupported feed condition removed in CSV/XML; existing dynamic sitemap extended with bounded deterministic children and Worker child-path handling.

## Verified

- 15 tests pass across discovery, metadata and Google Ads tracking; Worker JavaScript syntax check passes. Latest preview build log reports OK.
- Utkal loaded Shop page 1 and page 2 have distinct product sets and correct primary-domain canonicals. Clicking Next updates both URL and canonical; opening a real product retains its exact existing URL and resolves a real category breadcrumb. No browser page errors in that flow.
- Invalid browser `?page=0` is noindex; empty best-seller page 2 is noindex.
- Deployed Utkal sitemap contains **6,583 unique product URLs**, matching the eligible database count, and **10,115 image entries**. No foreign-domain URLs.
- Deployed Hopknock sitemap contains **17,006 unique product URLs**, matching its eligible count, and **32,824 image entries**. No foreign-domain URLs.
- Deployed search renderer: both stores have 20 links on pages 1 and 2, no overlap between those pages and no cross-store domain links.
- Two sampled Utkal image requests return 206 image/webp. This is a sample, not a full image availability audit.
- Deployed search renderer rejects invalid page input with 400 and returns noindex/no-store on track-order.
- Telegram current-workspace connection verified as @Shopbanaobot and order-notify function redeployed; no history replay or test order send.
- Follow-up checks: 20 tests pass including 50,001 sitemap URLs and UTF-8 byte partitioning. Deployed Utkal sitemap still contains 6,583 product URLs; unknown child returns 404/no-store and invalid part returns 400/no-store. Public anonymous category seed and paged IDs match for Casio Premium. Private diagnostic SQL cannot execute the public function, so verification used its intended anonymous API instead of widening grants.
- Loaded Utkal product → populated cart → checkout phone-entry page works without page errors or order submission. Cart has noindex and its own canonical. Direct search/tracking/cart metadata and return to indexable shop verified. Full delivery/payment submission and cold mobile performance remain unverified.
- Raw live checks on Utkal, Kalinga and Serdiya found inconsistent homepage/page-1 canonicals, repeated product sets on page 2, and cacheable missing/utility responses. Sampled real PDP canonicals and five image requests passed. These production failures are not solved merely by deploying the search functions.

## Outstanding acceptance checks and blockers

1. **Cloudflare deployment — RESOLVED 2026-10-25:** owner deployed the Worker; live Googlebot checks on utkalwatch.in now return 400/noindex/no-store for `/shop?page=0`, 404/noindex/no-store for a missing product, 200/noindex/no-store for `/track-order`, sitemap.xml serves 6,652 URLs / 10,115 images on the primary domain, sitemap-1.xml returns 200 XML, unknown child returns 404/no-store, homepage canonical is correct, and shop page 1 vs page 2 have zero overlapping products. Frontend edits still require the next normal publish; no publication was requested or performed here. Note: some sitemap image URLs point to third-party supplier hosts (jdwebnship, cartpe, shopify CDN) — Google may not index those as Utkal's images; original self-hosted photos would be stronger.
2. **Images:** two sampled Hopknock image requests return 403 text/html. No URLs were rewritten or assets regenerated. Investigate source availability; full image accessibility is not verified for either store.
3. **Pilot breadth:** live data has no theme-19/theme-20 stores for those requested checks. Alternative-theme rendering, third-store pilot, category membership/order parity through the final page and utility-route browser metadata still need acceptance checks. Source changes and shared-hook tests do not establish all-theme end-to-end success.
4. **Shopper/performance acceptance:** complete cold mobile timing/bytes/layout-shift comparison and product→cart→checkout acceptance without charging a payment. Existing purchase-tracking tests pass but do not replace that flow.
5. **Sitemap scaling:** partitioning above 50,000 URLs and conservative UTF-8 byte bounds pass local tests; current deployed child/error behavior passes. A real larger-store sitemap index and retrieval-failure injection remain unverified; repeated child generation still reads the catalogue and is not a stored snapshot system.
6. **Search evidence/content:** authorised Search Console inspection/query data, Rich Results validation and merchant-approved facts are unavailable in this audit. No new bulk public copy, ranking claim, indexing guarantee, sales attribution or account submission was made.
7. **Variant/merchant eligibility:** variant feed entries remain disabled pending truthful selected-variant landing behavior. Utkal branded watches are owner-confirmed replicas; no Merchant Center submission or authenticity workaround is authorised.

## Unchanged

Product prices, original image URLs, existing ad/PDP URLs, merchant identity and public product claims were not rewritten by this audit. No production payments or marketing sends were created.