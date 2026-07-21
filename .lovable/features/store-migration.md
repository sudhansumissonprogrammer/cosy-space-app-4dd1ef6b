# Store Migration — Import from Other Platforms

**Built:** 2026-07-11
**Status:** ready-to-extract (v1.1 — categories + gallery + currency fixes)

## Summary
"Migrate My Store" app in the App Store. Merchant picks a source platform (Shopify, WooCommerce, or Generic/Dukaan/Shopdeck/custom), enters store URL + credentials, detects record counts, then runs a background job that paginates products, mirrors images to R2, and upserts into `public.products` as drafts. Idempotent via `migration_source_map` (unique on job+entity+source_id). Generic path uses sitemap discovery + JSON-LD/OpenGraph/microdata parsing — no AI, no headless browser. Works well on server-rendered stores (Shopify, WooCommerce, Shopdeck/Nushop, Dukaan, custom PHP). Fully JS-rendered SPAs (e.g. bewakoof.com) not supported.

### v1.1 additions (critical for end-to-end correctness)
- Worker now **creates rows in `public.categories`** (by `store_id + slug`) for every product's category and caches the map per invocation. Products still store the text `category` field (used by storefront filtering), and category rows drive the nav. `wantCategories` gate reads `job.entities.includes("categories")`.
- Worker now **mirrors the full image gallery** (up to 8 per product) to R2 and inserts `product_images` rows with `display_order`. Deletes existing gallery rows first so re-runs stay idempotent. Shopify/Woo expose `images[]` via new `shopifyImageUrls()` / `wooImageUrls()` helpers; generic scraper returns `image_urls[]` built from JSON-LD image + og:image.
- Product `currency` is now set from `stores.currency` on the merchant's store instead of the DB default `USD`.
- Fail-fast threshold relaxed: worker only marks a job `failed` on ≥3 list-fetch errors **when zero products have imported**. Once anything has landed, transient errors are logged but the job keeps advancing pages.
- `MigrationConfig.tsx` enables the **Categories** checkbox alongside Products (Customers/Orders still gated as coming soon).

## Files added
- `src/pages/appStore/MigrationConfig.tsx` — 3-step wizard UI (platform → credentials+detect → run+status polling).
- `supabase/functions/migration-detect/index.ts` — validates connection, returns record counts.
- `supabase/functions/migration-start/index.ts` — creates `migration_jobs` row, fire-and-forgets worker.
- `supabase/functions/migration-worker/index.ts` — paginates one page/invocation, upserts products, mirrors images, self-chains via HTTP until done.
- `supabase/functions/migration-status/index.ts` — returns job progress + recent errors.
- `supabase/functions/_shared/migration/shopify.ts` — Admin API list/count + normalize to Storivo product row.
- `supabase/functions/_shared/migration/woocommerce.ts` — WC REST v3 (basic auth) list/count + normalize.
- `supabase/functions/_shared/migration/generic.ts` — sitemap discovery, JSON-LD/OG/microdata scraper, Shopdeck `/catalogue/` support, slug/exclusion filters.
- `supabase/functions/_shared/migration/r2.ts` — `mirrorImageToR2()` via SigV4 (aws4fetch) to `cdn.shopbanao.in`.
- `supabase/migrations/20260711072018_bf1fc56c-5d90-479c-904e-843f74128151.sql` — `migration_jobs`, `migration_source_map` tables with RLS + GRANTs; adds `source_platform`, `source_id`, `source_url` cols on `products` with unique index for idempotent upserts.

## Files modified
- `src/lib/appStore/registry.ts` — added `migrate-store` app entry (beta) wired to `MigrationConfig`.
- `src/integrations/supabase/types.ts` — regenerated types for new tables/columns.

## Dependencies added
- none (edge fns use `npm:@supabase/supabase-js@2` and `npm:aws4fetch@1.0.20` already present in the project).

## Backend assumptions
- **Tables** (created by migration): `migration_jobs`, `migration_source_map`. Policies: owner-only via `stores.user_id`.
- **products table**: needs columns `source_platform text`, `source_id text`, `source_url text` + unique index `(store_id, source_platform, source_id) where source_id is not null` — migration handles it, but if main project already has different names, reconcile.
- **Edge functions** need these env vars (already set in main): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (`shopbanao-images`), `R2_PUBLIC_BASE` (`https://cdn.shopbanao.in`).
- Products land with `status='draft'` and `is_published=false` so merchant reviews before publishing.
- No AI usage. Only cost: edge-function invocations + R2 image ingress/storage.

## Known limits (document to user)
- Fully client-rendered SPAs (bewakoof.com-style) return no product data — needs headless browser fallback (not built).
- Shopify stores with generic `<title>` fallback may import products with the site name; JSON-LD path handles most correctly.
- Orders/customers not yet imported — products + images + categories only in v1.

## EXTRACTION PROMPT (paste in main ShopBanao chat)
```
@shopbanao-sandbox — extract feature "store-migration":
1. Read `.lovable/features/store-migration.md` in the attached project.
2. Copy every file under "Files added" to the same path here, including the SQL migration (regenerate its timestamp for this project).
3. Apply the changes under "Files modified" to the corresponding files here (registry.ts entry + types.ts regen).
4. Verify these env vars exist on the edge-function runtime: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE. Skip if already set.
5. Deploy edge functions: migration-detect, migration-start, migration-worker, migration-status.
6. Do not touch anything outside the listed files.
```