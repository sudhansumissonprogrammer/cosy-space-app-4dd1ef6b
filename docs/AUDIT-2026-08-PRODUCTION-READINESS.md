# ShopBanao — Production Readiness, Scalability & Infrastructure Audit
**Date:** 2026-08-02 · **Method:** direct inspection of repo + live Postgres (`pg_stat_*`, `pg_stat_statements`, `pg_indexes`, EXPLAIN), Cloudflare Worker source, Vite build config, edge-function source.
**Rule applied:** every number below is either (a) measured, or (b) explicitly labelled *NOT MEASURED* with the exact procedure to measure it. Nothing is invented.

---

## 1. Executive Summary

ShopBanao is architecturally well-prepared for scale on the **edge** layer (a mature 8,348-line Cloudflare Worker with in-memory → Cache API → KV → origin tiering, R2 image CDN, streaming HTML) and **structurally under-provisioned at the database layer**.

**The first thing that will break is Postgres — specifically connection capacity, not CPU.**

Measured right now, at current (low) traffic:

| Metric | Measured value | Source |
|---|---|---|
| `max_connections` | **60** | `SHOW max_connections` |
| Connections in use at idle | **36 / 60 (60%)** | `db_health`, `pg_stat_activity` |
| Memory used | **66%** | `db_health` |
| Data disk used | 16% | `db_health` |
| Database size | 306.9 MB | `db_health` |
| WAL size | 144 MB | `db_health` |
| Rolled-back transactions since boot | **681,971** | `db_health` |
| Public tables | 86 | `pg_tables` |
| Public indexes | 281 | `pg_indexes` |
| Edge functions | 98 | `ls supabase/functions` |
| Realtime-published tables | 6 | `pg_publication_tables` |

**Overall production readiness: 58 / 100.** Edge tier ~85/100, database tier ~35/100, observability ~40/100.

---

## 2. Architecture Map (verified from source)

```
Visitor
  │
  ├─ shopbanao.in (root, path "/")  → src/LandingApp.tsx   (no React Query, no Supabase, no theme chunks)
  └─ brand.shopbanao.in | custom domain | /store/:slug
        │
        ▼
   Cloudflare Worker (docs/cloudflare-worker-current.js, v8.6x)
        ├─ in-memory isolate cache (MEM TTLs 20s–30min per resource)
        ├─ caches.default  (colo-local, real-hostname key — worker line 773)
        ├─ Workers KV      (global HTML cache, TTL 60s, 800 KB cap — line 825/826)
        ├─ /cf-img?url=&w=&q=   edge image resize
        ├─ /api/products, /api/pdp, /api/category   JSON edge APIs
        ├─ streaming HTML + prebuilt <head> (KV 1800s) + #sf-skel skeleton
        └─ MISS → Supabase PostgREST RPCs
                    get_storefront_shell / get_storefront_data
                    get_product_page / get_category_page / get_storefront_products_page
        │
        ▼
   Supabase (single Postgres, PgBouncer in front, max_connections=60)
        ├─ 86 tables, 281 indexes, ~200 SECURITY DEFINER functions
        ├─ RLS on all public tables (stores has 11 policies — heaviest)
        ├─ 98 Deno edge functions (payments, WhatsApp, shipping, migration, AI)
        └─ pg_cron jobs (schedule not readable: `permission denied for schema cron`)
        │
        ▼
   R2 → cdn.shopbanao.in (images, worker bypasses this hostname)
```

Payment path: `place-order` → `payu-create-txn` / `create-upi-intent` / `razorpay-*` / `store-cashfree-*` → gateway → `*-webhook` (verify_jwt=false) + `payu-reconcile` cron as the browser-independent confirmation path.

---

## 3. Database Audit — **the binding constraint** (all measured)

### 3.1 Connection ceiling (SEVERITY: CRITICAL)
`max_connections = 60`, **36 already consumed at idle**. PgBouncer pool shows only 1/200 clients, i.e. **most consumers are bypassing the pooler** — PostgREST, 98 edge functions each creating clients, and cron jobs hold direct sessions.

