# ShopBanao Load Testing & Monitoring Framework

> Live Meta Ads are running against production. **Nothing in this framework
> puts destructive load on production.** Destructive tests are hard-blocked in
> code — see `loadtest/lib/config.js` `guard()`.

---

## 1. Safety classification of every proposed test

| # | Test | Safe on production? | Verdict | Why |
|---|---|---|---|---|
| 1 | Read-only page GETs, ≤20 VUs, human pacing | Yes | **Run on prod (canary)** | Below organic traffic; served from CF cache; no writes |
| 2 | Static asset / robots / sitemap probes | Yes | **Run on prod** | Pure cache reads |
| 3 | `pg_stat_*` sampling | Yes | **Run on prod** | Read-only catalog views, microseconds |
| 4 | `EXPLAIN` (without `ANALYZE`) | Yes | **Run on prod** | Plans only, no execution |
| 5 | Ramp to 100+ VUs on storefront | No | **Staging only** | Cache-miss fan-out saturates the 60-connection Postgres pool |
| 6 | Spike test (1500 VUs) | No | **Staging only** | Guaranteed connection exhaustion → real shoppers get 500s mid-checkout |
| 7 | Soak test (60 min) | No | **Staging only** | Sustained connection pressure + WAL/bloat growth |
| 8 | Checkout / `place-order` write path | No | **Staging only** | Mints real pending orders, pollutes lead lists, can trigger WhatsApp recovery to real numbers |
| 9 | Payment gateway calls | No | **Staging only, sandbox keys** | Real PayU/Razorpay/Cashfree txns and merchant-side rate limits |
| 10 | Pixel / CAPI event flooding | No | **Never, anywhere with live creds** | Event inflation → Meta flags the pixel and ad account. Existential risk |
| 11 | WhatsApp send-path load | No | **Never with live WABA** | Meta frequency capping + template quality score damage |
| 12 | Edge Function concurrency ramp | No | **Staging only** | Shares the Postgres pool and function concurrency with real checkout |
| 13 | `EXPLAIN ANALYZE` on heavy queries | No | **Staging only** | Actually executes; a bad plan can pin CPU |
| 14 | `VACUUM FULL` / index rebuild | No | **Staging only** | Takes `ACCESS EXCLUSIVE` locks — full outage |
| 15 | Cache purge / worker redeploy under load | No | **Staging only** | Thundering herd onto origin |
| 16 | Realtime connection ramp | No | **Staging only** | Realtime shares project resource limits |
| 17 | Storage / image throughput flood | No | **Staging only** | R2 egress cost + CF rate limiting on the real zone |

**Result: only tests 1–4 run on production.** Everything else is gated behind
`TARGET_ENV=staging` plus a production-hostname denylist. There is deliberately
no override flag.

---

## 2. What is in the framework

```text
loadtest/
  lib/config.js                     shared helpers + production safety guard
  k6-prod-canary.js                 PROD-SAFE   read-only, ≤20 VUs
  k6-staging-storefront.js          STAGING     read ramp / step / spike / soak
  k6-staging-checkout-write.js      STAGING     order write path
  k6-staging-edge-functions.js      STAGING     Edge Functions + Postgres RPCs
  k6-shopbanao.js                   legacy combined script (pre-dates the guard)
  sql/monitoring.sql                12 read-only live monitoring queries
  sql/capacity-snapshot.sql         before/after capacity snapshot
  scripts/sample-db.sh              10s Postgres sampler → TSV
  scripts/health-check.sh           ~8 GETs, cron-safe prod health check
  data/sanitize-staging.sql         destroys PII + disables all outbound channels
  data/verify-sanitized.sql         pre-flight gate, must be all zeros
  data/cleanup-staging.sql          removes k6-created rows
  reports/TEMPLATE.md               the report shape to fill after each run
```

---

## 3. Metrics to collect

### 3.1 Client-side (k6)
`http_reqs` rate · `http_req_duration` p50/p95/p99 · `http_req_failed` ·
`http_req_waiting` (TTFB) · `http_req_connecting` + `tls_handshaking` ·
`vus` vs `iterations` (queueing signal) · custom: `sb_edge_cache_hit`,
`sb_origin_miss`, `sb_place_order_ms`, `sb_rpc_ms{rpc:...}`, `sb_errors`.

