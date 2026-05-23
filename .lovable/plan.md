
# Landing page sub-3s plan — Worker HTML + R2 + font fix

## Why landing feels 8–10s blank (root cause from code + perf trace)

Measured numbers: TTFB 596ms, First Paint 840ms, **FCP 3.66s**, transfer 1.3MB. On slow 4G that 3.6s easily becomes 8–10s. Three culprits combined:

1. **Alegreya SC font is `font-display: block`** (index.html line 70–71). This is the #1 blank-screen reason. `block` literally hides ALL text using this font for up to ~3 seconds until the 172KB font downloads. Because the headline and "ShopBanao" wordmark in nav both use Alegreya SC, the page paints white until the font arrives. Combined with React mount time, this is what users see as "blank for 4–5 seconds after first load."
2. **Landing is 100% client-rendered React.** Worker sends `<div id="root">` empty. Browser must download framework chunk + landing-shell + run React mount → only then DOM exists. No HTML hero markup at edge.
3. **Hero images bundled via Vite** (`@/assets/showcase-overlays-mobile.webp`, `serdiya-mobile.webp`). They get fingerprinted URLs, no edge cache hit on R2/CDN, no Worker preload. ~1.5s to load.

Worker already does the heavy lifting for storefronts (skeleton, font injection, modulepreload, KV cache). Landing currently gets only modulepreload injection — NO skeleton, NO HTML, NO image preload.

## Target after fix

- **First Paint**: 840ms → ~300ms (Worker-injected hero HTML visible immediately)
- **FCP**: 3.66s → ~600ms (no font-display:block blocking text)
- **LCP**: ~2.5s → ~1.2s (hero image preloaded from R2 via Worker)
- **Perceived blank**: 4–5s → 0s (HTML is in the response)
- **Full load on 4G India**: 10s → 3–4s

## What we will build

### 1. Fix font-display:block (biggest single win — instant)
- `index.html`: change Alegreya SC `font-display:block` → `font-display:optional` (matches storefront pattern in memory: "Secondary fonts use font-display:optional to prevent CLS").
- Drop the two `<link rel=preload>` for Alegreya SC on landing (172KB off critical path). Landing uses it only for the wordmark and one inline span — a graceful fallback to system serif for 200ms is fine.
- Keep Inter + Outfit preloads (already `font-display:optional`).

This alone removes the 3-second forced-blank window.

### 2. Worker: pre-render landing HTML skeleton at edge
Add a new branch in `docs/cloudflare-worker-current.js` for `isLandingPath()` (already exists). When the root domain serves landing HTML, inject **static hero markup** into `<div id="root">…</div>` so the page is never blank.

Markup is hard-coded in the Worker (same approach as the storefront skeleton `#sf-skel`):
- Navbar (logo + ShopBanao wordmark + Start Free button) — exact same Tailwind classes
- Hero left column: badge "7-Day Free Trial" + H1 headline + sub paragraph + 2 CTA buttons + trust row
- Hero right column placeholder (blue panel + phone mockup `<img>` from R2 with `fetchpriority=high`)
- Add `data-sf-landing="1"` marker

React (LandingApp/Hero) checks for `window.__SF_LANDING_HYDRATE__` (set by Worker) and the existing DOM matches — React 18 hydration replaces it seamlessly. If markup doesn't match exactly, React just re-renders (no flash because the visible content is identical).

Cache this synthesized HTML at edge with `cacheableResponse()` (existing helper, memory: "Cache rate fix for synthesized responses"). TTL 1 hour, stale-while-revalidate 24h. Purged on deploy.

### 3. R2: migrate landing hero images
Two images need to live on `cdn.shopbanao.in`:
- `showcase-overlays-mobile.webp` (~25KB)
- `showcase-serdiya-mobile.webp` (~25KB)
- `shopbanao-logo.webp` (~5KB)

Upload them via a one-time `r2-upload-landing-assets` edge function (reuses existing R2 SigV4 helper from `r2-upload`). Then update `Hero.tsx` + `Navbar.tsx` to use the CDN URL directly instead of Vite imports.