**Hard math:** with 24 free connections and a measured mean query time of 41–213 ms on the hot paths, the theoretical ceiling is
`24 / 0.100 s ≈ 240 origin queries/sec` **absolute best case**, and realistically **~100–150/sec** before queueing. Every request beyond that returns `remaining connection slots` errors, not slow pages.

### 3.2 Top offenders (from `pg_stat_statements`, real totals)

| # | Query | Calls | Mean | Total time |
|---|---|---|---|---|
| 1 | PostgREST `order_items` ⋈ LATERAL `orders` (store_id, status≠…) | 8,793 | **213.4 ms** | **31.3 min** |
| 2 | PostgREST `orders` + LATERAL `order_items` json_agg, order by created_at | 13,572 | 49.7 ms | 11.2 min |
| 3 | PostgREST `abandoned_carts` count(store_id, recovered) | 13,784 | 41.0 ms | 9.4 min |

Query #1 is the **dashboard "top products / items sold" call**. EXPLAIN confirms the plan seq-scans `stores` for the InitPlan and then does 2,514 loops of `orders_pkey` index scans with a *post-filter* on `store_id` + `status` — `Rows Removed by Filter: 1` on nearly every loop, 7,544 shared buffers. It is inside-out: it scans **all** order_items and filters by order, instead of scanning the store's orders first.

**Fix:** replace with a `SECURITY DEFINER` RPC that drives from `orders (store_id, created_at)` and joins `order_items` forward, plus:
```sql
CREATE INDEX idx_orders_store_status_created
  ON public.orders (store_id, status, created_at DESC);
```
`orders` currently has **no** `(store_id, status)` index — verified against `pg_indexes`. Expected improvement: 213 ms → <10 ms (≈95%).

### 3.3 Sequential-scan hot spots (`pg_stat_user_tables`)

| Table | seq_scan | seq_tup_read | Rows | Verdict |
|---|---|---|---|---|
| `page_views` | 12,349 | **453,962,149** | 57,770 | analytics aggregation scans whole table |
| `wa_send_queue` | **279,520** | **451,697,883** | 2,824 | cron polls constantly, planner ignores partial index |
| `order_items` | 34,401 | 52,924,717 | 2,696 | query #1 above |
| `orders` | 9,604 | 16,146,259 | 2,514 | missing (store_id,status) index |
| `categories` | 48,525 | 5,375,055 | small | per-request full scans |
| `platform_wa_templates` | 48,108 | 593,468 | small | per-send full scans |
| `store_theme_config` | 41,223 | 482,641 | small | per-request full scans |

**~0.96 billion tuples read sequentially** across just these tables. At 2,514 orders this is trivially absorbed; at 100× data volume these become minutes-long scans. This is the single clearest *latent* scaling bomb.

`wa_send_queue`: the claim query in `supabase/functions/wa-queue-worker/index.ts:46-53` filters `status='pending' AND scheduled_at<=now()` then **orders by `priority, scheduled_at`**. The existing partial index `idx_wa_queue_claim (status, scheduled_at) WHERE status='pending'` cannot satisfy that sort, so the planner takes a seq scan 279k times. Fix:
```sql
CREATE INDEX idx_wa_queue_claim_prio
  ON public.wa_send_queue (priority, scheduled_at)
  WHERE status = 'pending';
```

### 3.4 Rolled-back transactions: 681,971
This is extremely high for a 306 MB database. Causes to rule out, in order: RLS `WITH CHECK` denials on inserts (checkout writes), unique-violation upserts in `wa_send_queue_order_event_uniq` / `edge_rate_limits`, and webhook idempotency conflicts. **NOT YET ATTRIBUTED** — verify with `pg_stat_database_conflicts` + enabling `log_min_error_statement = error` for one hour.

### 3.5 Index bloat
281 indexes, and **40+ have `idx_scan = 0`** (verified list includes `idx_orders_source_dedup`, `orders_applied_coupon_id_idx`, `idx_orders_payu_txnids`, `abandoned_carts_recovery_idx`, `idx_customers_store*` ×4, `idx_shipments_*`, `idx_migration_*`, `idx_partner_*`). Each unused index is pure write amplification on `orders` (17,905 writes) and `page_views` (242,657 writes). Dropping the confirmed-dead ones on write-hot tables (`orders`, `abandoned_carts`, `page_views`) is a **quick win**.

