# Enterprise multi-tenant shopping discovery audit

Evidence date: 25 October 2026. Scope: uploaded enterprise shopping-discovery brief, existing shared architecture, safe incremental corrections.

## Pre-implementation inventory

The existing platform is React 18/Vite with shared tenant-scoped Postgres data, a shared application deployment, dynamic custom-domain/subdomain resolution, browser rendering and Worker/edge SEO rendering. This is not a new individual-store website project.

Existing systems include tenant-aware metadata, Product/Store/Breadcrumb JSON-LD, dynamic robots and partitioned sitemaps, public crawler rendering, negotiated Markdown, image CDN/upload derivatives, cache invalidation, merchant SEO fields and a product-feed endpoint. These must be inspected and reused, not duplicated.

Prior verified limitations: public accessibility does not establish Google indexing or shopping eligibility; GPTBot returned Cloudflare 403 while search/retrieval agents succeeded; external security events and Search Console evidence are unavailable. Merchant descriptions/images may be incomplete. Prior audit evidence is historical and will not be counted as fresh acceptance.

## Safety boundaries

- Preserve names, descriptions, prices, inventory, images, URLs, store design and working cart/checkout/payment/order logic.
- No production write tests, orders, charges, load tests or broad firewall exceptions.
- No invented brand authenticity, identifiers, reviews, shipping or returns claims.
- Public discovery is separate from merchant-feed eligibility and provider approval.
- No new database schema, provider connection or paid service without the required authorisation.

## Feature classification after audit

PASS means the stated bounded behavior was verified, not that every tenant or external provider has been certified. PARTIAL means foundations exist with specific omissions. NEEDS VERIFICATION means the required external evidence or destructive acceptance was unavailable.

| Brief phase | Status | Existing implementation and remaining scope |
|---|---|---|
| 1 Architecture/isolation | PARTIAL | Shared tenant data and host resolution implemented. Six deployed feed responses contain only the resolved tenant's product links; 20 PDP canonical identities match their tenant. Full private-data/RLS/security certification was not attempted. |
| 2 Initial HTML | PARTIAL | All 20 ordinary PDP responses contain titles, descriptions, canonicals, image metadata and parseable JSON-LD. Raw H1 absent in all 20; one Googlebot-UA response supplies H1, browser PDP supplies H1. UA probe does not prove official provider access. No rendering replacement performed. |
| 3 Structured data | PARTIAL | Shared app/edge schema and Worker renderer exist. Corrected unknown-stock assertions across them. Rich Results/merchant acceptance, variant offers and real manufacturer attributes remain unverified/incomplete. |
| 4 Image discovery | PASS (sample) | All 20 primary images returned 200 with image content types. Stable existing URLs preserved; no image modifications. This does not certify all gallery files, all suppliers or the full catalogue. |
| 5 Robots/sitemaps | PASS (sample) | Three domains returned 200 robots with matching sitemap and Content Signals. Product-only sitemap counts: Utkal 6,583; Kalinga 50; Serdiya 609, matching current visible-product aggregates. Partition helpers tested. |
| 6 AI access | PARTIAL | Public permissions, search/AI rendering and Markdown already implemented. Previous GPTBot 403 investigation still requires Cloudflare Security Events. No WAF/DDoS/security controls changed. |
| 7 Provider feeds | PARTIAL | Existing Meta CSV and seo-page Google-style RSS/CSV exports reused and repaired. Both live exports match visible counts on all three stores. No Microsoft account submission or OpenAI approval/adapter. Required brand/condition/identifier facts remain absent, not invented; generation is not provider validation or approval. |
| 8 Eligibility | PARTIAL | No submissions or workaround branding. No persistent merchant-authorisation/onboarding eligibility workflow found. Utkal authenticity conflict remains unresolved; public accessibility does not authorise shopping submission. |
| 9 Dashboard | PARTIAL | Store/product metadata editors, store about/FAQ/highlight settings and discovery links exist. Removed unsupported numeric AI-score promise. Missing: per-product validation history, feed rejections, provider onboarding and verified crawl/indexing status. |
| 10 Automation | PARTIAL | Shared renderers/files apply dynamically to current/future resolved stores; no store-specific implementation added. Feed regeneration on fetch and 60-second caching improved. No persistent reconciliation queue, validation ledger or all-tenant backfill was introduced. |
| 11 Performance | PARTIAL | Existing Worker/CDN/versioned caches retained; gallery reads now bounded batches and paged retrieval. 60-second feed cache bounds response freshness, but provider refetch intervals are independent. No capacity or cold-mobile performance certification. |
| 12 Security | PARTIAL | Visible tenant products only; gallery IDs originate from that list; explicit public-column exports. Meta query failures no longer become empty feeds. No broad grants, secret changes or private endpoint alterations. Full security audit remains separate. |
| 13 Acceptance | PARTIAL | 145 regression tests; Worker syntax valid; live feeds, 20 PDP/images and one real browser PDP verified. Mutation/delete/domain-change tests, real variant offer tests, authenticated merchant editing and checkout/payment flows intentionally not exercised. |
| 14 Rollout | PARTIAL | meta-product-feed, seo-page and bot-render deployed and checked. Worker source 9.2.8-discovery-facts requires manual Cloudflare deployment; frontend schema/score change requires publication. |

