# Live stock sync: shodfedf.jdwebshop.com → wristlife

## What I verified on the source (live tests, just now)

- The source store exposes a public product API. Their per-product endpoint returns exactly what we need: `quantity`, `in_stock`, `product_status` (delisted flag), `final_price`, `old_price`.
- **Our product slugs are identical to theirs.** I picked 20 random wristlife products and looked each one up on the source — 20/20 matched, no mapping table needed. This is the key finding: sync is a direct slug lookup.
- Speed: ~210 ms per product. At 6 parallel requests a **full 2,615-product sweep takes ~90 seconds**.
- Their firewall blocks aggressive scraping: 20 parallel requests → instant `403`. 6 parallel with browser-like headers → 100% success. So the sync must be politely paced.
- There is also a "recent products" list endpoint (12 per page) that returns quantity for a whole page in one call — cheap for scanning new arrivals.

Conclusion: real-time-ish sync is fully doable. True per-second real-time is not (they have no webhook/push), so the right design is **tiered polling + a live check at the moment it matters**.

## The design (3 layers)

**Layer 1 — Live check at purchase time (this is what actually prevents overselling)**
When a shopper opens a product page and again when the order is placed, we ask the source for that one product's stock (~200 ms). If it is 0, the product shows Sold Out and the order is blocked with a clear message. Even if polling is 5 minutes stale, nobody can buy a sold-out item.

**Layer 2 — Hot sweep every 2 minutes**
Sync only products that matter right now: anything viewed, added to cart, wishlisted or in a pending order in the last 24 h, plus the newest arrivals page. Roughly 100–200 lookups per run — light and safe.

**Layer 3 — Full sweep every 30 minutes**
Walks the entire 2,615-product catalog in rotating chunks (~600 products per run, full catalog covered every ~30 min). Updates stock, marks delisted products inactive, and optionally syncs price changes.

## Safety rules baked in

- Never zero out stock on an API error, timeout or non-200 — stock only changes on a valid response. A source outage can never blank the store.
- Concurrency capped at 6 with retry/backoff on 403/429, browser headers, and a kill switch to pause syncing.
- Only products changed in a run trigger a storefront cache purge, so the site stays fast.
- Every run logs counts (checked / changed / out-of-stock / errors) so you can see it working.

## Options for you to choose

1. **Price sync on/off** — the source also returns current price. Do you want price + MRP kept in sync too, or stock only (so your own pricing stays untouched)?
2. **Out-of-stock behaviour** — show the product as "Sold Out" (greyed, not buyable) or hide it from the catalog entirely?
3. **Stock buffer** — treat source quantity ≤ 1 as sold out (safety margin against a race with their other resellers), or use exact 0?

## Technical outline

- New edge function `jd-stock-sync` with modes `hot` | `full` | `single`, invoked by two cron schedules (2 min / 30 min) and directly from the product page + `place-order`.
- Columns added to `products`: `source_ref` (source SKU), `source_synced_at`, and a store-level toggle so this only runs for wristlife.
- Source credentials (API key, host, store hash) stored as backend secrets, not in code.
- Sync writes: `stock_quantity`, `is_active` (from `product_status`), optional `price`/`sale_price`, `source_synced_at`.
- Dashboard panel showing last sync time, items changed, and a "Sync now" button.
