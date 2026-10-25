# AI crawler access audit — 2026-10-25

## Live findings

- Utkal home: Googlebot, Claude-SearchBot and Claude-User returned 200; OAI-SearchBot, ChatGPT-User, PerplexityBot and GPTBot returned 403. These are simulated user-agent requests, not verified visits from provider IPs.
- Utkal robots allowed OpenAI search/user retrieval and Perplexity despite Worker blocks. Shared source had the same mismatch for other AI crawlers.
- Platform and storefront robots disagreed on training crawlers and Meta-ExternalFetcher. Explicit allowed-agent groups did not inherit wildcard private-route exclusions.
- Verified actual configured domains via store records: utkalwatch.in, hopknock.shopbanao.in, kalingajewels.com, serdiyajewellers.shop. hopknock.com is an external Shopify storefront, not this platform's managed Hopknock domain; its rules were not modified.

## Corrections and checks

- Shared robots policy now permits named AI search, user retrieval and training agents, with the same transactional/private route exclusions for every allowed agent. Scraper blocks remain. Robots is not a security boundary.
- Generated storefront policy deployed and verified with 200 responses and store-specific sitemap URLs for all four sampled stores. Static platform robots generated from the same helper; it requires normal frontend publication.
- Worker source v9.2.3-ai-crawler-access removes named AI agents from the early 403 list and routes them to the existing public search renderer. AI requests skip the early SPA-shell cache shortcut. Existing generic crawler rate limits remain; spoofable agent names do not establish trusted identity. Meta handling stays unchanged.
- 39 targeted tests pass, including 25 crawler-policy tests. Worker syntax check passes; latest available preview build reports OK.
- Live Hopknock subdomain served the new robots policy; sampled custom domains still served cached old robots at verification time.

## Deployment needed

Owner must manually deploy `docs/cloudflare-worker-current.js` version **9.2.4-ai-public-routing** to Cloudflare. Its version changes invalidate the existing version-keyed robots/search cache; until deployment, the observed ChatGPT 403 remains unresolved in production. Publish the app for the platform static robots update. Recheck home, category, real PDP, sitemap and utility responses using AI user agents after deployment. No claim of actual AI indexing or citations is established by this audit.

## Follow-up Worker audit — 04:08 UTC

- Live `/__health` reports **9.2.2-search-completeness**, not the corrected AI Worker. All four managed sample hosts returned `403` with `x-blocked-by: shopbanao-bot-policy` for ChatGPT-User on both `/` and `/robots.txt`. This identifies the active Worker policy, not a robots disallow or a demonstrated Cloudflare managed challenge. Earlier 200 results for OAI-SearchBot/PerplexityBot were cached shopper shells, not proof of complete crawlable content.
- v9.2.4 removes additional discovery agents (YouBot, Bravebot, Timpibot, Diffbot) from the block list and aligns shared/static robots, including AI2Bot and Google retrieval identifiers. Unnamed browsers used by AI services remain ordinary public visitors; this is not a claim to enumerate every future agent.
- Public search/AI GET and HEAD requests bypass human mirror caches and dispatch before both tenant types' cold/streaming exits. Public policy/FAQ pages are included; authenticated utility pages, APIs and writes are not granted any crawler exception. Host resolution and subdomain custom-domain redirects are retained.
- AI public HTML requests use one host-scoped **300/minute/IP** budget instead of two conflicting 60/minute buckets. Numeric limits now work as numbers (the old `120` argument was interpreted as `true`, yielding 60). Limits remain to contain spoofed UAs and protect customer browsing; API limits and private access controls are unchanged.
- 69 executable tests passed across robots-policy and Worker routing suites: allowed agents, cold custom/subdomain dispatch, warm-cache bypass, HEAD, numeric limits, private/write exclusions, 301-independent tenant identity and bounded per-host budgets. Worker syntax and preview build checks pass. Worker tests stub backend data; they do not claim a successful live corrected request before owner deployment.
- Redeployed the shared `seo-page` function. Static robots publication and Worker deployment remain owner actions; old Workers block ChatGPT before it reaches this function.

## Further improvements, in priority order

1. Connect Search Console for product indexing, queries and exclusions; measure impressions/clicks before targeting pages.
2. Validate representative homepage/category/PDP rendered HTML and structured data against visible content. A sampled live Googlebot homepage had its store h1 but no `/product/` links; this selector does not establish missing catalogue coverage because other URL forms may be used. The sitemap and public renderer need separate checks.
3. Replace repetitive, title-derived copy with verified product-specific specifications, useful care/size information and actual customer reviews. Never infer movement, materials, gender, warranty, stock or delivery promises solely from a title.
4. Remove stale hard-coded prices from descriptions, or maintain them when prices change. Prices in visible content and offer data must agree.
5. Audit all original image URLs for availability, including previously failing Hopknock suppliers; original merchant-owned photos improve attribution. No photos or URLs were modified here.
6. Measure cold mobile page timing and image readiness on real entry pages before performance changes. This audit did not run a full performance benchmark.
7. Monitor AI referrals and access failures after rollout. Allowing training crawlers is separate from search eligibility and does not guarantee recommendations or ranking. No crawler configuration can guarantee every product ranks.

## Official references

- [OpenAI crawler purposes and controls](https://developers.openai.com/api/docs/bots)
- [OpenAI publisher guidance](https://help.openai.com/en/articles/12627856)
- [Anthropic crawler guidance](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)
- [Perplexity crawler guidance](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)
- [Google robots guidance](https://developers.google.com/search/docs/crawling-indexing/robots/intro)
- [Google AI features and SEO](https://developers.google.com/search/docs/appearance/ai-features)