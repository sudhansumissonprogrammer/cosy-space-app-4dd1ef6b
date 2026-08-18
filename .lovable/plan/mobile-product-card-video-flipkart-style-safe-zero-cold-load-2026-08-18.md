# Mobile Product-Card Video (Flipkart-style) — safe, zero cold-load cost

Goal: on mobile grids (category / shop / search), a product card that has a video plays it silently in-card while it is on screen. Cards without a video behave exactly as today. Desktop is untouched.

## Confirmed current state

- `src/hooks/useInfiniteProducts.ts` (line 11) and the Worker's `PRODUCT_COLUMNS` (`docs/cloudflare-worker-current.js:2670`) both **omit** `video_url` / `video_poster_url`, so listing payloads do not carry video today.
- `UniversalProductCard.tsx` fans out to `ProductCardStyle1..10`, `V19ProductCard`, `V20ProductCard`.
- `HeroVideo.tsx` already proves the safe pattern: `preload="none"`, IntersectionObserver, connection-aware bail-out.
- 8,125 products have `video_url`; posters are almost never set, so the poster will be the existing `image_url`.

## Rules that keep cold load flat

1. Card renders `<video preload="none" poster={existing product image}>` — the browser downloads **zero** video bytes until we explicitly play. HTML/JSON/JS/LCP image are unchanged.
2. The `<img>` stays the LCP element and keeps `fetchpriority`. The video sits above it only after it actually starts playing (fade-in), never before.
3. Adding two columns costs ~100 bytes/product → ~2 KB per 20-product page. Negligible.
4. Video is **skipped entirely** on: desktop, `save-data`, 2G/slow-3G (`src/lib/networkHints.ts`), `prefers-reduced-motion`, and the first viewport until the page is idle (`requestIdleCallback`) so nothing competes with LCP.
5. Global scheduler: **exactly one video plays at a time** across the whole grid. Everything else is paused and reset to `preload="none"`, so bandwidth is capped at a single stream regardless of how many cards have video.
6. No autoplay of card 1 before first paint — the scheduler only arms after the grid's first images have painted.

## What gets built

**New: `src/lib/cardVideoScheduler.ts`**
- Singleton registry of visible video cards. Picks the single most-centered candidate, plays it, pauses all others, and releases the previous element's buffer (`removeAttribute('src')` + `load()`), so memory stays flat while scrolling 15k-product lists.
- Eligibility gate (mobile + network + motion + idle) lives here, one place.

**New: `src/components/storefront/ProductCardVideo.tsx`**
- Tiny presentational layer: absolutely positioned `<video muted playsInline loop preload="none" disablePictureInPicture>` over the card image, registers itself with the scheduler on mount, unregisters on unmount.
- Renders `null` immediately when the product has no `video_url` — no DOM, no observer, no cost for the majority of cards.
- Small muted/sound-off pill only while playing (optional, matches existing reel styling).

**Modified**
- `src/hooks/useInfiniteProducts.ts` — add `video_url,video_poster_url` to `PRODUCT_COLUMNS`.
- `docs/cloudflare-worker-current.js` — same two columns in the Worker's `PRODUCT_COLUMNS` (**requires your manual Worker deploy**; until then production simply has no video in grids and everything keeps working).
- `src/components/storefront/ProductCardStyle1.tsx` — mount `<ProductCardVideo>` inside the existing image wrapper. Style 1 is the default and covers most stores.
- `V19ProductCard.tsx` / `V20ProductCard.tsx` and Styles 2–10 — same one-line mount, done after Style 1 is verified.

**Store toggle**
- Reuse the App Store registry pattern (`src/lib/appStore/registry.ts`) so an owner can turn "Card Video" on/off per store; default off until you flip it, so no store changes behaviour without your say-so.

## Performance expectation

- Cold load (category, mobile): unchanged — same requests, same LCP element, +~2 KB JSON, +~2 KB gzipped JS.
- While scrolling: one video stream at a time; because the source host serves uncached (`DYNAMIC`) responses, expect ~400–900 ms before a clip starts playing. That is post-load smoothness, not page speed.
- Products without video: byte-for-byte identical to today.

## Verification before I call it done

- Playwright run on a mobile viewport against a wristlife category page: confirm no video request fires before the grid images finish, confirm only one `<video>` is ever in `readyState > 0`, and capture screenshots of a card mid-playback.
- Same run with a desktop viewport and with `save-data` emulated: confirm zero video requests.
