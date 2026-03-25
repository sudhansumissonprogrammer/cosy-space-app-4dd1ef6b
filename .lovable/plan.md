
## Root-Cause Analysis (based on current architecture + symptoms)

The behavior pattern (normal mode wrong, incognito correct, different devices seeing different results) points to a **multi-layer cache inconsistency**, not a single routing bug.

Most likely failure chain:

1. **Edge serves mixed HTML generations over time**
   - HTML is cached at edge (`caches.default`) with stale-while-revalidate.
   - If any earlier response was stored without correct tenant bootstrap (or with older bundle references), users can receive that cached response before revalidation.

2. **Client Service Worker adds a second HTML/runtime cache layer**
   - SW runtime navigation cache (`NetworkFirst`) can still return stale HTML during timeout/failure windows.
   - SW precache/runtime can retain old JS chunk graph, producing **HTML↔JS version skew** (observed createContext-type runtime failures are consistent with this).

3. **Tenant context depends on injected runtime state**
   - Storefront needs `__STORE_SLUG__` / prefetched data.
   - If response path bypasses/loses injection or old app bundle ignores newer fallback logic, app falls back to auth/login routes.

4. **Deployment drift risk**
   - Multiple worker files exist in repo (`current/fixed/final/production/unified` variants).
   - If wrong worker code is deployed, behavior becomes non-deterministic across PoPs/sessions.

---

## Production-Grade Fix Plan

### Phase 1 — Make tenant resolution deterministic before cache (Edge hardening)
**Target:** `docs/cloudflare-worker-current.js` + Cloudflare config

1. **Enforce strict request pipeline**
   - Resolve tenant first for custom domains.
   - If no slug, return explicit 404 tenant page (never proxy generic app shell).
2. **Cache only “tenant-complete” HTML**
   - Before `cache.put`, assert response is HTML **and** includes tenant marker (`__STORE_SLUG__` or `X-Store-Slug`).
   - Do not cache bare/index-like HTML for tenant routes.
3. **Strengthen cache key isolation**
   - Key dimensions: normalized host + slug + pathname + normalized query + build version.
   - Include host normalization (`www` canonicalization) consistently.
4. **Reduce stale window for HTML**
   - HTML: `max-age=60–120`, `stale-while-revalidate=300–600` (short).
   - Keep assets immutable; keep API cache separate.
5. **Add edge diagnostics headers**
   - `X-Worker-Version`, `X-Store-Slug`, `X-Cache-Status` (HIT/MISS/BYPASS), `X-Origin-Host`.

---

### Phase 2 — Eliminate Service Worker interference for multi-tenant storefronts
**Target:** `vite.config.ts`, `src/main.tsx`

1. **Disable SW registration on custom domains/subdomains**
   - Keep SW only for primary app/dashboard domain, not tenant storefront hosts.
2. **One-time aggressive cleanup on storefront hosts**
   - Unregister legacy SW + clear all named caches + one guarded reload.
3. **Remove navigation runtime caching for storefront scope**
   - If keeping SW, never cache `request.mode === "navigate"` on tenant hosts.
4. **Version cache namespaces**
   - Use explicit cache version tokens to guarantee old runtime cache eviction after release.

---

### Phase 3 — Make frontend fail-safe when edge context is missing
**Target:** `src/App.tsx`, `src/lib/subdomain.ts`, `index.html`

1. **Never route custom domains to auth shell**
   - If custom host + no slug yet: show loading/tenant resolution screen.
   - If unresolved after lookup: show store-not-found (not login).
2. **Keep DB fallback resolution as safety net**
   - Query both domain forms (`domain`, `www.domain`) and both public/private sources.
3. **Bootstrap invariants**
   - On storefront host, assert one of:
     - injected slug present, or
     - slug resolved by fallback before auth routes are considered.
4. **Guard prefetch**
   - Prefetch should only run when slug is known; never write partial global state.

---

### Phase 4 — Deployment and cache invalidation protocol (critical)
**Operational runbook (must be followed every release):**

1. Publish latest frontend build first.
2. Deploy **only canonical worker source** (`cloudflare-worker-current.js`).
3. Purge edge HTML cache (preferably by host/path tags; if urgent, purge all).
4. Verify headers on custom domain:
   - `X-Worker-Version` present
   - `X-Store-Slug` correct
   - expected `X-Cache-Status`
5. Validate normal + incognito + second device before closing release.

Also: deprecate/remove duplicate worker docs or mark them archived to prevent wrong deployment.

---

## Verification Matrix (must pass)

```text
Domains: [custom apex, custom www, platform subdomain]
Modes:   [normal, incognito]
Devices: [mobile, desktop]
Regions: [at least 2 geographies]

Checks:
1) / loads storefront (never login)
2) hard refresh still storefront
3) after deploy, new version visible < 2 min
4) headers show correct slug + worker version
5) no JS runtime mismatch errors
```

---

## Success Criteria

- 100% deterministic tenant rendering on custom domains/subdomains.
- No login-page leakage on tenant hosts.
- No cross-tenant HTML reuse.
- Version updates visible predictably after release window.
- Normal and incognito behavior converges (no cache-mode divergence).

---

## Implementation Order (safe rollout)

1. Edge hardening + diagnostic headers.
2. SW scope restriction/disable for tenant hosts.
3. Frontend route guard tightening.
4. Canonical worker source governance + release runbook.
5. Synthetic monitoring + alerting on tenant-mismatch incidents.
