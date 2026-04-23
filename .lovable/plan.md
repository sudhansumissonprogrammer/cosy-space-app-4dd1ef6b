

## Worker Subrequest Leak — Round 2 Fix Plan

The Claude audit is **accurate against the current `7.5.0-cron-leak-fix` worker**. v7.5.0 only fixed the cron fan-out. The remaining leaks are all in the **per-request hot path** — every visitor (and every bot) triggers 3–5 redundant background tasks because in-memory dedup locks (`_warmLocks`, `revalCooldowns`, `_memProductVersion`) reset for every new Cloudflare isolate.

Cron at `*/30` is already correct → no change there. All fixes are in the request handlers + TTLs.

---

### Target version: `v7.6.0-request-leak-fix`

Expected drop: **80k/day → ~15–25k/day** (60–80% reduction).

---

### Fixes (ordered by impact)

**Fix A — Remove duplicate `_warmFullHtmlInBackground` calls** *(saves ~30% of subrequests)*
The function is invoked from the cold-data path AND the cold-shell-only path AND the warm path on **every request**, on both subdomain and custom domain handlers (lines 3552, 3570, 3654, 3702, 3719, 3802). Keep ONLY the call at the end of the warm/full path (lines 3654 + 3802). Remove the 4 redundant calls in the cold branches — those branches already serve fully injected HTML, so warming again immediately is pure waste.

**Fix B — Cross-isolate KV lock for `_warmFullHtmlInBackground`** *(saves ~25%)*
The current `_warmLocks` Map is per-isolate. Replace the 60s in-memory lock with a KV-based lock:
```
warm-lock:{slug} → '1', expirationTtl: 300 (5 min)
```
Check via `env.STORE_KV.get(key)` — if present, return immediately. This is the single biggest fix because Cloudflare runs many parallel isolates even at low traffic.

**Fix C — Extend `REVAL_COOLDOWN_MS` 120s → 600s** *(saves ~15%)*
Line 193. Background SWR revalidations fire every 2 min per isolate — change to 10 min. Shell + storefront data don't change that often.

**Fix D — Eliminate duplicate KV reads in subdomain + custom-domain handlers** *(saves ~10%)*
Lines 3580 + 3586 (subdomain) and 3743 + 3749 (custom domain) both read `storefront:{slug}` and `store-info:{slug}` from KV in parallel via `prefetchStorefrontDataWithDeadline` AND `_batchKvRead` AND `_resolveStoreInfo`.
- Remove `storefront` from `_batchKvRead` (line 824) — use the result from `earlyStorefrontPromise` instead.
- Remove `storeInfo` from `_batchKvRead` (line 825) — use the result from `_resolveStoreInfo` (already in the same Promise.all).
- `_batchKvRead` becomes `_getThemeLiteFromKv` (one KV read) — or inline it.

**Fix E — Extend Shell TTLs** *(saves ~10%)*
Lines 157, 701, 702:
```
MEM_SHELL_TTL: 60_000   → 300_000   (1m → 5m)
SPA_SHELL_KV_TTL: 300   → 1800      (5m → 30m)
SPA_SHELL_CACHE_TTL: 60 → 300       (1m → 5m)
```
Shell only changes on deploy. Manual purge already busts it.

**Fix F — Extend `MEM_PV_TTL` for product version** *(saves ~5%)*
Line 2041: `60_000 → 300_000`. Version-bump on dashboard save already calls `/api/purge`, so 5 min staleness is safe and eliminates the "every fresh isolate does a KV read for the version" leak called out in the audit.

**Fix G — Cache `active-slugs-7d` in KV in cron** *(saves Supabase DB load, not Worker subrequests)*
Lines 3938–3955. The `page_views` query runs every 30 min. Cache the result for 6 hours:
```
active-slugs-7d → JSON, expirationTtl: 21600
```
On cache hit skip the Supabase query. Refresh once every 6h instead of 48 times/day.

---

### Files touched
- `docs/cloudflare-worker-current.js` (single file, ~10 surgical edits)
- Update `WORKER_VERSION` → `"7.6.0-request-leak-fix"` and version comment header
- Update `mem://infrastructure/cf-img-and-font-pipeline` and `mem://constraints/scaling-capacity` with new numbers

### Manual deployment required
After I apply the patch, you must **copy `docs/cloudflare-worker-current.js` and paste it into Cloudflare Worker → Save & Deploy**. (Same as v7.5.0 — Lovable can't push to Cloudflare directly.)

### Verification (you do, post-deploy)
1. Wait 1 hour → check Cloudflare dashboard subrequests.
2. Look for response header `X-Worker-Version: 7.6.0-request-leak-fix` to confirm new code is live.
3. Expected: idle stores generate <50 req/hour each (vs current ~500–1000/hour).

### What I'm NOT doing
- Not touching `wrangler.toml` cron — already `*/30`, you confirmed.
- Not removing the cron HTML warming — it's already gated correctly in v7.5.0 (`cache.match` skip).
- Not changing the products API code path — that's working efficiently.

---

**Approve and I'll switch to default mode and ship `v7.6.0-request-leak-fix` in one edit.**

