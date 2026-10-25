# ShopBanao SEO/GEO preservation audit

**Evidence date:** 25 October 2026, approximately 06:57–07:02 UTC.
**Scope:** supplied audit instructions, existing shared implementations, Utkal priority, public production samples on Utkal/Kalinga/Hopknock, preview shopping flow and focused regression tests.

This is a bounded technical audit, not proof that every route, theme, product, crawler or integration works. The separate original 20-phase specification referenced by the upload was not supplied; its 20 numbered audit instructions were used instead. No guarantee of ranking, indexing, AI recommendations or merchant-program eligibility is made.

Status legend: **A** verified within stated evidence scope; **B** broken; **C** partial; **D** missing; **E** suboptimal; **F** not applicable; **G** unverified. Source/local verification is never represented as deployed verification.

## 1. Existing SEO/GEO Features

### Before/after verification matrix

| Feature | Before | After | Evidence / files | Remaining limitation |
|---|---|---|---|---|
| Tenant robots and Content Signals | G, older docs said deployment pending | A, three live samples | All three robots returned 200; search=yes, ai-input=yes, ai-train=yes and private exclusions | Provider identity, all tenants and firewall rules not verified |
| AI public rendering / Markdown | G | A, Utkal samples | Live Worker 9.2.5 on three hosts; Utkal home, sitemap-discovered category and PDP returned 200 HTML for Googlebot and 200 Markdown for ChatGPT-User; Vary: Accept | Spoofed user-agent probes, not real provider crawls |
| Dynamic sitemap discovery | C | A for live samples; C overall | Utkal 6,652 unique URLs, including 6,583 products and 62 categories; Kalinga 59; Hopknock 17,125; valid XML | No catalogue-to-database full reconciliation or production >50,000-URL trial |
| Sitemap tenant isolation | G | A, Utkal sample | All 6,652 loc origins utkalwatch.in; no duplicate locs | Other tenant origins not exhaustively reconciled |
| Hopknock sitemap availability | B, first probe 503 | A on repeat only | Repeat returned 200 XML, 17,125 unique URLs | Transient cause unknown; not claimed permanently repaired |
| Paged discovery / failure preservation | A, existing tests | A, regression | seoDiscovery.test.ts and sitemapDocuments.test.ts | Mutation-to-cache freshness remains C |
| Public page heading/canonical | C | A, sampled paths | Live Utkal home/category/PDP each had one H1 and one self canonical; preview home/shop/search/PDP checked | Not all themes/URLs verified |
| Invalid pagination / missing PDP status | G | A, live samples | /shop?page=0 → 400; nonexistent PDP → 404; both no-store | Other error paths not exhaustively checked |
| Utility HTML indexing protection | B, live tracking shell indexable with home canonical/public cache | A in source/tests; B live until deployment | Worker response-boundary correction, warm-shell metadata tests | Deploy Worker 9.2.6, then repeat live checks |
| Platform structured-data duplication | B | A in preview | Removed duplicate LandingJsonLd mount/file; removed unsupported breadcrumb and mismatched static FAQ; static WebSite no longer advertises nonexistent platform search | Publish required for live platform |
| Unsupported application rating | B, client schema asserted 4.8/520 | A in source/preview | Duplicate client schema removed; no bulk ratings/product changes | Public visible testimonials not independently authenticated |
| Tenant schema isolation in preview/direct origin | B, platform schemas leaked into Utkal preview | A, preview | main.tsx removes marked platform schemas before storefront boot; Utkal preview had zero platform markers | Raw direct-origin HTML remains static before JS; production Worker strips server-side |
| Store/Product schema lifecycle | C, shared script identity | A, regression | Distinct store script ID; test mounts both and removes Store without losing Product | Broad theme mount-order audit still limited |
| Storefront search schema target | B, /shop?q did not execute storefront search | A in source/preview | Shared hook and Worker now target /search?q; App has dedicated search route; real preview search returned products | Worker deployment required |
| ItemList item count | B, full input count with only 30 entries | A, regression | Shared hook declares min(input count,30); test verifies entries and destinations | Bounded list, not full catalogue download |
| Product offers and images | C | A for hook regression; C overall | Test updates price 1149→1299, stock→0, retains exact original image URL | Variant-level offer modeling remains incomplete; shopper pricing deliberately unchanged |
| Product facts/descriptions | C | C, preserved | Live sampled PDP Product schema had empty description and real supplied image URLs | No bulk rewrite or invented facts; stale embedded-price text remains a possible risk, not demonstrated live |
| Original image accessibility | C | C | Main product image rendered in preview; supplied originals retained | Some existing decorative/PDP benefit and checkout images were broken in preview; lower desktop search rows showed placeholders |
| llms.txt / AEO entity data | C | C, existing source | Platform llms.txt and tenant renderer exist; public routes covered by routing tests | Not a complete catalogue, no proof of AI citation frequency |
| Route social previews | C | C | Store canonicals mirror og:url; sample live bot pages self-reference | Static platform non-home pages / crawler differences remain unverified |
| Frontend performance | C | C, no speculative optimization | Visible opening images rendered; public warm request timings recorded | No current cold-device CWV/Lighthouse/RUM certification |
| Search visibility | G | G | Project-linked Search Console diagnosis: no connection | Google indexing, selected canonicals, queries, penalties, actual organic orders unknown |

