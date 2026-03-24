

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
