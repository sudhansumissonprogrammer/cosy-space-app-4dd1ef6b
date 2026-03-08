

## Marquee Announcement Banner for Theme-1 Storefront

### What
Add a continuously scrolling marquee banner above the storefront header nav, matching the reference image: dark background, gold/amber text, Alegreya SC font, with repeating items like "🚚 FREE DELIVERY" and "👜 PREMIUM QUALITY" scrolling left in a seamless loop.

### Implementation

**1. Create `src/components/storefront/StorefrontMarquee.tsx`**
- A dark banner (`bg-[#1a1a2e]` or similar deep navy/black) sitting above the nav
- Contains two identical sets of items in a flex row, animated with CSS `translateX` for infinite seamless scrolling
- Items: `🚚 FREE DELIVERY` and `👜 PREMIUM QUALITY` repeated, separated by dots/diamonds
- Gold/amber text color matching the btn-gold gradient tones
- Font: Alegreya SC (already the default), uppercase, tracking-wide

**2. Update `src/index.css`**
- Add `@keyframes marquee` animation: `0% { transform: translateX(0) } 100% { transform: translateX(-50%) }`
- Add `.animate-marquee` utility class

**3. Update `src/layouts/StorefrontLayout.tsx`**
- Import and render `<StorefrontMarquee />` just above the `<nav>` element, only when `store.theme === 'theme-1'` (or always for now since it's the only theme)

### Files Changed
1. `src/components/storefront/StorefrontMarquee.tsx` — new component
2. `src/index.css` — add marquee keyframes
3. `src/layouts/StorefrontLayout.tsx` — render marquee above nav