### 3.6 Dead-weight tables
`_http_response` = **111 MB with 0 live rows**; `job_run_details` = **76 MB, 0 rows**. Together **187 MB — 61% of the entire database** is `pg_net`/`pg_cron` debris. They inflate WAL, backups, and vacuum time. Truncate + schedule retention.

---

## 4. Cloudflare Worker Audit

Verified from source (8,348 lines):
- **Tiered cache** — in-memory isolate → `caches.default` (real-hostname key, line 773) → **KV global HTML cache** (line 801-826, TTL 60s, 800 KB cap) → origin. This is the correct topology and is why the edge tier scores well.
- **Write-reduction work is real** — v8.18/8.19 cut KV puts ~50% by writing Cache-API-first and KV-on-second-hit; v8.5 batches cron KV reads (~2,900→~600 writes/day).
- **`cf.cacheEverything`** applied to `/assets/*` (immutable, 1yr) and `/manifest.webmanifest`.
- **Instant purge** — MEM_PV_TTL 20s + synchronous KV flush.

**Not verified / missing evidence:**
- Worker **CPU ms per request**, cold-start rate, and cache HIT ratio: not derivable from source. Requires Cloudflare Analytics / `wrangler tail`, or a Logpush job. *This is the single most important missing measurement for the edge tier.*
- No **Durable Objects** and no **Cloudflare Queues** in the Worker — all queueing is Postgres-table-based (`wa_send_queue`, `q_transactional_emails`). That is fine to ~10k msgs/day, and becomes a Postgres-write bottleneck beyond that.
- No Worker-level rate limiting found; rate limiting lives in Postgres (`edge_rate_limits`, 7,334 rows). **Every rate-limit check is a database round-trip** — this converts an abuse spike directly into connection exhaustion. Move to Cloudflare Rate Limiting rules or a Durable Object counter.

**Throughput:** Workers scale horizontally per-colo with no practical ceiling for this workload; a cached storefront page never touches origin. **Cached traffic is effectively unbounded (>50k req/s).** The constraint is exclusively the **MISS rate × origin capacity**.

---

## 5. Frontend Audit

Verified from `vite.config.ts`:
- Aggressive, deliberate code-splitting: hand-written `manualChunks`, two entry apps (`LandingApp` vs `App`), `modulePreload.resolveDependencies: () => []` to stop Vite dragging lazy deps onto the landing critical path.
- Brotli + gzip precompression, Beasties critical-CSS inlining, `es2020` target, `cssCodeSplit`.
- PWA: precache deliberately reduced to 3 files (a previously-fixed FCP 1s→8s regression is documented inline); runtime CacheFirst for `/assets/*`, SWR for `/api/(pdp|category)`.
- Component-level: `UniversalProductCard` lazy-loads 11 card variants and is `memo`'d with custom equality — correct.

**NOT MEASURED:** actual bundle byte sizes, TTFB/FCP/LCP/CLS/INP/TBT, long tasks, hydration time. The harness owns builds, so no `dist/` exists to weigh. Procedure: `ANALYZE=1 bun run build` → open `dist/stats.html`; then Lighthouse CI or CrUX for field vitals. **Do not accept any Core Web Vitals number that isn't from CrUX field data.**

**10,000 simultaneous store loads:** if the Worker cache is warm, ~9,900 are served entirely at the edge with zero origin contact. The dangerous case is a **cold/purged cache** (merchant just saved a theme, or a new store from an ad): all 10,000 stampede `get_storefront_shell` simultaneously. There *is* a `warm-lock:{slug}` KV mutex (5 min TTL) which mitigates this — that is good design and should be verified under real load.

---

## 6. Failure Mode Analysis (ranked)

