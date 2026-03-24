

# Backend Optimization Plan: 29 → 14 Edge Functions

## Current State

29 edge functions deployed. Many share overlapping DB queries, duplicated CORS boilerplate, and serve low-traffic SEO endpoints that can be consolidated.

## Architecture: Consolidated Function Map

```text
CURRENT (29 functions)              →  TARGET (14 functions)
─────────────────────────────────────────────────────────────
place-order                         →  place-order (keep)
razorpay-order                      →  razorpay-order (keep)
razorpay-verify                     →  razorpay-verify (keep)
razorpay-upi-intent                 →  razorpay-upi-intent (keep)
razorpay-payment-status             →  razorpay-payment-status (keep)
auth-proxy                          →  auth-proxy (keep)
auth-email-hook                     →  auth-email-hook (keep)
create-guest-account                →  create-guest-account (keep)
whatsapp-send                       →  whatsapp-send (keep)
whatsapp-templates                  →  whatsapp-templates (keep)
whatsapp-webhook                    →  whatsapp-webhook (keep)
process-email-queue                 →  process-email-queue (keep)
notify-order                        →  notify-order (keep)
delete-store                        →  delete-store (keep)

og-meta        ─┐
share-page      ├─ MERGE → seo-page (route: ?type=og|share|sitemap|robots|feed)
sitemap         │
robots-txt      │
product-feed   ─┘

bot-render                          →  bot-render (keep — large, distinct purpose)

log-error      ─┐
track-view      ├─ MERGE → ingest (route: ?type=error|view)
db-cleanup     ─┘  (cleanup becomes a scheduled invocation of same function)

image-resize   ─┐
copy-external   ├─ MERGE → image-ops (route: ?action=resize|copy)
                ─┘

get-store-by-domain                 →  DELETE (move to Cloudflare Worker KV)
verify-domain                       →  verify-domain (keep)
meta-capi                           →  meta-capi (keep)
```

**Result: 29 → ~17 functions (6 merged into 2, 1 deleted, 5 absorbed)**

Realistically the safest consolidation targets 3 merges:

---

## Merge 1: SEO Bundle → `seo-page`

**Functions merged:** `og-meta`, `share-page`, `sitemap`, `robots-txt`, `product-feed`

**Reasoning:** All 5 functions:
- Take `?slug=` as primary param
- Query the same `stores` table
- Return cacheable, public content
- Are called by Cloudflare Worker or direct URL (not `supabase.functions.invoke`)

**Design:**
- Single function with `?type=og|share|sitemap|robots|feed` query param
- One shared `getStore(slug)` call at the top
- Router dispatches to the appropriate handler
- Each handler keeps its exact current response format
- Eliminates 4 cold-start slots and 4 redundant store lookups

**Frontend impact:** Update 3 references:
- `src/components/ShareStoreDialog.tsx` → change URL path
- `src/pages/StoreTracking.tsx` → change feed URL
- Cloudflare Worker → update `og-meta`, `sitemap`, `robots-txt` calls

---

## Merge 2: Telemetry → `ingest`

**Functions merged:** `log-error`, `track-view`

**Reasoning:**
- Both are fire-and-forget POST endpoints
- Both use service-role inserts into simple tables
- Both have in-memory rate limiting
- Combined cold starts save ~200ms per first-hit

**Design:**
- `?type=error` → current `log-error` logic
- `?type=view` → current `track-view` logic
- Shared rate-limit map
- `db-cleanup` logic added as `?type=cleanup` route (cron-triggered)

**Frontend impact:** Update 2 references:
- `src/lib/logError.ts` → change endpoint URL
- `src/lib/trackPageView.ts` → change endpoint URL

---

## Merge 3: Image Ops → `image-ops`

**Functions merged:** `image-resize`, `copy-external-image`

**Reasoning:**
- Both deal with fetching/proxying external images
- Both have SSRF validation logic (duplicated)
- `image-resize` is a simple proxy (no actual resize in Deno)
- Shared URL validation and fetch logic

**Design:**
- `?action=resize` → current proxy behavior
- `?action=copy` (POST) → current copy-external-image behavior
- Shared `validateAndFetch(url)` utility

**Frontend impact:** Update 1 reference:
- `src/lib/imageOptimize.ts` → change URL path

---

## Function to Delete: `get-store-by-domain`

**Reasoning:** This function's logic is already duplicated in the Cloudflare Worker (which does the same custom_domain → slug resolution with caching). The edge function adds a redundant DB round-trip. Current frontend code does NOT call it via `functions.invoke`.

**Action:** Verify no active callers, then delete.

---

## PGMQ Assessment: KEEP

**Finding:** PGMQ is used exclusively for email delivery (`auth_emails`, `transactional_emails`) with:
- TTL-based expiry
- Dead-letter queues
- Idempotency keys
- Rate-limit backoff (429 handling)
- Retry budget tracking

**Verdict:** This is a textbook correct use of a message queue. Email delivery is business-critical (order confirmations, auth emails). Removing PGMQ would lose retry guarantees and risk silent email failures. **No changes recommended.**

---

## Performance Improvements (No Merge Required)

### 1. `bot-render`: Eliminate redundant `SELECT *`
Currently fetches `SELECT *` from stores. Change to select only needed columns (name, slug, logo_url, description, currency, meta_title, meta_description, og_image_url, banner_url).

### 2. `place-order`: Parallelize post-insert operations
Currently sequential: lead insert → coupon update → abandoned cart update → order_number fetch. These 4 operations are independent — run them with `Promise.all()`.

### 3. `notify-order`: Remove duplicate store query
Currently fetches order with joined store data, then formats. The store join is efficient but the function creates a Supabase client on every invocation — add connection reuse pattern.

### 4. `db-cleanup`: Add error_logs cleanup
Currently cleans page_views, abandoned_carts, email_send_log, whatsapp_messages. Should also clean `error_logs` older than 30 days (prevents the 144-error buildup seen earlier).

---

## Estimated Impact

| Metric | Before | After |
|--------|--------|-------|
| Edge functions | 29 | ~22 (safe phase 1) |
| Cold-start surface | 29 slots | 22 slots |
| Redundant store queries | ~8/request | ~3/request |
| Monthly function invocations | Baseline | ~15% fewer |
| Estimated cost reduction | $0 (functions are negligible) | Marginal |

**Honest cost assessment:** Edge function costs are already negligible (~$0.10/month). The real savings are in **latency** (fewer cold starts) and **maintainability** (fewer files to deploy/debug). The $5/month compute instance is the dominant cost and is unaffected by function count.

---

## Implementation Order (Safe for Live SaaS)

1. **Create `seo-page`** with router — deploy alongside existing functions
2. **Update Cloudflare Worker** to call `seo-page` instead of individual functions
3. **Update frontend references** (3 files)
4. **Verify** all SEO endpoints return identical responses
5. **Delete** old functions: `og-meta`, `share-page`, `sitemap`, `robots-txt`, `product-feed`
6. Repeat for `ingest` merge (log-error + track-view + db-cleanup)
7. Repeat for `image-ops` merge (image-resize + copy-external-image)
8. Delete `get-store-by-domain`
9. Apply `place-order` parallelization and `bot-render` column pruning

Each step is independently deployable and rollback-safe.

