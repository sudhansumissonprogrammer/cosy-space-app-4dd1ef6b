
# Migrate all images to Cloudflare R2

Goal: all image uploads (logos, banners, hero, product images, category images, media library, external-image copies) go to R2 served via `https://cdn.shopbanao.in`. Existing Supabase Storage URLs get migrated in the background.

## Architecture

```text
┌─────────────┐      upload      ┌────────────────────┐
│  Frontend   │ ───────────────► │ edge fn: r2-upload │
│ (compressed │                  │  (S3 PUT to R2)    │
│  800w webp) │                  └──────────┬─────────┘
└─────────────┘                             │
                                            ▼
                                  ┌───────────────────┐
                                  │  R2 bucket        │
                                  │  shopbanao-images │
                                  └─────────┬─────────┘
                                            │ public via custom domain
                                            ▼
                                 https://cdn.shopbanao.in/<key>
```

Serving: Worker `/cf-img?url=&w=&q=` already proxies + resizes any URL, so cdn.shopbanao.in images get the same responsive variants and edge cache. `optimizeImageUrl()` will detect cdn.shopbanao.in and route through `/cf-img` (just like Supabase URLs today).

## Steps

### 1. New edge function `r2-upload`
- Auth: requires JWT (uses existing user session)
- Accepts: `multipart/form-data` with `file`, `bucket` (logical name like `product-images`), `path`
- Uses AWS SigV4 to PUT to R2 S3 endpoint (`https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com/<R2_BUCKET_NAME>/<key>`)
- Key layout preserves multi-tenancy: `product-images/<userId>/<storeId>/<timestamp>-<rand>-800w.webp` (same as today, just on R2)
- Returns `{ publicUrl: "https://cdn.shopbanao.in/<key>", path }`
- Sets `Content-Type`, `Cache-Control: public, max-age=31536000, immutable`

### 2. Update `src/lib/uploadOptimizedImage.ts`
- Replace `supabase.storage.from(bucket).upload(...)` with `supabase.functions.invoke("r2-upload", { body: formData })`
- Same compression pipeline (single 800w webp) — no UI change
- Returns the new `cdn.shopbanao.in` URL as `mainUrl`

### 3. Update `src/lib/imageOptimize.ts`
- Add CDN detection: if URL starts with `https://cdn.shopbanao.in`, append `?width=&quality=` via Worker `/cf-img` in prod, or just append `?w=&q=` if Worker supports R2 directly
- Existing pipeline-naming logic (`-800w.webp` → `-400w.webp`) keeps working; just the host changes

### 4. Update `image-ops/copy` edge function (external image import)
- Instead of `supabase.storage.from("product-images").upload(...)`, do the same S3 PUT to R2
- Returns cdn.shopbanao.in URL

### 5. Background migration: `r2-migrate-supabase-storage` edge function
- Admin-only (via `has_role(auth.uid(), 'admin')`)
- Paginates through these tables and rewrites Supabase Storage URLs → R2 URLs:
  - `products.image_url`, `product_images.image_url`, `categories.image_url`
  - `stores.logo_url`, `banner_url`, `mobile_hero_url`, `og_image_url`, `about_us_image_url`, `mobile_hero_images[]`
  - `store_pages.image_url`, `media_library.file_url`
- For each Supabase Storage URL:
  1. Download from Supabase
  2. PUT to R2 at the same path
  3. Update DB row with new cdn.shopbanao.in URL
- Run in batches of 50, return progress. Admin triggers manually from `/admin` page (button) until done.
- Safe to re-run (idempotent — skips URLs already on cdn.shopbanao.in).

### 6. Admin trigger UI
- Add a "Migrate images to R2" button in `src/pages/admin/AdminSettings.tsx` (or new section)
- Shows batch progress + count of remaining Supabase URLs

### 7. Worker passthrough (already done)
- `cdn.shopbanao.in` already bypasses the storefront route in the Worker (deployed last turn)
- `/cf-img` already accepts any URL → will resize R2 images the same way

## Technical details (for me)

- R2 S3 endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
- SigV4 region: `auto`, service: `s3`
- Public read: handled by R2 custom domain `cdn.shopbanao.in` (already active)
- Use Deno's `crypto.subtle` for HMAC-SHA256 (no extra deps needed for SigV4)
- All edge fns: `verify_jwt = true` for upload (user-scoped); admin migrate also checks `has_role`
- Keep `image-ops/resize` action for backward-compat during transition

## Out of scope (not changing)

- Supabase Storage buckets stay alive until migration completes — then can be emptied
- No DB schema changes (URLs are just stored as TEXT)
- No frontend UI/UX changes for users uploading
- Theme system, RPCs, RLS — untouched

## Rollout

1. Deploy edge fns + frontend changes → all NEW uploads go to R2 immediately
2. Run migration in admin panel in batches until 0 Supabase URLs remain
3. Verify everything loads, then optionally delete old Supabase Storage objects (you do manually)

Ready to build?
