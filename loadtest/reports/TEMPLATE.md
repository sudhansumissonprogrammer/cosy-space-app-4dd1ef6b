# Load Test Report — ShopBanao

Copy this file to `loadtest/reports/<date>-<scenario>.md` and fill it in from
real measurements. Leave a field as `NOT MEASURED` rather than estimating.

## 0. Run metadata

| Field | Value |
|---|---|
| Date (UTC) | |
| Environment | staging / production-canary |
| Base URL | |
| Commit SHA | |
| Scenario | smoke / ramp / step / spike / soak |
| Script(s) | |
| DB size, row counts | (from `capacity-snapshot.sql`) |
| Staging parity vs prod | same compute tier? same region? same worker? |

## 1. Safety attestation

- [ ] Target is not a production host
- [ ] `verify-sanitized.sql` returned zero blockers
- [ ] Payment providers in sandbox mode
- [ ] WhatsApp / email / push disabled
- [ ] Meta Pixel + CAPI credentials removed

## 2. Results by step

| VUs | req/s | p50 ms | p95 ms | p99 ms | err % | edge hit % | PG conns (peak) | PG active | notes |
|---|---|---|---|---|---|---|---|---|---|
| 25 | | | | | | | | | |
| 100 | | | | | | | | | |
| 250 | | | | | | | | | |
| 500 | | | | | | | | | |
| 1000 | | | | | | | | | |

## 3. Breaking point

- **Measured breaking point:** ___ concurrent users / ___ req/s
- **Definition used:** first step where `http_req_failed > 1%` OR `p95 > 3× baseline`
- **First subsystem to fail:** ___
- **Failure signature:** (error text, status codes, log lines)
- **Time to fail after step start:** ___
- **Recovery time after load removed:** ___ (self-healing? manual restart?)

## 4. Bottleneck analysis

| Layer | Utilisation at breaking point | Headroom | Evidence |
|---|---|---|---|
| Cloudflare Worker CPU/req | | | wrangler tail / CF analytics |
| Cloudflare cache hit ratio | | | `sb_edge_cache_hit` |
| Edge Function concurrency | | | function logs, 546/429 counts |
| Postgres connections | | | `sample-db.sh` |
| Postgres CPU / cache ratio | | | monitoring.sql §5, §11 |
| Slowest queries | | | monitoring.sql §4 |
| Lock waits / deadlocks | | | monitoring.sql §6 |
| Storage / image delivery | | | CF analytics, R2 metrics |
| Realtime connections | | | Supabase realtime metrics |

Root cause chain (write it as a chain, not a list):

```text
load → ??? → ??? → user-visible failure
```

## 5. Capacity report

| Metric | Measured |
|---|---|
| Sustainable concurrent users (p95 < 1.5s, err < 0.5%) | |
| Sustainable req/s at edge | |
| Sustainable origin req/s (cache miss) | |
| Sustainable orders/min through write path | |
| Peak observed org traffic (prod, for comparison) | |
| Headroom multiplier vs current peak | |

## 6. Scaling recommendations

### To 10×
1.
2.

### To 100×
1.
2.

### To 1000×
1.
2.

## 7. Actions taken / follow-ups

| # | Action | Owner | Status |
|---|---|---|---|
| 1 | | | |
