
# Premium Storefront UX Effects — Implementation Plan

## Overview
Add 7 smooth, premium UX effects across all storefront themes to create a best-in-class shopping experience. All effects use pure CSS or native browser APIs — zero external libraries.

---

## 1. Staggered Grid Reveal (CSS-only)
**What**: Product cards cascade in one-by-one with a waterfall animation when the grid loads.

**How**:
- Add CSS keyframe `@keyframes stagger-fade-in` in `src/index.css` (fade-up + scale from 0.96)
- Add `.stagger-grid > *` rule with `animation-delay` using `calc(var(--i) * 60ms)`
- In `UniversalProductCard.tsx`, accept an `index` prop and set `--i` CSS variable via inline style
- Update all product grid sections in `HomeSharedSections.tsx` and home pages to pass `index` and add `stagger-grid` class to grid containers

---

## 2. Haptic Button Press (Tailwind classes)
**What**: All storefront buttons slightly compress on tap (`active:scale-[0.97]`) with a spring bounce-back.

**How**:
- Add `active:scale-[0.97] transition-transform duration-150` to:
  - Add-to-cart buttons in `ProductCardStyle1-4.tsx` and `StorefrontProductCard.tsx`
  - Wishlist heart buttons
  - Bottom nav items in `MobileBottomNav.tsx`, `MobileBottomNavModern.tsx`, `MobileBottomNavV15.tsx`
  - Category cards in `UniversalCategories.tsx`

---

## 3. Scroll-Triggered Fade-In Sections
**What**: Entire sections (Best Selling, Categories, Popular, All Products) fade up smoothly as user scrolls to them.

**How**:
- Create `src/hooks/useScrollReveal.ts` — a lightweight hook using `IntersectionObserver` that adds a `revealed` class when element enters viewport (threshold 0.1, rootMargin "0px 0px -40px 0px")
- Add CSS in `index.css`:
  ```css
  .scroll-reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.6s ease-out, transform 0.6s ease-out; }
  .scroll-reveal.revealed { opacity: 1; transform: translateY(0); }
  ```
- Wrap each home page section in a `<div ref={revealRef} className="scroll-reveal">` using the hook
- Apply in `HomeSharedSections.tsx` section wrappers and individual home pages

---

## 4. Smooth Page Transitions
**What**: Content fades in when navigating between pages (Home → Shop → Product Detail).

**How**:
- Create `src/components/storefront/PageTransition.tsx` — a wrapper that applies `animate-fade-in` (already exists in tailwind config) on mount using a key from `useLocation().pathname`
- Wrap the `<Outlet>` or children in each storefront layout (`StorefrontLayout.tsx`, `V2`, `V3`, `V10-V16`) with `<PageTransition>`
- Uses existing `fade-in` keyframe — just needs the wrapper component

---

## 5. Smart Sticky Header (Hide on scroll down, show on scroll up)
**What**: Header hides when scrolling down to give more content space, smoothly reappears on scroll up.

**How**:
- Create `src/hooks/useSmartHeader.ts` — tracks scroll direction, returns `{ headerVisible, headerRef }`. Uses `requestAnimationFrame` for 60fps performance.
- Apply in `MobileAppHeader.tsx` and `DesktopNavBar.tsx` with `transition-transform duration-300` and `translate-y-[-100%]` when hidden
- Add a scroll threshold (50px minimum scroll before hiding) to avoid jitter

---

## 6. Blur-Up Image Loading
**What**: Product images show a tiny blurred placeholder that sharpens into the full image (Medium/Pinterest style).

**How**:
- Modify `OptimizedImage.tsx` to:
  - Load a tiny 20px-wide version as background via `optimizeImageUrl(src, 20, 30)` with CSS `filter: blur(10px)` and `transform: scale(1.1)` to hide blur edges
  - On `onLoad`, crossfade from blurred to sharp with `transition: opacity 0.4s`
- This uses the existing image CDN resize — no extra infrastructure needed

---

## 7. Add-to-Cart Micro-interaction
**What**: Cart icon in header/nav bounces when an item is added. Provides satisfying visual feedback.

**How**:
- Add `@keyframes cart-bounce` in `index.css` (scale up to 1.3 then back to 1, duration 400ms)
- In `CartContext.tsx`, expose a `cartBounce` state that flips to `true` for 500ms after any `addToCart` call
- In `MobileBottomNav*.tsx` and `DesktopNavBar.tsx`, apply `.animate-cart-bounce` class to the cart icon when `cartBounce` is true

---

## Files to Create
| File | Purpose |
|------|---------|
| `src/hooks/useScrollReveal.ts` | IntersectionObserver hook for scroll fade-in |
| `src/hooks/useSmartHeader.ts` | Scroll direction detection for sticky header |
| `src/components/storefront/PageTransition.tsx` | Route-change fade wrapper |

## Files to Edit
| File | Changes |
|------|---------|
| `src/index.css` | Add keyframes: stagger-fade-in, scroll-reveal, cart-bounce |
| `tailwind.config.ts` | Add stagger-fade-in animation |
| `src/components/storefront/UniversalProductCard.tsx` | Accept index prop, set --i CSS var |
| `src/components/storefront/ProductCardStyle1-4.tsx` | Add active:scale-[0.97] to buttons |
| `src/components/storefront/StorefrontProductCard.tsx` | Add active:scale-[0.97] to buttons |
| `src/components/storefront/OptimizedImage.tsx` | Add blur-up placeholder logic |
| `src/components/storefront/HomeSharedSections.tsx` | Wrap sections with scroll-reveal, pass index to cards |
| `src/components/storefront/MobileAppHeader.tsx` | Apply smart header hide/show |
| `src/components/storefront/DesktopNavBar.tsx` | Apply smart header + cart bounce |
| `src/components/storefront/MobileBottomNav.tsx` | Add active:scale, cart bounce |
| `src/components/storefront/MobileBottomNavModern.tsx` | Add active:scale, cart bounce |
| `src/components/storefront/MobileBottomNavV15.tsx` | Add active:scale, cart bounce |
| `src/components/storefront/UniversalCategories.tsx` | Add scroll-reveal + active:scale |
| `src/contexts/CartContext.tsx` | Add cartBounce state |
| `src/layouts/StorefrontLayout.tsx` + V2-V16 | Wrap content with PageTransition |
| `src/pages/StorefrontHome*.tsx` (all versions) | Add scroll-reveal to sections |

## Performance Notes
- All animations use CSS transforms/opacity only (GPU-composited, no layout thrash)
- IntersectionObserver is native — no library overhead
- Blur-up uses existing CDN resize — no extra network requests (20px image is ~200 bytes)
- Smart header uses rAF throttling — 60fps guaranteed
- Total JS added: ~150 lines across 3 new files