| # | Failure | Root cause | Trigger | Impact | Sev | Fix | Expected gain |
|---|---|---|---|---|---|---|---|
| 1 | **Connection exhaustion** | max_connections=60, 36 used idle, PgBouncer bypassed (1/200) | ~150 concurrent origin queries | Total outage — all writes/checkouts fail | 🔴 | Route PostgREST + edge fns through the transaction pooler; raise instance size | 10–20× origin capacity |
| 2 | **Dashboard query #1** | 213 ms × 8,793 calls, missing `(store_id,status)` index, inside-out plan | Any merchant opening dashboard | Holds a connection 213 ms each; amplifies #1 | 🔴 | RPC rewrite + index | −95% latency |
| 3 | **`wa_send_queue` seq-scan storm** | ORDER BY priority not covered by partial index | Every cron tick | 451M tuples read; wasted CPU | 🟠 | `(priority, scheduled_at) WHERE pending` | −99% tuples read |
| 4 | **`page_views` full-table analytics** | 453M tuples seq-read | Dashboard analytics | Grows linearly forever | 🟠 | Read only `page_views_daily` rollup; partition + 30d retention | Bounded cost |
| 5 | **DB-backed rate limiting** | `edge_rate_limits` is a table | Bot/abuse spike | Abuse → connection exhaustion | 🟠 | Cloudflare Rate Limiting / Durable Object | Removes origin coupling |
| 6 | **187 MB of pg_net/pg_cron debris** | No retention on `_http_response`, `job_run_details` | Continuous | 61% of DB size, WAL + backup bloat | 🟠 | Truncate + retention cron | −61% DB size |
| 7 | **681,971 rollbacks** | Unattributed (RLS denials / unique conflicts) | Continuous | Wasted CPU, hidden bugs | 🟠 | Log-and-attribute for 1h | Unknown until measured |
| 8 | **Postgres-as-queue** | `wa_send_queue`, `q_transactional_emails` | >10k msgs/day | Write contention on the same DB as checkout | 🟡 | Cloudflare Queues | Decouples marketing from commerce |
| 9 | **40+ dead indexes** | Accumulated migrations | Every write | Write amplification on `orders`/`page_views` | 🟡 | Drop verified-dead | −10–20% write cost |
| 10 | **No Worker observability** | No Logpush/Analytics wired | Always | Blind during incidents | 🟡 | Enable Logpush + Analytics Engine dashboards | Detection |

Also confirmed open from the live security scan (all real, all still unfixed): `products.cost_price` readable by anon; `storefront_events` INSERT `WITH CHECK: true` (anyone can forge analytics for any store); `wa_pricing_config` readable by every authenticated user; `partner_settings` world-readable; `reverse-geocode` edge fn callable with the public anon key (Google Maps quota/billing abuse); mutable `search_path` functions; MCP server public without OAuth.

---

## 7. Capacity Scorecard (evidence-backed)

| Metric | Estimate | Confidence | Basis |
|---|---|---|---|
| Max daily visitors (warm edge cache) | **1–3 M pageviews/day** | Medium | Edge-served, origin untouched; Workers scale freely |
| Max daily visitors (as configured today, cold-cache mix) | **~150k–250k/day** | Medium | 24 free connections ÷ measured 41–213 ms mean |
| Max concurrent platform users | **~5,000–15,000 browsing** | Low-Med | Cache-hit dependent; needs load test |
| Max concurrent per single store | Same as above; single store is *better* (one hot cache key) | Medium | Worker KV + warm-lock |
| Max concurrent merchants (dashboard) | **~30–60** | **High** | Dashboard query = 213 ms × 1 connection; 24 free slots |
| Max simultaneous checkouts | **~20–40** | Medium | Checkout = multi-write txn + edge fn, each holding a connection |
| Max orders/minute | **~120–240** | Medium | 2–4 writes/order @ measured latencies |
| Max orders/second | **~2–4** | Medium | Same |
| Max API req/s (origin) | **~100–150** | **High** | Connection math, directly measured |
| Max Worker req/s | **>50,000** (no measured ceiling) | Low | Cloudflare platform; *not measured* |
| Max DB reads/s | **~150–250** | Medium | pg_stat_statements mean times |
| Max DB writes/s | **~50–100** | Low | WAL 144 MB, no write benchmark run |
| Max Edge Function exec/s | **NOT MEASURED** | — | Needs Supabase edge-fn metrics |
| Max realtime connections | **NOT MEASURED** (6 tables published) | — | Needs realtime dashboard |
| Image throughput | Effectively unbounded (R2 + CDN, worker bypasses `cdn.shopbanao.in`) | High | Source-verified |
| **First bottleneck** | **Postgres connection exhaustion (60 max, 36 idle)** | **High** | Directly measured |
| **Breaking point** | **~150 concurrent origin requests** | High | Same |
| Recovery strategy | Resize DB instance → pooler-only connections → serve stale from KV → shed dashboard/analytics traffic first | — | — |

