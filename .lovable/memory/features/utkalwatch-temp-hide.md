---
name: Utkal Watches temporary hide
description: Temporary state where only the Casio New (renamed Utkalwatch New) collection is live on utkalwatch.in; revert via temp_hide_snapshot_utkal
type: feature
---

Applied 2026-08-27 (TEMPORARY, store `utkalwatches` / ab19143d-87a9-490e-90b7-837313522782):

- All products deactivated except the 15 in category `casio-new`.
- All categories `is_hidden = true` except `casio-new`.
- `store_trust_videos.is_active = false` (floating video reel off).
- `store_apps` `shop-by-video` and `card-video` disabled.
- "Casio" → "Utkalwatch" in the 15 product names + `products.category`; category name now "Utkalwatch New" (slug still `casio-new`).

Revert: table `public.temp_hide_snapshot_utkal` holds prior values per row
(kind = product | category | trust_video | store_app). Restore from it, drop the
table, then purge cache via edge function `purge-cache` with the `x-cron-secret`
header. Note the Casio→Utkalwatch rename is also captured in the snapshot.
