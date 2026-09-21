# URL-first store migration during onboarding

## Goal
Ask new merchants whether they already have a website. If they do, accept one store URL and create their ShopBanao store immediately while a safe background import copies all publicly visible store content.

## User flow
1. Add an “Already have a website?” choice to store creation.
2. When selected, show one validated website URL field; do not ask for Shopify or WooCommerce credentials at this stage.
3. Create the ShopBanao store first, without demo products that would mix with imported inventory.
4. Detect the source automatically from public signals, preview what was found, and start the import in the background.
5. Show clear progress for products, categories, images, and pages. Let the merchant enter the dashboard while migration continues.
6. After the public import, offer an optional secure connection for private customers and order history. Public URLs cannot expose those records.

## Migration engine changes
- Add automatic platform detection with a public-first path for Shopify, WooCommerce, Dukaan/Shopdeck, and custom stores.
- Import public products, prices, descriptions, stock signals, variants where publicly available, galleries, category relationships, category images, store logo/banner, About/Contact/policy pages, and basic SEO metadata.
- Keep imported products as drafts until review, preserve currency, and mirror images to the existing Cloudflare image storage.
- Use stable source IDs and mapping records so retries are idempotent and never duplicate products, categories, images, or pages.
- Add bounded discovery, response-size limits, private-network blocking, redirect validation, and per-store rate controls for safe URL fetching.
- Add durable worker claiming, retry/backoff, a stalled-job recovery path, accurate progress derived from import records, cancellation, and credential cleanup.
- Keep unsupported or JavaScript-only pages visible as warnings rather than silently claiming a complete migration.

## Accuracy and review
- Produce an import summary showing discovered, imported, skipped, and failed records by type.
- Flag zero-price, missing-image, duplicate, or unparseable products for review.
- Never publish imported products automatically.
- Do not claim orders/customers were migrated until the merchant completes the later secure connection and those records are verified.

## Verification
- Test URL-only imports against representative Shopify, WooCommerce, sitemap-based, and JavaScript-heavy stores.
- Verify store ownership, cross-store isolation, SSRF protection, idempotent retry, cancellation, image mirroring, category relationships, and draft visibility.
- Verify onboarding remains fast when no existing website is selected and that migration failures never block store creation.