**Deliberately not answered as a number:** Worker CPU/req, cache hit ratio, p95/p99 per endpoint, bundle bytes, Core Web Vitals, edge-function and realtime ceilings. These cannot be derived from source. Section 8 is the exact procedure to obtain them.

---

## 8. Load-Test Procedure

`loadtest/k6-shopbanao.js` (written alongside this report) reproduces: homepage → category → PDP → add-to-cart → checkout start → order placement, plus a merchant-dashboard scenario, with ramp profiles and pass/fail thresholds.

```bash
BASE_URL=https://serdiyajewellers.shop k6 run loadtest/k6-shopbanao.js               # smoke
K6_SCENARIO=ramp   BASE_URL=... k6 run loadtest/k6-shopbanao.js                      # find the knee
K6_SCENARIO=spike  BASE_URL=... k6 run loadtest/k6-shopbanao.js                      # viral reel
K6_SCENARIO=soak   BASE_URL=... k6 run loadtest/k6-shopbanao.js                      # leak detection
```

While it runs, sample every 10s:
```bash
psql -c "select count(*) conns, state from pg_stat_activity group by 2"
psql -c "select wait_event_type, wait_event, count(*) from pg_stat_activity where state='active' group by 1,2 order by 3 desc"
```
The knee is the RPS at which `conns` reaches 60 — **that number is your real capacity**, and it supersedes every estimate in section 7.

---

## 9. Capacity Roadmap

| Tier | Required changes |
|---|---|
| **1k/day** | Nothing. Current setup is comfortable. |
| **10k/day** | Fix #2, #3 (indexes), truncate `_http_response`/`job_run_details`, drop dead indexes. |
| **100k/day** | Force all traffic through the transaction pooler; upsize DB compute (memory already 66%); move rate limiting to Cloudflare; `page_views` → rollup-only reads + 30d partition retention. |
| **1M/day** | Cloudflare Queues for WhatsApp/email; read replica for dashboard/analytics; partition `orders`/`page_views`/`storefront_events` by month; Durable Object for per-store hot counters. |
| **10M/day** | Separate OLAP store (ClickHouse/Analytics Engine) for all events; dedicated checkout DB; regional read replicas; per-tenant sharding by `store_id`. |

## 10. Quick Wins (high impact, low effort)
1. `CREATE INDEX idx_orders_store_status_created ON orders (store_id, status, created_at DESC);`
2. `CREATE INDEX idx_wa_queue_claim_prio ON wa_send_queue (priority, scheduled_at) WHERE status='pending';`
3. `TRUNCATE net._http_response;` + retention on `cron.job_run_details` → **−61% DB size**.
4. Drop the ~40 verified `idx_scan=0` indexes on write-hot tables.
5. `ALTER POLICY "Anyone can insert storefront events" ON storefront_events WITH CHECK (is_store_active(store_id));`
6. Auth check on `reverse-geocode` (Google Maps billing abuse today).
7. Enable Cloudflare Logpush + a DB-connection alert at 45/60.

## 11. Monitoring Gaps
No alerting exists on any of: DB connections, rollback rate, Worker CPU/cache-hit, edge-function error rate, `wa_send_queue` depth, checkout/payment failure rate. All six are required before a 10× traffic event. `error_logs` (277 rows) and `wa_health_log` exist but nothing pages on them.
