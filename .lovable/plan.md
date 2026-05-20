# Landing page slow load — fix plan

## The real problem

The live profile of `https://shopbanao.in/` shows:

- **First Contentful Paint = 7.7s** (should be <1.5s)
- Page load = 2.9s, but the screen looks blank until ~7s because critical chunks load in a long waterfall.
- **17 separate JS chunks** load on first paint, including ones that should be inlined.

Top offenders found in the network trace:

| Resource | Time | Why it hurts |
|---|---|---|
| `Navbar-JHlczaDE.js` | **2000 ms** | Navbar is a *static* import in `Index.tsx` but Rollup still split it into its own chunk → loads after Index, after framework, after entry. Above-the-fold header waits 2s. |
| `400-CY0dnwJo.css` / `600-Bpup8yGQ.css` (Montserrat Alternates) | ~980 ms | Loaded from `main.tsx`. Landing **does not use Montserrat Alternates** — it's a dashboard-only font. ~50 KB of render-blocking CSS for nothing. |
| `alegreya-sc-700.woff2` (89 KB) | 1055 ms | Used by the italic "ShopBanao" wordmark in the hero. Not preloaded → headline stays invisible until the font finishes. |
| `shopbanao-logo-ByBmcqDQ.webp` | 1080 ms | LCP-candidate logo in Navbar. Not preloaded. |
| `showcase-overlays-mobile.webp` / `showcase-serdiya-mobile.webp` | ~950 ms | Hero phone-mockup images, not preloaded. |
| `~api/analytics` XHR | **2163 ms** | Fires from `~flock.js` early in load. Not on the render path, but it inflates "page load". |
| `ProblemAwareness`, `StatsBar`, `PaymentTrustStrip`, `Footer`, `LandingJsonLd` chunks | all in first wave | `LazyMount` `rootMargin: 2000px` is so large that *every* section intersects immediately on mobile → all "lazy" chunks download in the cold-load wave, defeating the optimisation. |

So nothing about the page is actually heavy — the issue is a chunk waterfall + render-blocking CSS/fonts that the browser cannot start until the previous step finishes.

## What to change

### 1. Inline Navbar + Hero into the landing chunk

Force Rollup to keep `Navbar.tsx`, `Hero.tsx`, and `shopbanao-logo.webp` import wrapper inside the `LandingApp` chunk via `manualChunks` (add a `landing-shell` group). Result: zero extra round trip for the above-the-fold header.

### 2. Stop loading dashboard fonts on the landing page

In `src/main.tsx`, the `loadFonts()` block imports `@fontsource/montserrat-alternates/{400,600}.css`. Landing doesn't use it. Split: only load Plus Jakarta on landing, only load Montserrat on dashboard routes. Saves ~50 KB render-blocking CSS + 2 font fetches.

### 3. Preload the actual LCP assets in `index.html`

Add to `<head>` (root-host only, guarded by an inline script so storefronts don't get them):

```html
<link rel="preload" as="image" href="/assets/shopbanao-logo-*.webp" fetchpriority="high">
<link rel="preload" as="font" type="font/woff2" href="/fonts/alegreya-sc-700.woff2" crossorigin>
```

Logo filename is content-hashed — emit the preload from the build via a small Vite post-build step (or hash-stable manifest lookup).

### 4. Fix `LazyMount` so it actually defers

`rootMargin: "2000px 0px"` on a 900 px mobile viewport intersects every below-fold section at first paint. Change to `rootMargin: "600px 0px"` (one viewport ahead) and rely on the existing `requestIdleCallback` safety-net for the "scroll fast, no white" case. The idle mount already kicks in after first paint, so the white-flash fix from last week is preserved while the cold-load waterfall shrinks.

### 5. Defer analytics ping until after FCP

`~flock.js` posts to `/~api/analytics` immediately. Wrap the POST in `requestIdleCallback` (or `setTimeout(..., 2000)` fallback) so it doesn't fight the LCP image for bandwidth.

### 6. Keep the inline skeleton hidden synchronously on root host

Currently the inline `#inline-skel` is rendered then hidden by JS after parse. On the marketing host it should be `style="display:none"` by default and only shown via inline script when a storefront path is detected. Eliminates a layout pass and removes the white flash period.

## Expected result

- FCP: ~7.7 s → **<1.5 s**
- LCP (hero logo + headline): **<2.0 s**
- Cold-load round-trips on critical path: 17 → ~8
- No functional changes — landing visuals, content, and routes stay identical.

## Technical notes

- `vite.config.ts` → extend `manualChunks(id)` with a `landing-shell` bucket for `src/components/landing/Navbar`, `src/components/landing/Hero`, and `src/assets/shopbanao-logo*`.
- `src/main.tsx` → branch font loading on `shouldUseLandingFastPath()` vs dashboard host.
- `src/components/landing/LazyMount.tsx` → reduce `rootMargin` default; keep the idle safety-net (so "scroll fast → white" stays fixed).
- `index.html` → add hash-aware preload tags via a small build-time injector, gated to root host by inline JS.
- No backend, RLS, or schema changes.