### Coverage of the upload's 20 numbered sections

| Section | Outcome |
|---|---|
| 1 Objective | Preserve existing business data/design; no ranking promises |
| 2 Inventory | Shared hooks, Worker, renderers, robots, discovery, schemas and tests inspected; not every repository file |
| 3 Classification | A–G legend and scoped matrix above |
| 4 Verification matrix | Before/after, evidence and limitations recorded |
| 5 Production | Three hosts and real Utkal sitemap-derived URLs checked |
| 6 AI access | Permissions/representation live sampled; actual provider identities G |
| 7 Dynamic products | Price/stock/image hook tests A; variant semantics C |
| 8 React rendering | Preview route transitions A; all crawler/device combinations G |
| 9 Duplicate systems | Confirmed schema duplicates repaired; canonical writers retained where tests show correctness |
| 10 Structured accuracy | Unsupported breadcrumb/rating/search action and count/lifecycle corrected; fact verification C |
| 11 GEO/AEO | Existing entity/llms/Markdown preserved; recommendations/citations G |
| 12 Sitemap automation | Live/XML and bounded partition tests A; mutation freshness C |
| 13 Performance | No unmeasured optimization; cold CWV G |
| 14 Prioritization | Confirmed utility/schema defects first |
| 15 Incremental implementation | Extended existing systems; no renderer replacement |
| 16 Protection | No data writes, payment submissions, auth changes or DNS changes |
| 17 Regression | 109 targeted checks pass; limited real preview shopping flow |
| 18 Reaudit | Corrected source/preview retested; new Worker live G until deployment |
| 19 Report | Nine requested sections provided |
| 20 Execution | Safe confirmed corrections completed; unavailable external verification explicitly retained |

## 2. Existing Features Repaired

- Removed the duplicate landing client Organization/WebSite/SoftwareApplication schema and unsupported hardcoded rating.
- Removed fictional landing breadcrumbs and conflicting static FAQ questions; retained the actual visible FAQ and its own schema.
- Removed the platform SearchAction pointing to a nonfunctional platform search.
- Corrected storefront WebSite SearchAction to the existing `/search?q=` destination in the shared React hook and Worker homepage builder.
- Isolated Store and Product schema identities and corrected bounded ItemList counts.
- Removed marked platform schemas during storefront boot, including path-based preview.
- Added Worker utility response protection: query-free canonical/OG identity, noindex/follow, no-store, no misleading public JSON-LD. App scripts, queries and body data are preserved. Early public mirror-cache reads exclude utility routes.

The response protection does not replace authentication or assert private APIs are secure; it fixes search signals on generic utility HTML. Internal shared generic shells can still be reused, but the delivered utility response is protected at the boundary.

## 3. Newly Implemented Features

No second SEO platform, new crawler service, bulk keyword generator, new database or new storefront architecture was added. Small regression cases and a shared utility-response safeguard fill confirmed gaps in existing systems.

## 4. Features Preserved

Product names, descriptions, prices, sale prices, variants, stock, photos and URLs were not changed. Existing design, themes, infinite scrolling, photo scheduling, cart, payment/checkout logic, shipping calculations, tracking integrations, auth and customer/order records were not modified. robots permissions and existing sitemap generators/partition limits were retained. No integration was reconnected or old order history replayed during this audit.

## 5. Remaining Issues

1. **Deployment:** production still reports Worker 9.2.5. The new 9.2.6 utility/search-schema corrections are source/test verified only; frontend metadata/isolation changes require publication.
2. **Search Console:** no project-linked connection; actual indexing and ranking remain unknown. No new scan or account mutation was run.
3. **Variant schema:** parent-stock offers remain the shopper/UI convention in inspected PDPs. Switching to variant stock could conflict with checkout semantics; no business-rule change made.
4. **Product descriptions:** one live sitemap-selected PDP emitted empty description. No fabricated copy/specifications were added. Existing descriptions containing prices may become stale after price changes; no specific stale live price was proven.
5. **Images:** main photo loaded; several existing benefit/badge/checkout decorative images visibly failed in preview, and lower desktop search rows had placeholders. Cause and production breadth unverified; original/supplier image URLs were not altered.
6. **Hopknock transient 503:** recovered on repeat. Unknown root cause retained rather than masked with an empty sitemap.
7. **Cache freshness:** paginated/error-preserving sitemaps exist; catalogue mutation → sitemap purge timing not end-to-end verified. Cached sitemaps may lag edits.
8. **Coverage:** all-theme keyboard access, filters, actual mobile devices, signed-in accounts, cold performance, shipping totals, payment completion, all stores, catalogue-scale >50,000 production sitemap behavior and Rich Results external validation remain unverified.
9. **Eligibility:** technical crawling does not establish product authenticity or merchant eligibility. No counterfeit listing submissions, brand-keyword expansion or fabricated identifiers/reviews were performed.
10. **Platform social metadata:** static fallback is home-oriented; non-home social-crawler behavior remains partial, not declared fixed.