## Confirmed defects repaired

1. Meta feed previously used an unpaged 5,000-row cap (potentially less under server limits) and omitted hidden-by-category filtering. Now uses shared ordered 500-row pages, visible products only, and bounded 100-ID paged galleries; lookup failures propagate as no-store errors.
2. Removed unsupported new-condition, seller-as-manufacturer-brand, age/gender/material/color assumptions, invented quantity 50, and promotional description fallbacks. Provided descriptions remain unchanged; absent descriptions use neutral product/store identity. Optional absent attributes stay blank; this does **not** make the feed provider-approved.
3. Removed the arbitrary five-percent sale-price cutoff, which contradicted the PDP. Valid positive sales below list price are exported; malformed values rejected. Merchant prices never changed.
4. Required known stock, positive finite parent price and HTTPS product image before exporting a row. Unknown stock omitted from app/edge/Worker schema/social assertions rather than incorrectly marking out of stock. Unlimited-stock sentinel does not become a claimed Meta quantity.
5. Both feed caches now have 60-second freshness instead of up to an hour. This is bounded fetch freshness, not event-driven provider sync. Unsupported format/invalid slug rejected; public Meta writes return 405; internal exceptions not returned to clients.
6. Removed unsupported “~70 to 90+” AI-score improvement promise from existing merchant settings. No other design or merchant values changed.

## Fresh evidence

Read-only public probes around 08:36–08:42 UTC, 25 October 2026; sequential low-rate requests. Test harness first accidentally selected image sitemap locations as pages; corrected to direct `url/loc`, discarded that run and repeated the entire 20-PDP sample. No image URLs counted as product pages.

| Store | Real PDPs / status 200 | Correct tenant canonical | Primary images 200 | Visible DB products | Rows in each deployed feed |
|---|---:|---:|---:|---:|---:|
| Utkal Watches | 8 / 8 | 8 | 8 | 6,583 | 6,583 |
| Kalinga Jewels | 6 / 6 | 6 | 6 | 50 | 50 |
| Serdiya Jewellers | 6 / 6 | 6 | 6 | 609 | 609 |

All six feed responses: 200, correct tenant link hosts, known stock values, no asserted condition/brand and public 60-second cache. Headers contain only public product fields; no customer/order/payment/supplier-cost data selected. Invalid Meta slug and unsupported generic feed format returned 400. This tests existing public custom domains, not every platform subdomain.

Real preview flow: `/store/kalingajewels/product/1gram-gold-plated-maa-round-pendent-with-chain-woman-girls-ej7oqt` displays the product photo, one product H1, ₹650 sale/₹999 list, description and two schema scripts; zero page errors. Both deployed feeds match ₹650/₹999. Existing broken decorative badge/service icons remain visible and are not claimed fixed. No purchase initiated. No authenticated seller flow claimed verified.

145 tests passed across productDiscoveryFacts, productSeoConsistency, seoMetadata, seoDiscovery, sitemapDocuments, robotsPolicy, workerAiRouting and agentContent. Worker `node --check` passed; latest inspected preview build 08:38:57 UTC: build OK.

## Official provider research and blockers

- OpenAI [onboarding](https://developers.openai.com/commerce/guides/get-started), [feed specification](https://developers.openai.com/commerce/specs/spec) and [product fields](https://developers.openai.com/commerce/specs/file-upload/products): documented partner/application path, not evidence this platform is approved. India eligibility, multi-tenant intermediary authority, available delivery/authentication mechanism for this account and permitted merchants need official confirmation. No arbitrary feed submitted, no active OpenAI integration claimed.
- Google [product-data specification](https://support.google.com/merchants/answer/7052112?hl=en): export format alone does not establish product/merchant policy eligibility, required identifiers, shipping/returns configuration or approval. Missing condition/brand facts must be supplied truthfully where required.
- Microsoft [Merchant Center](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bmc_intro) and [feed documentation](https://learn.microsoft.com/en-us/advertising/msa-help/hlp_ba_conc_bmcwhatiscatalog): verified/claimed website and merchant account required; no accepted submission or dedicated tested adapter established.
- OpenAI [crawler documentation](https://developers.openai.com/api/docs/bots): search, user retrieval and training are distinct. User-agent probes are not identity verification. Published provider IP checks/trusted CDN verification plus logs are needed; robots permission alone cannot remove a Cloudflare block.

## What still is not built or certified

Not built: persistent SEO validation/error history, full merchant discovery monitoring, provider onboarding/eligibility controls, event-driven provider feed synchronization, confirmed OpenAI adapter and tested Microsoft submission, variant-selected feed landing behavior, merchant image-alt override workflow.

External blockers: manual Worker 9.2.8 deployment, frontend publication, Cloudflare GPTBot rule evidence, Search Console/merchant-provider access and approval, merchant-supplied verified product identifiers/condition/authenticity and missing content/photos. Previously documented Utkal missing descriptions/photos are historical counts, not re-certified here.

Next safe batch: design the existing-settings extension and owner-only validation records for approval before schema changes, then connect eligible provider accounts. Do not create disconnected dashboards or submit potentially ineligible items just to mark a checklist complete. This turn intentionally repairs confirmed low-risk problems, rather than claiming the entire enterprise system is finished or all products will rank.