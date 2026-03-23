

## Plan: Shopify-Level Performance — Remaining Gaps & Fixes

Your architecture is already strong (Worker-injected data, SWR cache, skeleton shell, deferred SW, preconnect). Here's what separates you from Shopify's sub-2s cold load and what we can still improve.

---

### Gap Analysis: You vs Shopify

| Area | Shopify | You (current) | Gap |
|------|---------|---------------|-----|
| HTML delivery | Server-rendered product HTML | Empty shell + JS hydration | **Big** — JS must execute before any real content appears |
| CSS | Only critical CSS in first paint | Full Tailwind bundle render-blocks | **Medium** — 19KB CSS blocks FCP |
| JS payload | ~80KB total for storefront | ~194KB first-party JS | **Medium** — 2.4x heavier |
| Image preload | Server emits exact `<link rel="preload">` with srcset | Worker injects preload but without srcset/sizes | **Small** — partially fixed |
| Font loading | System fonts or self-hosted | Google Fonts external request | **Small** — adds 1 RTT |
| Third-party scripts | Deferred, loaded after interactive | Loaded in main bundle | **Small** |

---

### Changes (ordered by impact)

#### 1. Worker: Server-Side Render Critical HTML (Biggest Impact)

Instead of sending an empty skeleton, inject **real store content** into the HTML at the edge. The Worker already has `storefrontData` — use it to render the marquee text, store name/logo, first 4 product cards (title, price, image) directly into the HTML. React hydrates over this.

This is the single biggest gap vs Shopify. It turns FCP from "skeleton" to "real content".

**File:** `docs/cloudflare-worker-fixed.js`
- In `fetchAndInjectSlug()`, after getting `storefrontData`, generate an HTML string with real marquee text, nav with store name, and first 4 product cards
- Replace the `sf-skeleton` div content with this real HTML
- Add `data-server-rendered` attribute so React knows to hydrate rather than replace

#### 2. Worker: Add srcset to LCP Preload

The current preload uses a bare `href` without srcset. Shopify includes full srcset for responsive preload.

**File:** `docs/cloudflare-worker-fixed.js`
- For Shopify CDN images: generate `imagesrcset` with `width=200`, `width=400`, `width=800` variants
- Add `imagesizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"`

#### 3. Lazy Load Non-Critical Storefront Components

`ExitIntentPopup`, `SmartInstallPrompt`, `DynamicPwaManifest`, `StorefrontInstagramSection`, `FloatingWhatsApp`, and `SideCart` are all eagerly imported in `StorefrontLayout.tsx`. They add to the main bundle but aren't needed for first paint.

**File:** `src/layouts/StorefrontLayout.tsx`
- Convert these 6 imports to `lazy()` with `Suspense fallback={null}`
- This reduces the critical JS path by ~15-20KB

#### 4. Self-Host Inter Font (Eliminate Google Fonts RTT)

Google Fonts adds 2 external requests (CSS + WOFF2) that block text rendering. Shopify self-hosts all fonts.

**Files:** `index.html`, add font files
- Download Inter 400/500/600/700 WOFF2 files to `public/fonts/`
- Replace Google Fonts `<link>` with inline `@font-face` declarations in the critical CSS block
- Removes 1 DNS lookup + 2 HTTP requests from the critical path

#### 5. Add `font-display: optional` for Theme Fonts

Custom theme fonts (Alegreya SC, Changa, Montserrat) currently use `display=swap` which causes layout shift. Change to `optional` — if the font doesn't load in ~100ms, the browser uses the fallback permanently (no FOUT, no CLS).

**File:** `src/layouts/StorefrontLayout.tsx` (dynamic font loading)
- Change `display=swap` to `display=optional` in the Google Fonts URL

#### 6. Reduce Lucide Icon Bundle

21 storefront files import from `lucide-react`. The entire icon library is likely landing in the main bundle despite tree-shaking.

**File:** `vite.config.ts`
- Add `lucide-react` to `manualChunks` as `vendor-icons` to isolate it
- This allows the browser to cache icons separately and reduces main chunk parse time

#### 7. Optimize Worker Cache Strategy for First Visit

The current Worker checks cache, misses, then fetches origin + storefront data. On cache miss for subdomains, it still runs `fetchAndInjectSlug` which is correct — but it could cache the **injected HTML** (with real content) so even the "first" visit from the edge serves pre-rendered content.

**File:** `docs/cloudflare-worker-fixed.js`
- In `cachedFetch()`, when caching HTML for storefront pages, cache the **post-injection** HTML (with `__STOREFRONT_DATA__` and preloads already in it)
- This means even cache-miss requests from the same edge POP benefit subsequent visitors

---

### Expected Results

| Metric | Current | After |
|--------|---------|-------|
| FCP | ~3.2s | ~1.0s (real content in HTML) |
| LCP | ~4.6s | ~1.8s (preloaded image + server-rendered card) |
| Speed Index | ~5.1s | ~2.0s |
| JS on critical path | ~194KB | ~160KB (lazy non-critical components) |
| External requests | 4 (fonts) | 0 (self-hosted) |

### Files to Update

| File | Changes |
|------|---------|
| `docs/cloudflare-worker-fixed.js` | Server-render critical HTML, add srcset to preload, cache injected HTML |
| `src/layouts/StorefrontLayout.tsx` | Lazy load 6 non-critical components, `display=optional` for theme fonts |
| `index.html` | Self-host Inter font with inline `@font-face`, remove Google Fonts links |
| `vite.config.ts` | Add `lucide-react` to `vendor-icons` chunk |