### 3.2 Cloudflare Worker
Requests/s · CPU ms per request (p50/p99) · subrequest count/request ·
`Exceeded CPU` and `Exceeded memory` error counts · cache HIT/MISS/EXPIRED/BYPASS
ratio by path class · KV read/write ops + latency · 5xx by colo ·
`/cf-img` transform count and latency.
Sources: Cloudflare dashboard → Workers Analytics, `wrangler tail`, Analytics Engine
(already used for pageviews per `mem://infrastructure/ae-pageviews`).

### 3.3 Edge Functions
Invocations/s per function · wall-clock duration p95/p99 · error rate by status
(`4xx` vs `5xx` vs `546` OOM/timeout) · cold-start rate · concurrent executions ·
outbound call latency (PayU, Meta, WhatsApp).

### 3.4 Postgres — the known first bottleneck
Connections used / `max_connections` (currently **60**, ~36 used at idle) ·
active vs idle vs idle-in-transaction · query p95 by statement
(`pg_stat_statements`) · buffer cache hit ratio (target >0.99) ·
lock waits & blocking chains · deadlocks · temp file bytes (work_mem spills) ·
seq scans on tables >5k rows · dead-tuple % and autovacuum lag ·
WAL retained by replication slots · database size growth.

### 3.5 Queues, storage, realtime
`wa_send_queue` depth + oldest unsent age · `email_send_state` backlog ·
retry/permanent-error counts · R2/CDN egress GB, request rate, 4xx/5xx ·
image p95 delivery time · realtime concurrent connections, messages/s,
subscription count per client.

### 3.6 Business guardrails (prod, passive)
Orders/hour vs 7-day baseline · checkout→paid conversion · pending-order ratio ·
Pixel `Purchase` count vs DB paid orders (drift = tracking break) ·
error_logs rate.

---

## 4. Cloning production into staging

The goal is **same shape, same size, zero real people**.

### 4.1 Create the staging backend
1. Create a second Supabase project in the **same region** and **same compute
   tier** as production. Parity matters — a bigger staging instance produces a
   breaking point you cannot trust.
2. Apply the full migration history so the schema, RLS policies, GRANTs,
   functions and the RPC-overload event trigger are identical.
3. Deploy every edge function to the staging project.

### 4.2 Copy the data
```bash
# From a Supabase-managed prod DB, use the platform's export
# (Cloud → Advanced settings → Export data), then restore into staging:
psql "$STAGING_DATABASE_URL" -f prod-export.sql
```
Analytics tables (`page_views`, `storefront_events`) are the bulk of the volume;
you can restore only the last 7 days and still get a representative index profile.

### 4.3 Sanitize — mandatory, before the app is pointed at it
```bash
psql "$STAGING_DATABASE_URL" -f loadtest/data/sanitize-staging.sql
psql "$STAGING_DATABASE_URL" -f loadtest/data/verify-sanitized.sql   # must be all zeros
```
This removes PII, nulls `facebook_pixel_id` / `meta_access_token`, sets
`capi_disabled = true`, disables every WhatsApp toggle and template, empties the
send queue and push subscriptions, and forces payment providers to sandbox.

### 4.4 Staging frontend + edge
- Deploy the app to `staging.<your-domain>` behind a **separate Cloudflare zone
  or subdomain**, with its own Worker deployment.
- Point `VITE_SUPABASE_URL` / publishable key at the staging project.
- Add `Disallow: /` to staging `robots.txt` and put the zone behind Cloudflare
  Access so Meta's crawler and real shoppers can never reach it.
- Verify with `curl -I` that the staging Worker version matches production's.

### 4.5 Pre-flight checklist (all must be true before load)
- [ ] `verify-sanitized.sql` returns zeros on every line
- [ ] staging host is not in `PRODUCTION_HOSTS` in `lib/config.js`
- [ ] payment env vars are sandbox
- [ ] `LOVABLE_API_KEY`/AI keys removed or rate-capped on staging
- [ ] cron jobs (`wa-cart-recovery-cron`, `billing-cron`, `payu-reconcile`) disabled on staging
- [ ] `capacity-snapshot.sql` captured as the "before" baseline

---

## 5. Running the tests

