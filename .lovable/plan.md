# Landing Page Cold-Load Speedup + Audit Plan

Three parallel workstreams from the cold-load audit on `shopbanao.in/`. Each can ship independently; they don't depend on each other.

---

## A. Worker fix: cache landing HTML + inject critical modulepreloads

### Problem
Real anonymous fetch to `https://shopbanao.in/` returns:
- `cache-control: no-cache, must-revalidate, max-age=0`
- No `x-worker-version` header → Worker is NOT executing on root domain (only on subdomains/custom domains)
- HTML only references the 1.1KB entry shim. The 142KB `framework-*.js` and 40KB `landing-shell-*.js` are discovered at runtime → 4-level JS waterfall (~870ms critical path)

### Changes

1. **Confirm Worker route binding for `shopbanao.in/*`**
   - In Cloudflare dashboard → Workers Routes, the route must include `shopbanao.in/*` (not just `*.shopbanao.in/*`)
   - Without this, none of the Worker logic runs for the landing page
   - This is a manual user action; we surface it in the plan only

2. **Worker (`docs/cloudflare-worker-current.js`) — landing-specific path**
   - Detect `hostname === ROOT_DOMAIN` AND `pathname === "/" || /^\/guides/ || === "/theme"`
   - On miss: fetch origin HTML, then:
     - Strip `Set-Cookie`, force `Cache-Control: public, max-age=300, s-maxage=3600, stale-while-revalidate=86400`
     - Run a new `_buildLandingHead()` that injects `<link rel="modulepreload">` for the 3 critical chunks (framework, entry-utils, landing-shell) — discovered by fetching the entry chunk once and regex-extracting its `import "./*.js"` statements, cached in KV under `landing-chunks:v1` (24h TTL), invalidated by entry-chunk hash change
     - Inject into `<head>` before existing tags
     - Mirror to `cache.default` via existing `cacheableResponse` / `mirrorToCfCache` so `cf-cache-status: HIT` shows on repeat visits
   - Bump `WORKER_VERSION` to `8.23.0-landing-cache`
   - User deploys manually (per existing workflow)

3. **Verification (post-deploy)**
   - `curl -sI https://shopbanao.in/` should show `cf-cache-status: HIT` and `x-worker-version: 8.23.0-...` on 2nd hit
   - HTML head should contain 3 `<link rel="modulepreload">` lines for framework/entry-utils/landing-shell
   - Expected FCP improvement: 400–600ms on cold load

### Risk
- Low. Landing has no per-user content; 5min browser / 1h edge cache is safe.
- Rollback: revert single Worker file + redeploy.

---

## B. Storefront cold-load audit (for comparison)

Run the same cold-load methodology against a real storefront (`serdiyajewellers.shop`) to confirm the Worker's existing v8.22 deep-modulepreload + skeleton work is delivering the expected wins, and to find any remaining bottlenecks.

### Measurements

1. Anonymous `curl` with TTFB, total time, size, headers (3 runs avg)
2. Inspect `cf-cache-status`, `x-edge-cache`, `x-worker-version`, `x-data-source` headers
3. Count `<link rel="modulepreload">` tags injected by Worker
4. Measure each critical chunk in parallel: framework, storefront-shell, App, supabase-vendor
5. Verify `#sf-skel` skeleton is present and inline data hydration (`__STOREFRONT_DATA__`) is injected
6. Check R2 image latency: hero/logo TTFB from `cdn.shopbanao.in`

### Deliverable
A short report comparing landing vs storefront, with any new fixes identified scored by impact (no code changes in this phase — findings only).

---

## C. Analyze the 142KB framework chunk

The single largest blocker on landing cold load. Goal: identify what's bloating it and whether we can split or trim.

### Steps

1. Read the live chunk via curl + inspect the module graph
2. Look at `vite.config.ts` `manualChunks` to see what's grouped into `framework`
3. Identify likely contents (React + ReactDOM + Router + small util libs)
4. Evaluate split options:
   - **Split React Router out** → ~30KB saved on landing (LandingApp uses minimal routing; could drop to `<a href>`)
   - **Move React Query out** if it's bundled here (it shouldn't be on landing)
   - **Move framer-motion / Radix shared atoms** if leaked
5. Produce a numbers table: current size, proposed split, projected landing bundle reduction

### Deliverable
Findings + a follow-up plan (separate plan) if a meaningful win exists. No code changes during analysis.

---

## Technical details (for engineers)

```text
Current cold-load waterfall (shopbanao.in):
  HTML 180ms (NOT cached)
    └── index-CdOv1bdp.js  1.1KB  (190ms)   ← only this is in HTML
          ├── framework-*.js     142KB (320ms)  ← discovered at runtime
          ├── entry-utils-*.js     5KB (180ms)
          └── landing-shell-*.js  40KB (180ms)
                └── React render → FCP

After A:
  HTML 20ms (cf-cache HIT)
    └── index + framework + entry-utils + landing-shell all in parallel
          → React render → FCP (~700ms total)
```

### Files touched in A
- `docs/cloudflare-worker-current.js` (Worker — manual deploy)
- No app code changes
- No DB / edge function changes

### Order of execution
1. Ship A (concrete code change → manual deploy)
2. Run B (measurements only, generates new findings)
3. Run C (analysis only, may produce a new plan)
