

# Premium Storefront UX Effects — Implementation Plan

## Overview
Add 7 smooth, premium UX effects across all storefront themes to create a best-in-class shopping experience. All effects use pure CSS or native browser APIs — zero external libraries.

---

## 1. Staggered Grid Reveal
Product cards cascade in one-by-one with a waterfall animation. Pure CSS using `animation-delay` calculated from card index. Applied to all product grids in home pages and shared sections.

## 2. Haptic Button Press
All interactive elements (add-to-cart, wishlist, nav items, category cards) get `active:scale-[0.97]` — a subtle compress-on-tap effect. Zero performance cost, just Tailwind classes.

## 3. Scroll-Triggered Fade-In Sections
Each storefront section (Best Selling, Categories, Popular, All Products) fades up smoothly as the user scrolls to it. Uses native `IntersectionObserver` — no library. New hook: `useScrollReveal.ts`.

## 4. Smooth Page Transitions
Content fades in when navigating between pages (Home → Shop → Product). A `PageTransition` wrapper component uses the existing `fade-in` keyframe, keyed to the current route.

## 5. Smart Sticky Header
Header hides on scroll-down (more content space), reappears on scroll-up. Uses `requestAnimationFrame` for 60fps. New hook: `useSmartHeader.ts`. Applied to mobile and desktop headers.

## 6. Blur-Up Image Loading
Product images show a tiny blurred 20px placeholder that sharpens into the full image (Medium/Pinterest style). Modifies `OptimizedImage.tsx` to use a CSS blur filter on a micro-thumbnail, crossfading on load.

## 7. Add-to-Cart Bounce
Cart icon in header/nav bounces when an item is added. `CartContext` exposes a `cartBounce` state; nav components apply the bounce animation class.

---

## Technical Summary

**New files (3)**:
- `useScrollReveal.ts` — IntersectionObserver hook
- `useSmartHeader.ts` — Scroll direction detection
- `PageTransition.tsx` — Route-change fade wrapper

**Edited files (~20)**:
- `index.css` + `tailwind.config.ts` — New keyframes (stagger, scroll-reveal, cart-bounce)
- All 4 ProductCardStyle components + StorefrontProductCard — Button press effects
- `OptimizedImage.tsx` — Blur-up placeholder
- `HomeSharedSections.tsx` + all home pages — Scroll reveal + staggered grid
- `MobileAppHeader.tsx` + `DesktopNavBar.tsx` — Smart header
- All 3 MobileBottomNav components — Button press + cart bounce
- `CartContext.tsx` — Cart bounce state
- All storefront layouts (V1-V16) — PageTransition wrapper

**Performance**: All animations use GPU-composited CSS transforms/opacity only. ~150 lines of new JS total. Zero external dependencies.

