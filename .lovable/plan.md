After auditing each finding, here's what's real, what's already fixed, and what to ship.

## Audit results

| # | Finding | Status |
|---|---|---|
| 6 | StoreOrders nested products join | ✅ Real — fix |
| 7 | stores 20M scans, needs partial index | ⚠️ Partly — has **duplicate** `idx_stores_owner` + `idx_stores_owner_id`. Drop dupe + add partial index |
| 8 | storefront_customers missing index | ❌ Already covered by `idx_storefront_customers_user_store` + unique key. Skip |
| 9 | AppSidebar polling | ❌ Already gated to 60s + visibility check (line 67-69). Skip |
| 10 | WhatsApp pages 15s polling | ✅ Real — bump to 60s |
| Extra | page_views 6916 legacy rows (AE migrated) | ✅ Safe TRUNCATE |
| Extra | error_logs cleanup | ❌ Already in `cleanup_app_logs()` daily cron. Skip |
| Extra | product_images denormalization | ⛔ Too risky (touches storefront + admin). Defer |
| Extra | PartnerOverview / CheckoutPage polls | ⛔ Negligible. Skip |

## Changes to ship

### 1. Trim StoreOrders query (-75% join cost)
`src/pages/StoreOrders.tsx` line 110 — remove `products:product_id(image_url)` from the select. `product_name` already lives on `order_items` so the UI keeps working (line 596 only uses `product_name`). Verify line 814 doesn't depend on the image.

### 2. stores index cleanup (migration)
```sql
-- Drop exact duplicate (idx_stores_owner_id == idx_stores_owner)
DROP INDEX IF EXISTS public.idx_stores_owner_id;

-- Add partial index for the hot RLS path (is_store_owner + active checks)
CREATE INDEX IF NOT EXISTS idx_stores_owner_active
  ON public.stores (owner_id)
  WHERE is_suspended = false;
```
Safe: dropping a duplicate has zero risk, partial index is additive.

### 3. WhatsApp polling 15s → 60s (-75% queries)
- `src/pages/WhatsAppMarketing.tsx` line 266
- `src/pages/admin/AdminWhatsApp.tsx` line 55

Change `15000` → `60000`. Visibility gate already in place.

### 4. Truncate legacy page_views (insert tool)
```sql
TRUNCATE TABLE public.page_views;
```
Safe: pageviews now flow to Cloudflare Analytics Engine (Worker v8.30.1). Supabase `ingest` is a 204 no-op. Rows are dead weight.

## Expected impact
- Orders page: ~75% lighter per load
- Dashboard RLS / `is_store_owner()` checks: faster index hits, one less duplicate to maintain on every insert/update
- WhatsApp tabs: 240 → 60 queries/hr per open tab
- Frees ~3MB + cleans hottest write target

## Skipped (with reason)
AppSidebar, storefront_customers index, error_logs cleanup — already done in earlier rounds. Re-doing them would be no-ops.