Worker injects `<link rel=preload as=image fetchpriority=high href=https://cdn.shopbanao.in/landing/overlays-mobile.webp>` in landing HTML head — image starts downloading at byte 0 of HTML, parallel with JS.

### 4. Worker: inline critical CSS for landing
Worker extracts the ~6KB of CSS actually used by hero+navbar (Tailwind utility classes for first viewport) and inlines it in `<style>` inside `<head>`. The external CSS bundle still loads but no longer blocks first paint. Same pattern as `#sf-skel` inline styles already in Worker.

### 5. Drop the 2s `/~api/analytics` blocking call
Already shimmed to sendBeacon in index.html lines 37–65, but the request still takes 2s. Add the same skip path used for landing in Worker: do NOT call `/~api/analytics` for landing pageviews; write to Cloudflare Analytics Engine (already used for AE pageviews per memory). One less XHR on critical path.

### 6. Defer below-fold JS chunks more aggressively
`Index.tsx` already uses `LazyMount` for below-fold. Verify the framework + landing-shell are the only chunks in initial modulepreload (Worker already does this via `LANDING_PRIORITY` regex line 1346). Confirm no leak — current code looks correct; just spot-check after deploy.

## File changes summary

| File | Change |
|------|--------|
| `index.html` | Alegreya SC: block→optional; drop 2 alegreya preload links |
| `docs/cloudflare-worker-current.js` | New `synthesizeLandingHtml()` injects hero+nav DOM, critical CSS, hero image preload; called from landing branch (around line 5061) |
| `src/components/landing/Hero.tsx` | Use `https://cdn.shopbanao.in/landing/...webp` URLs instead of Vite import; mark hero `<img>` with `id="hero-img-lcp"` so Worker can match preload |
| `src/components/landing/Navbar.tsx` | Use CDN URL for logo |
| `supabase/functions/r2-upload-landing-assets/index.ts` | One-time admin-triggered fn that uploads 3 landing assets to R2 (or do it manually via existing r2-upload UI) |

No DB migrations. No new env vars.

## Deployment order (so nothing breaks)

1. Upload 3 landing images to R2 (one-time, via existing admin UI). Verify CDN URLs respond.
2. Ship code changes (Hero/Navbar use CDN, index.html font fix). Lovable auto-deploys frontend.
3. Update `docs/cloudflare-worker-current.js` with new landing synthesis logic. **You manually deploy the Worker** (per project rule — Worker is not Vite-bundled).
4. Purge Cloudflare cache for `shopbanao.in/` and `shopbanao.in/theme` so the new synthesized HTML is generated fresh.
5. Re-measure on PageSpeed Insights mobile (India).

## Risk & rollback

- Hydration mismatch warning if Worker markup drifts from React Hero output — wrapped in `suppressHydrationWarning` on the root section. Visual content matches so no flash.
- If Worker synthesis breaks: a feature flag `__SF_LANDING_SYNTH__` env var in Worker; flip to false to fall back to plain index.html (current behavior).
- Font fallback: if Alegreya SC misses the 100ms window with `font-display:optional`, system serif shows for that session only (next visit it's cached and renders correctly).

## Technical detail (devs only)

- Worker `synthesizeLandingHtml(origHtml, url)` runs only when `isLandingPath(url.pathname) && url.hostname === "shopbanao.in"`. Uses string injection (not HTMLRewriter) because the markup is static — avoids HTMLRewriter cold-start cost.
- Cache key: `landing:v1:${path}`. Purge on `/api/purge` Worker route with prefix `landing:`.
- React 18 hydration: `Hero.tsx` stays a client component; the synthesized HTML matches its initial render (no `Math.random()` on first paint — A/B variant must read from cookie sent server-side OR default to variant 0 for first paint, then swap silently after hydration).
- The `hero_ab` localStorage A/B test currently uses `Math.random()` during render — this WILL cause hydration mismatch. Fix: always render variant 0 on first paint, swap after `useEffect` mount if user is in variant 1. Same content size so no CLS.
