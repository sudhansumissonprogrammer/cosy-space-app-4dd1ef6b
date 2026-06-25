# Premium PDP — Sticky Media Gallery

Goal: when the user scrolls the product page, the image/video gallery stays visible at the top while the product details (title, price, description, reviews) scroll up over/under it. This is the pattern used by Apple, Aritzia, Glossier, Allbirds — it makes the page feel premium and keeps the hero media in view while users read.

## What the user will feel

Mobile (390px):
- Gallery starts full-bleed at the top (~100vw tall, the image's natural aspect).
- As you scroll, the gallery **shrinks smoothly** from full-bleed → a compact pinned strip (~38vh) at the top.
- It stays **pinned** there while you read title, price, variants, description, reviews.
- A subtle backdrop-blur appears behind it once pinned, so text scrolling underneath stays readable.
- Dots/thumbnails fade to a minimal pill counter (1/4) in pinned state.
- Tap the pinned gallery → it expands back to full-bleed (smooth spring).

Desktop (≥1024px):
- Classic two-column: gallery on the left is **`position: sticky; top: 80px`**, details column on the right scrolls past it. No shrink needed — just sticky.

## How it works (mobile, the interesting part)

```text
scroll = 0px         scroll = 200px        scroll = 400px+
┌──────────────┐    ┌──────────────┐      ┌──────────────┐
│              │    │              │      │  ▓ pinned ▓  │  ← 38vh, blur bg
│              │    │   gallery    │      ├──────────────┤
│   gallery    │    │   shrinking  │      │              │
│   100vw      │    │              │      │  Title       │
│              │    ├──────────────┤      │  ₹1,299      │
│              │    │  Title       │      │              │
├──────────────┤    │  ₹1,299      │      │  Description │
│ Title  ₹1299 │    │              │      │  ...         │
```

Driven by a single `scrollY` value (via `useScroll` from framer-motion, already in the project) mapped through `useTransform`:
- `height`: `100vw → 38vh` over the first 250px of scroll
- `borderRadius`: `0 → 20px`
- `marginX`: `0 → 12px` (gives the pinned card breathing room)
- `boxShadow`: `none → 0 10px 40px -10px rgba(0,0,0,.15)`
- `backdrop` opacity: `0 → 1`

Spring easing keeps it interruptible — flick scroll and it tracks the finger.

## Where this lives in the code

Themes affected (only `ProductDetail.tsx` and `V22ProductDetail.tsx` for now — they cover 18 of 20 themes):

1. **New component** `src/components/storefront/StickyMediaGallery.tsx`
   - Wraps the existing Embla carousel + `VideoSlide`.
   - Owns the scroll-linked motion values.
   - Mobile only (uses a `useMediaQuery` hook for `< 1024px`).
   - Desktop falls through to a `sticky top-20` wrapper.

2. **`src/pages/ProductDetail.tsx`** — replace the current `<div className="relative">…carousel…</div>` block with `<StickyMediaGallery slides={slides} />`. Details section gets `pt-4` (no longer needs to clear a fixed height).

3. **`src/pages/V22ProductDetail.tsx`** — same swap. V22 already uses its custom `ImageGallery`; we'll move that into the same sticky wrapper so V22 inherits the behavior.

4. **No changes** to V19/V20 (they're legacy native scroll-snap; can be done in a follow-up if you like the result).

## Premium details (from the make-interfaces-feel-better skill)

- **Interruptible motion** — `useScroll` + `useTransform` (no keyframes) so it tracks the user's finger.
- **Concentric radius** — pinned card `rounded-2xl` (20px), inner image `rounded-xl` (16px) with 4px padding.
- **Image outline** — `outline: 1px solid rgba(0,0,0,0.08)` on the pinned card so it sits on top of scrolling text without looking flat.
- **Tabular nums** on the `1/4` counter so it doesn't jitter.
- **No CLS** — gallery container reserves `aspect-square` from the first paint; the shrink is `transform`-based, not layout.
- **Reduced motion** — if `prefers-reduced-motion`, skip the shrink animation and use plain `position: sticky` instead.

## Technical notes (for the dev side)

- `framer-motion` is already installed (used in cart drawer + V22 gallery), no new deps.
- `useScroll({ target: ref, offset: ['start start', 'end start'] })` scoped to the gallery container — doesn't fight Embla's own pan gestures (vertical-only listener).
- The shrink range (0 → 250px) and pinned height (38vh) are tuned for 390px viewport; will validate on 360/414 too.
- Embla's `AutoHeight` plugin stays — it handles within-slide variation (image vs video). The new shrink wraps the whole viewport.
- Z-index: pinned gallery sits at `z-30`; sticky header is `z-40` so it still wins.

## Out of scope (ask if you want any of these next)

- Pinch-to-zoom on image (separate UX, needs a lightbox).
- Auto-play video when pinned (battery + data; usually a bad call on mobile PDPs).
- Sticky "Add to cart" bar (you already have one; will verify it doesn't collide).

---

If this matches what you're picturing, say "go" and I'll build it. If you want me to first show you 2–3 rendered variants (Apple-style vs Aritzia-style vs Glossier-style) so you can pick the exact look, say "show variants".
