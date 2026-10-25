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

## Verification in progress

Source review, official provider requirements, bounded multi-tenant HTTP/image sampling and existing regression tests are underway. Final feature classifications and corrections will be recorded below; no complete-platform certification is implied.