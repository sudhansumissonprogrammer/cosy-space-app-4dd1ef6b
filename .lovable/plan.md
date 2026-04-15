

# Worker v6.3.0 — Security, Performance & Bug Fixes

Version bump: 6.2.1 → **6.3.0**. All changes in `docs/cloudflare-worker-current.js` plus two client-side files.

---

## Phase 1: Critical Security

**Issue #1 — Move secrets to env bindings**
Replace hardcoded `SUPABASE_URL` and `SUPABASE_ANON_KEY` with `env.SUPABASE_URL || <fallback>` and `env.SUPABASE_ANON_KEY || <fallback>`. All ~15 call sites updated. After deploying, add these as Workers Secrets in Cloudflare dashboard.

**Issue #2 — Auth on purge/prewarm endpoints**
Add `verifyPurgeAuth(request, env)` using `crypto.subtle.timingSafeEqual` against `env.PURGE_SECRET`. Gate all 4 mutation endpoints (`purge-store`, `purge-shell`, `purge-products`, `prewarm`) behind this check. Update `src/lib/purgeStoreCache.ts` to send `X-Purge-Token` header. Prewarm goes through the edge function so no client change needed there.

**Issue #3 — Fix infinite skeleton reload loop**
Replace polling with `sessionStorage`-guarded approach. Max 1 reload. If still skeleton after reload, stop and let SPA hydrate naturally.

**Issue #17 — XSS in JSON injection**
Create `sanitizeJsonForScript()` that escapes `</script`, `<!--`, and `<script` inside JSON strings. Use in `injectIntoHtml` (line 1349) and `serveStreamedHtml` (line 1512).

**Issue #20 — Remove x-forwarded-for fallback**
Lines 2770 and 2993: use only `cf-connecting-ip`.

**Issue #21 — Slug validation on prewarm**
Add `if (!/^[a-z0-9-]{1,63}$/.test(slug)) return 400` in `handlePrewarm`.

---

## Phase 2: Performance

**Issue #6 — In-memory "is warming" flag**
Add `_warmingInFlight` Set. Skip `cache.match(earlyKey)` in `_warmFullHtmlInBackground` if slug already warming.

**Issue #7 — Skip KV reads when memory is hot**
Check `_memThemeCache` and `_memStorefrontCache` freshness before `_batchKvRead`. Pass resolved null if both hot.

**Issue #10 — Gate inline products on pathname**
Only call `_getInlineProductsOrNull` when `pathname === '/'` or `pathname === ''`.

**Issue #12 — Bot detection before I/O**
Move `BOT_UA_REGEX` check to right after static asset handling, before early edge cache. Bots skip all cache warming and go directly to `handleBot`.

**Issue #14 — Handle HEAD requests explicitly**
Add HEAD handler near top of fetch. Return lightweight response with `X-Data-Source` from edge cache only — no streaming HTML generation.

**Issue #15 — Remove redundant storeInEdgeCache on streaming**
Remove `storeInEdgeCache(ctx, hostname, slug, res)` in `cachedFetch` (line 2597). Background warm already handles this.

---

## Phase 3: Cost & Cleanup

**Issue #5 — Add console.error in critical catches**
Replace silent `.catch(() => {})` with `.catch(e => console.error('[cache]', e))` in shell/storefront/early HTML cache writes.

**Issue #13 — Move cleanup to ctx.waitUntil**
Move `cleanRateLimitMap()` and `cleanRevalMap()` into `ctx.waitUntil` to unblock critical path.

**Issue #16 — Remove dead slug index code**
Remove `_getSlugIndex`, `_slugIndexSet`, `_slugIndexExpiresAt`, and the fire-and-forget call. Keep KV write in cron.

**Issue #19 — Tighten CORS on mutation endpoints**
Restrict purge/prewarm CORS to `*.shopbanao.in` origins. Keep `*` for `/api/products`.

---

## Phase 4: Improvements

**Issue #8 — Increase domain resolution TTLs**
KV: 3600 → 86400. Cache API: 300 → 3600. Memory: 300_000 → 1_800_000.

**Issue #11 — Cron timeout**
Add 25-second deadline to store-warm loop. Break on timeout.

**Issue #9 — No change needed** (streaming await is correct, head already flushed).

**Issue #18 — CSP nonce deferred** to a future version (requires larger refactor).

---

## Client-Side Changes

- `src/lib/purgeStoreCache.ts`: Add `X-Purge-Token` header to purge fetch calls
- `src/lib/prewarmStore.ts`: No change (calls go through edge function)

---

## Post-Deploy Requirements

Add these as **Workers Secrets** in Cloudflare dashboard:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`  
- `PURGE_SECRET` (generate a random 32+ char string, also set as `VITE_PURGE_SECRET` in Lovable env)

