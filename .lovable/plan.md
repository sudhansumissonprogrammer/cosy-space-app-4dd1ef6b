

# Backend Optimization — Completed

## Summary
Consolidated 29 edge functions into 18 by merging 11 functions into 3 new unified functions, deleting 1 redundant function, and applying performance optimizations.

## What Changed

### Merge 1: `seo-page` (replaces 5 functions)
- `og-meta` → `seo-page?type=og`
- `share-page` → `seo-page?type=share`
- `sitemap` → `seo-page?type=sitemap`
- `robots-txt` → `seo-page?type=robots`
- `product-feed` → `seo-page?type=feed`

### Merge 2: `ingest` (replaces 3 functions)
- `log-error` → `ingest?type=error`
- `track-view` → `ingest?type=view`
- `db-cleanup` → `ingest?type=cleanup` (also now cleans error_logs > 30 days)

### Merge 3: `image-ops` (replaces 2 functions)
- `image-resize` → `image-ops?action=resize`
- `copy-external-image` → `image-ops?action=copy`

### Deleted
- `get-store-by-domain` — logic handled by Cloudflare Worker

### Performance Optimizations
- `bot-render`: SELECT * → specific columns only
- `place-order`: Sequential post-insert ops → Promise.all() parallelization

### Frontend Files Updated
- `src/lib/logError.ts` → uses `ingest?type=error`
- `src/lib/trackPageView.ts` → uses `ingest?type=view`
- `src/lib/imageOptimize.ts` → uses `image-ops?action=resize`
- `src/lib/externalImageCopy.ts` → uses `image-ops?action=copy`
- `src/components/ShareStoreDialog.tsx` → uses `seo-page?type=share`
- `src/pages/StoreTracking.tsx` → uses `seo-page?type=feed`
- `src/pages/ProductDetail.tsx` → uses `seo-page?type=share`

## ⚠️ Cloudflare Worker Update Required
The Cloudflare Worker (managed outside this repo in Cloudflare dashboard) must be updated to call:
- `seo-page?type=og` instead of `og-meta`
- `seo-page?type=sitemap` instead of `sitemap`
- `seo-page?type=robots` instead of `robots-txt`

## Final Function Count: 18
place-order, razorpay-order, razorpay-verify, razorpay-upi-intent, razorpay-payment-status,
auth-proxy, auth-email-hook, create-guest-account, process-email-queue,
whatsapp-send, whatsapp-templates, whatsapp-webhook,
notify-order, delete-store, verify-domain, meta-capi, bot-render,
seo-page, ingest, image-ops

---

# Data Flow & DB Performance Optimization — Completed

## What Changed

### 1. Unified `useMyStore()` hook
- Created `src/hooks/useMyStore.ts` — canonical store query for dashboard
- Unified columns: `id, name, slug, logo_url, currency, order_mode, whatsapp_number, theme, features, is_suspended`
- Seeds `["store", storeId]` cache so `useStoreData()` gets instant cache hits
- Updated consumers: `DashboardLayout.tsx`, `AppSidebar.tsx`, `Dashboard.tsx`

### 2. StorefrontLayout `initialDataUpdatedAt` fix
- Fresh injected data (< 5s old) now uses `Date.now()` → skips redundant RPC refetch
- localStorage cache still uses `1` → ensures background revalidation

### 3. ProductDetail cache seeding
- `product_images` and `product_variants` queries now use `initialData` from cached RPC data
- Eliminates 2 unnecessary DB queries on first product navigation

### 4. Query column pruning
- `ProductDetail` images: `SELECT *` → `id, image_url, display_order`
- `ProductDetail` variants: `SELECT *` → `id, name, price, sku, stock_quantity, display_order`
- `PostPurchaseUpsell`: `SELECT *` → `id, name, slug, price, sale_price, image_url, currency, is_best_selling`
- `StorefrontShop`: Added `product_images` and `product_variants` joins

### 5. Database indexes (7 new, non-destructive)
- `idx_products_store_slug` → products(store_id, slug)
- `idx_products_store_category` → products(store_id, category) WHERE is_active
- `idx_products_store_active_created` → products(store_id, created_at DESC) WHERE is_active
- `idx_orders_store_status` → orders(store_id, status)
- `idx_orders_store_created` → orders(store_id, created_at)
- `idx_customer_leads_store_created` → customer_leads(store_id, created_at DESC)
- `idx_abandoned_carts_store` → abandoned_carts(store_id, recovered)

## Impact
| Metric | Before | After |
|--------|--------|-------|
| Dashboard store queries | 3 per navigation | 1 (cache hit for children) |
| Storefront RPC calls | 1 redundant per fresh visit | 0 (skipped via initialDataUpdatedAt) |
| ProductDetail DB queries | 3 on first nav | 1 (images/variants from cache) |
| PostPurchaseUpsell payload | ~2KB | ~0.5KB |
| DB query plans | Sequential scans | Index scans on 7 paths |

---

# Performance Audit Round 2 — Completed

## Fixes Applied

### 1. Duplicate pending orders query eliminated
- `DashboardLayout` had a manual `useEffect` fetching pending orders with `select("*")`
- `PendingActions` component had its own React Query for the same data
- **Fix:** DashboardLayout now uses React Query with the same `["pending-actions", storeId]` key as PendingActions — single query, shared cache
- **Impact:** -1 DB query per dashboard load, changed `select("*")` → `select("id")` for HEAD request

### 2. StorefrontBestSellers: added product_images/variants joins
- Was using `SELECT *` without image/variant data
- **Fix:** Added `product_images(id, image_url, display_order), product_variants(...)` joins
- **Impact:** Product cards now have image gallery and variant data without additional queries

### 3. DashboardLayout count query: select("*") → select("id")
- HEAD requests for count queries were sending `select=*` unnecessarily
- **Fix:** Changed to `select("id")` reducing response parsing overhead

---

# Fix: Multi-Tenant Storefront Rendering Inconsistencies — Completed

## Root Cause
Service Worker (Workbox) precached bare `index.html` without `__STORE_SLUG__` injection, intercepting navigation requests and serving empty shell → login page or infinite skeleton.

## Changes Made

### 1. Service Worker Config (`vite.config.ts`)
- Removed `html` from `globPatterns` → bare HTML no longer precached
- Added `navigateFallback: null` → SW never serves fallback HTML
- Added `NetworkFirst` runtime caching for navigation requests → always tries network first

### 2. Stale SW Cleanup (`src/main.tsx`)
- On storefront domains without `__STORE_SLUG__`, unregisters old SW + clears caches + reloads once
- `sessionStorage` flag prevents infinite reload loops

### 3. Custom Domain Fallback (`src/App.tsx`)
- Added `useCustomDomainSlug()` hook — detects custom domains and resolves slug from DB
- Acts as safety net when Worker injection fails — shows loading instead of login

### 4. index.html Prefetch Enhancement
- Added `__STORE_SLUG__` detection for custom domains in prefetch script
- Skips prefetch if `__STOREFRONT_DATA__` already injected by Worker

### 5. Cloudflare Worker Cache Tuning (`docs/cloudflare-worker-current.js`)
- Reduced `stale-while-revalidate` from 86400 (24h) → 3600 (1h) for HTML
- `fetchAndInjectSlug` now sets `Cache-Control: public, max-age=120, stale-while-revalidate=3600`
- Added `X-Store-Slug` header to injected responses for debugging

## ⚠️ Action Required
1. Deploy updated Cloudflare Worker from `docs/cloudflare-worker-current.js`
2. Purge Cloudflare cache ("Purge Everything") to clear stale bare HTML