## 6. Technical Verification Evidence

### Automated

`bunx vitest run src/test/seoMetadata.test.tsx src/test/seoDiscovery.test.ts src/test/sitemapDocuments.test.ts src/test/workerAiRouting.test.ts src/test/robotsPolicy.test.ts src/test/agentContent.test.ts`

**105 passed across 6 files.** Separate `trackGoogleAds.test.ts`: **4 passed**. Total **109 targeted tests**; React Router informational future warnings only. Worker syntax check passed. Preview harness reported build OK, latest inspected entry 07:00:27 UTC. No manual build/typecheck was run because the project harness owns compilation.

New cases cover coexistence/unmount of Store/Product schema, correct search target, live offer updates with image preservation, bounded list count, utility metadata for Googlebot/ChatGPT/humans, unmodified app-data script and query, public-product exclusion and empty utility HEAD.

### Public production

- Three `/__health` responses: 200, Worker **9.2.5-agent-content**, KV connected.
- Three robots: 200, signals and private exclusions present.
- Utkal sitemap: **6,652 unique locs; 6,583 PDPs; 62 categories; zero foreign origins**. Root URL without trailing slash was not treated as foreign.
- Kalinga sitemap: 59 unique locs. Hopknock repeat: 17,125 unique locs.
- Utkal actual `/category/rado-watch-men` and sitemap-selected PDP: 200, one self canonical, one H1; ChatGPT-User Accept Markdown: 200, text/markdown, source URL included.
- Invalid page: 400/no-store. Missing PDP: 404/no-store.
- Tracking page before correction: 200, homepage canonical, index/follow, publicly cacheable. This directly motivated the Worker patch, which is not yet live.

Warm public HTML sample response times were roughly 0.49–0.80 seconds for the sampled valid/error catalogue paths; sitemap responses roughly 0.57–7.44 seconds. These are sandbox network/request measurements, not mobile LCP or real-user metrics.

### Preview browser

- Landing, Utkal home/shop/search and PDP loaded; no page errors in the sampled run.
- Utkal storefront had **zero platform schema markers**; Store schema had its own ID; shop had ItemList; search had noindex and query-free canonical.
- Main PDP title/photo rendered. Existing broken decorative assets remain noted above.
- Real product → Add to Cart → Cart → Checkout: selected watch persisted, **₹1,650** appeared in PDP/cart/checkout, matching initial UI price. Checkout stopped at phone entry; no customer phone/address/order/payment submitted.
- Final landing check contained only static Organization, WebSite and SoftwareApplication; FAQ owns its visible questions/schema.

Screenshots and raw probes were temporary audit evidence under `/tmp/browser/seo-preserve/`; their persistence beyond this sandbox is not guaranteed.

## 7. Production Safety Report

All production probes were bounded public GET requests. No load test, order, payment, message replay or private-data extraction was performed. Changes are frontend SEO markup, existing shared SEO hooks, Worker response metadata, tests, architecture notes and this report. No database migration, authentication change, price calculation, shipping rule, inventory write or DNS change occurred.

Verified: public read paths, preview cart persistence and entry into checkout; Google Ads dedup regression suite. **Unverified:** signed-in account flow, completed checkout, real payment, shipping/address calculation, webhook settlement and external tracking delivery. “Unchanged source” is not presented as end-to-end verification of these systems.

## 8. SEO/GEO Readiness

Public discovery is substantially implemented and sampled live: tenant robots, Content Signals, paged product/category discovery, sitemaps, crawl-readable HTML and negotiated Markdown. The audit found and repaired additional schema/utility metadata gaps without rewriting merchandise or altering the store design.

Readiness is **partial, not perfect**: rollout of current repairs, catalogue freshness, variant facts, some image assets, broad theme/device coverage and external Google evidence remain outstanding. Allowing crawlers does not mean Google indexes every item or ChatGPT recommends it. No ranking uplift or organic sales result can be inferred from these technical checks.

## 9. Next Steps Requiring Owner Involvement

1. Deploy `docs/cloudflare-worker-current.js` (**9.2.6-seo-preservation**) to the existing Worker; publish the frontend. The live URL will not receive current frontend head changes until publication. Then live utility/search-schema checks can be repeated.
2. Provide authorised Search Console access/property evidence for Utkal to establish actual indexing, Google-selected canonicals and queries; no passwords needed in chat.
3. Supply verified product facts, original/authorised photos and real stock/variant rules before content or offer modeling changes. Missing facts will stay missing.
4. Authorise a separate business-critical acceptance test if completed checkout/payment/account verification is required; no real order or charge was initiated in this audit.

**Skill used:** SEO Review. Existing scanner findings were not declared passing; corrected source evidence does not certify deployed or external indexing outcomes.