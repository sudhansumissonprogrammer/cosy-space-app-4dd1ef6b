
# Emil Kowalski Design Engineering Pass — Tiers A through D

Apply systemic motion/feel improvements to shared UI primitives so the polish ripples across every page (landing, storefront themes V1–V20, dashboard, admin).

---

## Tier A — Foundation (3 surgical edits)

**1. `src/components/ui/button.tsx`**
- Add `active:scale-[0.97] transition-transform duration-150 ease-out` to the base `buttonVariants` class string.
- Preserve existing `transition-colors` for color states by switching to `transition-[transform,colors,box-shadow] duration-150 ease-out`.
- No variant API change. Every `<Button>` in the app gains tactile press feedback.

**2. Origin-aware popovers (4 files)**
Add `transform-origin: var(--radix-*-content-transform-origin)` to:
- `src/components/ui/popover.tsx` → `--radix-popover-content-transform-origin`
- `src/components/ui/dropdown-menu.tsx` → `--radix-dropdown-menu-content-transform-origin`
- `src/components/ui/select.tsx` → `--radix-select-content-transform-origin`
- `src/components/ui/tooltip.tsx` → `--radix-tooltip-content-transform-origin`

Apply via inline `style={{ transformOrigin: "var(--radix-…)" }}` on the Content primitive. Menus/tooltips will scale from their trigger, not from center.

**3. `src/components/ui/sheet.tsx`**
- Replace the wrapper's `transition ease-in-out` / `ease-out` with iOS drawer curve: `transition-[transform] duration-300` + inline `style={{ transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)" }}`.
- Apply to both open and close states so SideCart + HamburgerMenu feel native.

---

## Tier B — Kill the `transition-all` anti-pattern

Replace `transition-all` with specific property transitions on the top hot-path components (audit confirmed ~252 hits; we hit the top 20 that render on every storefront paint).

Target files (priority order):
1. `src/components/ui/button.tsx` (already handled in Tier A)
2. `src/components/storefront/SideCart.tsx`
3. `src/components/storefront/HamburgerMenu.tsx`
4. `src/components/storefront/ProductCard*.tsx` (all theme variants used)
5. `src/components/storefront/MobileBottomNav*.tsx`
6. `src/components/storefront/StickyAddToCart*.tsx`
7. `src/components/storefront/BackToTop.tsx`
8. `src/components/ui/sidebar.tsx`
9. `src/components/ui/tabs.tsx`
10. `src/components/ui/accordion.tsx`
11. `src/components/ui/input-otp.tsx`
12. `src/components/ui/navigation-menu.tsx`
13. `src/components/ui/toggle.tsx`
14. `src/components/ui/badge.tsx`
15. `src/components/ui/card.tsx` (if used on hover)
16. Landing CTAs in `src/landing/**`
17. Dashboard nav/sidebar shells
18. Admin top-bar
19. Theme V2/V3 header
20. Theme V10–V20 shared header strips

Replacement rule: `transition-all` → `transition-[transform,opacity,colors,box-shadow]` (drop properties not used by the component). No layout-affecting properties (width/height/padding) ever go into the transition list.

---

## Tier C — Polish details

**1. Tooltip skip-delay (`src/components/ui/tooltip.tsx`)**
- Wrap the app's `<TooltipProvider>` with `delayDuration={300} skipDelayDuration={100}` so hovering adjacent tooltips opens instantly.
- Add `data-[state=delayed-open]` vs `data-[state=instant-open]` handling — Radix already exposes via `skipDelayDuration`; just thread the prop.

**2. Tighten card hover speeds**
- Audit `ProductCard*.tsx` and any theme card with `duration-500` on hover transforms → drop to `duration-300` with `ease-out`.
- Affected: V1 default card, V2/V3 grid cards, V10–V20 shared card.

**3. Back-to-top exit easing (`src/index.css` or component)**
- Find the `back-to-top-exit` keyframe / class using `ease-in` and switch to `ease-out` with 160ms.

**4. Gate `hover:scale` behind `(hover: hover)`**
- `src/components/ui/sheet.tsx` close button (`hover:scale-110`)
- Storefront nav icon row (cart, wishlist, account, search)
- Wrap with Tailwind's `hover-hover:` variant if available, else add a media-gated utility class in `src/index.css`:
  ```css
  @media (hover: hover) and (pointer: fine) {
    .hh\:hover-scale-110:hover { transform: scale(1.10); }
  }
  ```
- Replace offending `hover:scale-110` with `hh:hover-scale-110` on touch-prone targets.

---

## Tier D — Cleanup

**1. Remove legacy toast system**
- Verify no live import of `src/components/ui/toast.tsx` / `toaster.tsx` / `use-toast.ts` outside of the Sonner stack.
- Delete `src/components/ui/toast.tsx`, `src/components/ui/toaster.tsx`, `src/hooks/use-toast.ts` once import audit is clean.
- Keep `src/components/ui/sonner.tsx` as the sole toast surface.

**2. Audit infinite decorative animations (battery)**
- `arrow-nudge`, `sticky-cart-arrow-nudge`, any `animate-pulse`/`animate-bounce` rendered above the fold.
- For each: either (a) cap to 3 iterations then stop, or (b) gate behind `@media (prefers-reduced-motion: no-preference)` + pause when tab hidden via `animation-play-state: paused` on `:where(html:not(:focus-within))` fallback.
- Document survivors in a short comment.

---

## Technical notes

- All edits are presentation-layer only. Zero changes to data fetching, RPCs, edge functions, Cloudflare worker, or storefront business logic.
- No design-token additions needed; reuse existing easing variables in `src/index.css` where present, otherwise inline the `cubic-bezier(...)` values shown above.
- After Tier A + B land, the bundle size should be **unchanged** (class-string edits only). Tier D removes 3 small files → tiny reduction.
- Verification: spot-check SideCart open/close (Tier A.3), Button press anywhere (A.1), product menu dropdown on storefront (A.2), and confirm no console errors after Tier D file removals.

---

## Execution order

1. Tier A (3 primitives) — biggest perceived impact, lowest risk
2. Tier C.1 (tooltip provider) + C.3 (back-to-top easing) — single-line wins
3. Tier B (transition-all sweep, top 20)
4. Tier C.2 + C.4 (card durations, hover gating)
5. Tier D (cleanup last so import audit is final)

I will report back after each tier with the list of touched files so you can sanity-check before the next tier.
