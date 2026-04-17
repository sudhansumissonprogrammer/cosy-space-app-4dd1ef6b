
## Plan: 3 High-ROI Cold-Load Fixes

### Goal
Cut storefront cold LCP from ~4-7s to ~2-3s by eliminating render waterfalls and oversized images.

---

### Fix 1 — Kill Duplicate Skeleton

**Problem:** Both Worker (`#sf-skel`) and `index.html` (`#inline-skel`) render skeletons. In production they briefly overlap; both must be cleaned up; extra DOM/paint work.

**Changes:**
- `index.html`: Wrap inline skeleton in a `<script>` check — only inject if `window.__SF_WORKER__` flag is NOT set (Worker sets this when injecting `#sf-skel`). This makes Worker skeleton the single source of truth in production; inline skeleton remains for preview/localhost only.
- `docs/cloudflare-worker-current.js`: Add `<script>window.__SF_WORKER__=true</script>` before `#sf-skel` injection. Bump version to **6.3.0**.
- `src/main.tsx` / cleanup script: Simplify — only one skeleton ID to remove.

---

### Fix 2 — Unify Fonts (Single Source of Truth in Worker)

**Problem:** Fonts load in 3 places (Worker preload + `index.html` CSS link + React `loadGoogleFonts`). Causes 200–600ms waterfall + FOUT on font swap.

**Changes:**
- `docs/cloudflare-worker-current.js`: Read `theme_config.heading_font` and `body_font` from KV-cached store data. Inject:
  - `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`
  - `<link rel="preload" as="style" href="...">` for the exact merchant fonts
  - `<link rel="stylesheet" href="...">` with `display=swap`
- `index.html`: Remove the hardcoded Poppins/Alegreya preload + stylesheet links (only keep Inter for landing page, gated by route).
- `src/lib/themeUtils.ts` `loadGoogleFonts()`: Add a guard — skip if `document.querySelector('link[data-sf-font]')` exists (Worker already injected). Mark Worker-injected links with `data-sf-font="1"`.
- Result: Storefront pages get fonts from Worker (1 round-trip, parallel with HTML). Landing page keeps its own Inter setup. React only injects fonts as fallback for preview/localhost.

---

### Fix 3 — Cloudflare Image Resizing

**Problem:** Supabase Render API adds 100–300ms latency + counted transformations. External/legacy images served at full size (up to 2MB) → LCP 4-7s.

**Changes:**
- `docs/cloudflare-worker-current.js`: Add new route `/cf-img` that uses `fetch(originalUrl, { cf: { image: { width, quality, format: 'auto', fit: 'scale-down' } } })`. Cache responses in Cache API with 1-year TTL. Accept query params: `url`, `w`, `q`.
- `src/lib/imageOptimize.ts`: 
  - Add `USE_CF_IMAGE_RESIZE` flag (default true in production).
  - Replace Supabase Render API path with `/cf-img?url=...&w=...&q=...` for both pipeline images and external Supabase URLs.
  - Update `getImageSrcSet` and `preloadHeroImage` to use the new path.
- Worker version → **6.3.0**.

**Manual step (user):** Enable Image Resizing in Cloudflare Dashboard → Speed → Optimization → toggle on. Already covered by Workers Paid plan.

---

### Files Touched
1. `docs/cloudflare-worker-current.js` — skeleton flag, font injection, `/cf-img` route, version bump
2. `index.html` — remove storefront font links + inline skeleton guard
3. `src/main.tsx` — skeleton cleanup simplification
4. `src/lib/themeUtils.ts` — `loadGoogleFonts` guard
5. `src/lib/imageOptimize.ts` — route through `/cf-img`

### Expected Impact
| Metric | Before | After |
|---|---|---|
| LCP (cold, mobile 4G) | 4–7s | 2–3s |
| Image bytes | 200KB–2MB | 30–80KB |
| Font waterfall | 3 stages | 1 stage (Worker) |
| Skeleton paint work | 2x | 1x |

### Deployment Steps
1. I write all code changes (single response in default mode).
2. You copy `docs/cloudflare-worker-current.js` → Cloudflare Worker editor → Deploy.
3. You enable Cloudflare Image Resizing toggle.
4. Test cold load on mobile (incognito) on a real store.

### Risk / Rollback
- Image resize: if CF toggle isn't enabled, `/cf-img` still works (passthrough fetch); just no resizing.
- Font unify: React `loadGoogleFonts` remains as fallback for preview.
- Skeleton: inline skeleton remains intact for localhost/preview.

Ready to ship — approve to proceed.
