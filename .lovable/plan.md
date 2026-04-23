

## Worker Subrequest Leak — Round 3 Fix Plan (`v7.7.0-race-and-dedup-fix`)

The Claude audit is **accurate against the current `v7.6.0-request-leak-fix` worker**. v7.6.0 closed the cross-isolate dedup gap and the duplicate KV reads, but introduced a **race condition in the warm-lock**, and left **3 redundant `_getInlineProductsOrNull()` calls per request chain**, plus a **double `cache.put`** in `cachedFetch`.

Expected drop: another **40–50% reduction** on top of v7.6.0 — idle stores → ~10 req/hour each.

---

### Fixes (ordered by impact)

**Fix 1 — Make warm-lock atomic (`_warmFullHtmlInBackground`)** *(saves ~20%)*
Current code reads `warm-lock:{slug}` then `ctx.waitUntil(env.STORE_KV.put(...))` — the write is deferred, so 2+ isolates all read `null` and all proceed to warm. Change to:
```js
const existing = await env.STORE_KV.get(lockKey);
if (existing) return;
await env.STORE_KV.put(lockKey, "1", { expirationTtl: 300 }).catch(()=>{}); // SYNC, not waitUntil
```
Lock is set before any subrequest-heavy work begins. KV is eventually-consistent so this isn't perfectly atomic — but the synchronous write closes the window from ~500ms to ~50ms.

**Fix 2 — Pass `inlineProducts` through the chain instead of re-fetching** *(saves ~15%)*
`_getInlineProductsOrNull()` is currently called 3× per request:
1. Subdomain/custom-domain handler (already in the `Promise.all`)
2. `fetchAndInjectSlug()`
3. `_warmFullHtmlInBackground()`

Each call does a `cache.match` (and a KV read on cache miss). Refactor:
- Extend `fetchAndInjectSlug(request, env, ctx, slug, ..., inlineProducts = null)` — skip internal fetch if passed.
- Extend `_warmFullHtmlInBackground(request, shellResult, slug, ctx, env, hostname, pathname, inlineProducts = null)` — same.
- In both subdomain handler (line ~3654) and custom-domain handler (line ~3802), pass the already-resolved `inlineProducts` from the parent `Promise.all` into both downstream functions.

Result: 1 fetch per request instead of 3.

**Fix 3 — Remove orphaned `storeInEdgeCache` call from `cachedFetch`** *(saves ~10%)*
`cachedFetch` writes the streaming response (no inline data) to cache; `_warmFullHtmlInBackground` then overwrites it with the full injected version. The streaming write is wasted work AND occasionally races to overwrite the better version. Remove this block from `cachedFetch`:
```js
if (res.status === 200 && contentType.includes("text/html")) {
  if (slug && res.headers.get("X-Store-Slug") === slug) {
    storeInEdgeCache(ctx, hostname, slug, res);
  }
}
```
`_warmFullHtmlInBackground` is the single source of truth for HTML cache writes.

**Fix 4 — Extend `PREBUILT_HEAD_CACHE_TTL` & `PREBUILT_HEAD_KV_TTL`** *(saves ~5%)*
```
PREBUILT_HEAD_CACHE_TTL: 60   → 300    (1m → 5m)
PREBUILT_HEAD_KV_TTL:    300  → 1800   (5m → 30m)
```
The prebuilt `<head>` (meta + OG tags) only changes on store-settings save → already triggers a `/api/purge`. Safe to extend.

**Fix 5 — Cache GET requests on Supabase proxy** *(audit-flagged, conditional)*
The `/rest/v1/` and `/functions/v1/` proxy currently passes every frontend API call through the Worker uncached. For idempotent `GET` requests on `/rest/v1/`, add a 30s edge cache keyed on full URL + auth-presence. Skip caching for `POST/PATCH/DELETE` and any request with a user JWT in `Authorization`. Saves repeat reads on shared anonymous queries (categories, products, store-info).

If you'd rather not touch this path right now (it's lower impact and slightly risky for auth flows), we can skip Fix 5 and ship 1–4 only. **Default: include Fix 5 with the conservative anon-only caching.**

---

### Files touched
- `docs/cloudflare-worker-current.js` — single file, ~6 surgical edits
- `WORKER_VERSION` → `"7.7.0-race-and-dedup-fix"` and update header comment
- Update `mem://constraints/scaling-capacity` with new per-store idle baseline (~10 req/hr)

### Manual deployment required
After the patch is applied, copy `docs/cloudflare-worker-current.js` → paste into Cloudflare Worker dashboard → **Save & Deploy**. Lovable cannot push to Cloudflare directly.

### Verification (post-deploy, you do)
1. Confirm `X-Worker-Version: 7.7.0-race-and-dedup-fix` response header is live.
2. Wait 1 hour → check Cloudflare subrequests dashboard.
3. Expected: total subrequests drop from current ~25k/day → **~10–15k/day**.
4. Per-store idle req/hour should be <20 (vs ~50 after v7.6.0).

### What I'm NOT doing
- Not touching the cron schedule (`*/30` confirmed correct).
- Not changing the products inline-fetch logic itself — only how many times it's called.
- Not changing `MEM_PV_TTL` again — 5min is already correct.

---

**Approve to switch to default mode and ship `v7.7.0-race-and-dedup-fix`. Reply "skip fix 5" if you want to leave the Supabase proxy untouched.**

