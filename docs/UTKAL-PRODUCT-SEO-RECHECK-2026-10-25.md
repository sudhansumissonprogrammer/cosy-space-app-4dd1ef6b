# Utkal product SEO recheck

Evidence: 25 October 2026, approximately 07:17–07:34 UTC. Skill: SEO Review.

## Is everything done?

No. Shared technical discovery is implemented and sampled, all eligible Utkal products have saved search descriptions, but product content completeness, latest Worker/frontend rollout, external crawler controls and Google indexing evidence remain incomplete. No promise that every item will rank is made.

## Full eligible catalogue counts (read-only database aggregate)

Eligibility: Utkal store, active products, not hidden by category.

| Field | Count |
|---|---:|
| Eligible products | 6,583 |
| Nonblank saved search descriptions | 6,583 |
| Nonblank visible product descriptions | 3,386 |
| Missing/blank visible product descriptions | 3,197 |
| Nonblank custom search titles | 25 |
| Missing/blank primary image field | 2 |

Custom titles are optional: other products use their product name and store name. A populated search description is not a quality, freshness or authenticity verdict. Existing embedded prices and commercial claims were preserved rather than silently rewritten. Full catalogue price/copy reconciliation was not performed.

## Live checks

- Valid Utkal sitemap: 6,652 unique page URLs = 6,583 products + 62 categories + 7 other pages. All page locations belong to utkalwatch.in. Image locations are not additional pages.
- Sequential bounded samples: home plus first/middle/last sitemap products and categories. All seven returned 200 with one matching canonical, nonblank title/description and indexable metadata. Three sampled products had parseable Product schema; three sampled main image URLs returned 200.
- Googlebot, ChatGPT-User and OAI-SearchBot probes succeeded on the middle product; GPTBot returned 403 despite robots permitting it. Spoofed user-agent checks do not prove provider-network access or identify the Cloudflare rule responsible.
- Live samples still reported Worker **9.2.5-agent-content**. Latest source now **9.2.7-product-seo-consistency**, including previous 9.2.6 utility protection.
- Ordinary raw product/category HTML lacked H1 in the six samples; search-rendered product HTML supplied it. The real preview browser rendered a correct H1. No claim that browser headings are missing or that every route was tested.
- Ordinary homepage raw heading repeated the store name and cut its description; Worker source now mirrors the app's heading contract.
- Fresh current-project foundations scan: 9 passing findings across lint, HTTP and metadata basics. This is platform-scoped, not a scan of every Utkal PDP.
- No available Search Console connection. Google-selected canonical, indexed-product totals, crawl history and actual organic visits remain unknown.
- Semrush India snapshot: 93 organic keywords, estimated 53 organic visits/month; leading category results around positions 30–50. Estimates are not measured visits or a product indexing inventory.

## Safe corrections completed

1. Shared neutral metadata description fallback: approved nonblank search description, else supplied product description excerpt, else “View [product] at [store].” No new delivery/returns/COD promises or invented specs.
2. App PDP themes 19/20/22 and standard PDP use that contract; theme 22 now retains approved metadata, product social type and loading-safe metadata ownership.
3. Product parent sale-price metadata matches the existing PDP rule; malformed equal/higher sale prices no longer change search/share pricing. Checkout is unchanged.
4. Worker streaming canonical, OG identity, Offer and breadcrumb resolve to the actual product slug instead of alias/ID request identity.
5. Product social renderer now returns exact name, effective price, currency, stock and primary identity. Worker omits unknown availability rather than assuming stock.
6. Missing product descriptions are omitted from schema instead of emitting empty descriptions or treating generic metadata as product facts. Raw schema facts are not HTML-escaped strings.
7. Worker homepage heading avoids duplicated store names, follows app truncation and uses a neutral fallback.

No merchant titles, descriptions, prices, images, URLs, inventory or business rules were changed. No orders/payments were submitted.

## Verification and deployment

- 125 tests passed across eight SEO/crawler/tracking files, including 16 new representation cases. Worker syntax check passed. Latest inspected preview build log: build OK.
- bot-render and seo-page deployed successfully. Direct deployed social response for Diver's Blue Pro Automatic returned price 2649 INR, in-stock and correct canonical.
- Preview real PDP rendered correct product H1, canonical, product OG type and Product/Offer schema. Main photo and visible supplied description rendered; zero page errors. Existing broken decorative icons were observed and not represented as fixed.
- Worker changes remain source/test verified only and require owner deployment. Frontend changes require publication. Cached live responses may retain earlier edge content until refreshed.

## Remaining priorities

1. Deploy docs/cloudflare-worker-current.js (9.2.7) and publish frontend; recheck utility noindex/no-store and resolved PDP identities live.
2. Inspect Cloudflare security/crawler settings for the observed GPTBot 403 and repeat provider access checks; source already allows GPTBot. No external setting was changed.
3. Provide Search Console access for Utkal, then inspect representative Google-indexed products and actual query performance. No all-product ranking verdict is possible without evidence.
4. Supply real missing product facts for 3,197 descriptions and photos for two missing primary image fields. Prioritise products with actual impressions and sales; do not bulk invent specs, guarantees, manufacturer identities or reviews.
5. Verify current cold mobile speed, image assets, variant offer semantics and mutation-to-sitemap cache freshness separately; these are not certified by this audit.

This updates, rather than erases, the limitations in the previous preservation audit.