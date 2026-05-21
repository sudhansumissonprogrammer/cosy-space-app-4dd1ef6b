# Product page — infinite loop swipe on image gallery

Make the PDP image gallery swipeable in an endless loop, even when the product has only 1 or 2 images. Swipe never hits a "wall"; it always advances and the same image(s) re-appear in order.

## Behaviour

- **1 image**: swiping left or right still triggers a slide animation and re-shows the same image. Dots, counter, and desktop arrows stay hidden (nothing to count).
- **2 images**: swipe loops A → B → A → B … in both directions. Dots/counter show `1/2`, `2/2`, `1/2`, …
- **3+ images**: same loop behaviour as today's `(i + 1) % len` arrows, now extended to touch swipe (currently swipe stops at first/last).
- Desktop arrows, dot indicators, and thumbnail strip behaviour are unchanged for multi-image products.
- Lightbox is untouched.

## Technical (single file)

File: `src/pages/ProductDetail.tsx` → `ImageGallery` component (around lines 1370–1539).

1. Replace `activeIndex` state with a virtual counter `slideIndex` (unbounded integer, can go negative).
2. Derive `activeIndex = ((slideIndex % len) + len) % len` for rendering, dots, counter, thumbnails.
3. `handleTouchEnd`: drop the `activeIndex < images.length - 1` / `> 0` guards — always `setSlideIndex(s => s ± 1)` on a >50px horizontal swipe (only when `images.length >= 1`; no-op only if 0 images).
4. Desktop prev/next buttons: `setSlideIndex(s => s - 1)` / `s + 1` (still only rendered when `length > 1`).
5. Dots and thumbnail clicks: `setSlideIndex(i)` directly (already in 0..len-1 range).
6. `<img key=…>`: use `${slideIndex}-${images[activeIndex]}` so the slide animation re-triggers on every swipe — including the single-image loop, giving visible feedback.
7. Preload effect, skeleton, share/zoom/discount badge, lightbox: unchanged.

No other files, no API changes, no styling overhaul.