### 5.1 Production — passive only
```bash
# every minute via cron
BASE_URL=https://serdiyajewellers.shop ./loadtest/scripts/health-check.sh

# short canary, 5 VUs, read-only
BASE_URL=https://serdiyajewellers.shop VUS=5 DURATION=3m \
  k6 run loadtest/k6-prod-canary.js

# passive DB observation while real traffic flows
./loadtest/scripts/sample-db.sh 10 600 > /tmp/prod-db-samples.tsv
```

### 5.2 Staging — destructive
```bash
export TARGET_ENV=staging
export BASE_URL=https://staging.example.dev

# 1. baseline
psql "$STAGING_DATABASE_URL" -f loadtest/sql/capacity-snapshot.sql > before.txt

# 2. start the DB sampler in another terminal
PGHOST=... ./loadtest/scripts/sample-db.sh 10 1800 > db-samples.tsv

# 3. find the knee (read path)
K6_SCENARIO=step k6 run loadtest/k6-staging-storefront.js

# 4. isolate the origin (no CF cache in front)
SUPABASE_URL=... SUPABASE_ANON_KEY=... STORE_SLUG=demo \
  K6_SCENARIO=step k6 run loadtest/k6-staging-edge-functions.js

# 5. write path
STORE_ID=... PRODUCT_ID=... K6_SCENARIO=ramp \
  k6 run loadtest/k6-staging-checkout-write.js

# 6. spike + soak
K6_SCENARIO=spike k6 run loadtest/k6-staging-storefront.js
K6_SCENARIO=soak  k6 run loadtest/k6-staging-storefront.js

# 7. clean up + after-snapshot
psql "$STAGING_DATABASE_URL" -f loadtest/data/cleanup-staging.sql
psql "$STAGING_DATABASE_URL" -f loadtest/sql/capacity-snapshot.sql > after.txt
```

**Breaking-point definition** (use this consistently): the lowest step at which
`http_req_failed > 1%` **or** p95 exceeds 3× the 25-VU baseline **or** Postgres
connections hit 100% for more than 30 consecutive seconds.

Fill in `loadtest/reports/TEMPLATE.md` after every run.

---

## 6. Excluding synthetic traffic from analytics

All scripts send a distinctive User-Agent (`k6-shopbanao-canary`,
`k6-shopbanao-loadtest`). To keep Meta/GA/internal analytics clean:
- Worker: skip the Analytics Engine pageview write when the UA starts with `k6-`.
- `usePageviewBeacon` / pixel code never runs for these requests because k6 does
  not execute JavaScript — Pixel and CAPI are structurally untouched by k6.
- Filter `page_views` / `storefront_events` on the same UA prefix when reporting.

---

## 7. Monitoring to stand up (independent of load testing)

| Layer | Signal | Where | Alert threshold |
|---|---|---|---|
| Postgres | connections % of max | `sample-db.sh` / cron into a table | >70% for 2 min |
| Postgres | idle-in-transaction count | same | >5 |
| Postgres | deadlocks delta | `pg_stat_database` | any increase |
| Postgres | cache hit ratio | `monitoring.sql` §5 | <0.98 |
| Edge Fn | 5xx rate per function | function logs | >1% over 5 min |
| Worker | CPU-exceeded errors | CF Workers analytics | any |
| Worker | cache hit ratio | CF analytics | <80% |
| Queue | `wa_send_queue` oldest unsent | SQL cron | >15 min |
| Business | paid orders/hour vs baseline | SQL cron | <50% of 7-day median |
| Business | Pixel Purchase vs DB paid orders | daily diff | drift >10% |
| Uptime | `health-check.sh` | 1-min cron | 2 consecutive failures |

---

## 8. Why the capacity report is not filled in yet

The measured breaking point, first failing subsystem, bottleneck chain and the
10×/100×/1000× plan require a staging environment that does not exist yet.
Producing those numbers from production would mean deliberately saturating the
database while Meta Ads traffic is converting — the exact thing this document
refuses to do.

What is already **measured** on production (from
`docs/AUDIT-2026-08-PRODUCTION-READINESS.md`):
- `max_connections = 60`, ~36 in use at idle (60% floor) — the pool, not CPU, is
  the constraint.
- Therefore the predicted first failure is **Postgres connection exhaustion**,
  surfacing as Edge Function 5xx during checkout rather than slow pages.

Everything else stays `NOT MEASURED` until staging runs. Once staging exists and
step/spike/soak complete, `reports/TEMPLATE.md` §3–§6 becomes the capacity
report with real numbers.
