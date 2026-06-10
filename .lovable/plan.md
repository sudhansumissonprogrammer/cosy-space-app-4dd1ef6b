
# Emil Design Engineering — Tiers E, F, G, H

Execute all four remaining tiers in one pass, then re-run the skill audit and report any remaining gaps.

---

## Tier E — Shared primitives + page sweep

1. **`src/components/ui/hover-card.tsx`** — add `style={{ transformOrigin: "var(--radix-hover-card-content-transform-origin)" }}` to Content.
2. **`src/components/ui/menubar.tsx`** — add `style={{ transformOrigin: "var(--radix-menubar-content-transform-origin)" }}` to both MenubarContent and MenubarSubContent.
3. **`src/components/ui/context-menu.tsx`** — add `style={{ transformOrigin: "var(--radix-context-menu-content-transform-origin)" }}` to both Content and SubContent.
4. **`src/components/ui/dialog.tsx`** — Close button: `transition-opacity` → `transition-[transform,opacity] duration-150 ease-out active:scale-95`. Keep Dialog itself centered (modals are exempt).
5. **`src/components/ui/sheet.tsx`** — fix `data-[state=open]:duration-400` (invalid Tailwind class) → `data-[state=open]:duration-500`.
6. **Mass page sweep** — sed `transition-all` → `transition-[transform,opacity,colors,box-shadow]` across `src/pages/**` and `src/layouts/**` (~110 hits, ~35 files).

---

## Tier F — Decorative infinites + skeleton

1. **`src/components/ui/skeleton.tsx`** — replace `animate-pulse` with a custom shimmer keyframe (gradient sweep, 1.6s ease-in-out infinite, gated behind `prefers-reduced-motion`). Adds `.skeleton-shimmer` class + `@keyframes skeleton-shimmer` to `index.css`.
2. **`src/index.css` audit** — cap or gate:
   - `cart-breathe` (line 528) — keep infinite but wrap in `@media (prefers-reduced-motion: no-preference)` and add `animation-play-state: paused` when tab hidden.
   - `cta-shimmer-sweep` (line 723) — gate behind `prefers-reduced-motion: no-preference`.
   - `gallery-dot-pulse` (lines 793, 929) + `sale-badge-pulse` (line 834) — keep infinite (very subtle) but gate behind reduced-motion.
   - `marquee` (line 239) — add reduced-motion guard.
   - **Dashboard live-store dot** (`Dashboard.tsx:264`) — replace `animate-pulse` with static + subtle ring.

---

## Tier G — Touch hover gating

Migrate all unguarded `hover:scale-105` / `hover:scale-110` on touch-prone storefront components to the existing `hh:hover-scale-105` / `hh:hover-scale-110` utilities (defined last turn in `index.css`).

Target files (~20):
- `ProductCardStyle1/2/3/5/7/8/9/10.tsx`, `ProductCardV17.tsx`
- `QuickViewModal.tsx`, `FloatingWhatsApp.tsx`, `UniversalCategories.tsx`, `StorefrontFooter.tsx`
- `pages/ProductDetail.tsx`, `V22ProductDetail.tsx`
- `pages/StorefrontHomeV2.tsx`, `StorefrontHomeV17.tsx`, `StorefrontContact.tsx`, `StorefrontCategories.tsx`, `ThemeShowcase.tsx`

Rule: only touch-prone elements (cards, CTAs, icons clicked on mobile) get the swap. Desktop-only admin UIs keep `hover:scale-*`.

---

## Tier H — Micro-polish

1. **`src/index.css:605` ripple-wave** — `transform: scale(0)` → `transform: scale(0.15); opacity: 0.4`.
2. **`src/components/storefront/DeliveryTimeline.tsx:81-82`** — `dt-stamp` keyframe start `scale(0.6)`; `dt-particle` start `scale(0.2)`.
3. **`src/components/ui/input-otp.tsx:44`** — caret `duration-1000` → `duration-700`.
4. **`src/index.css:880` `.img-blurup`** — `ease` → `cubic-bezier(0.22, 1, 0.36, 1)`.
5. **`src/index.css:887` `.logo-shrink`** — `ease` → `cubic-bezier(0.22, 1, 0.36, 1)`.
6. **Pulse keyframe consolidation** — leave standalone (merging risks visual regressions across themes); just confirm all 3 are gated by reduced-motion in Tier F.

---

## After all edits — re-run the skill audit

Run the same scans (transition-all, ease-in, scale(0), unguarded hover, infinite animations, framer-motion shorthand) and produce a fresh Before/After table of anything still outstanding. Likely candidates that will remain (acknowledge upfront, don't fix this pass):
- Page-level `transition-all` inside conditional class strings that sed can't catch
- Marketing landing page animations (intentionally decorative)
- Theme V19/V20 custom keyframes that may have their own design intent

---

## Technical notes

- All edits are presentation-layer; zero changes to data, RPCs, edge functions, or Cloudflare worker.
- No new dependencies. Reuses existing easing tokens in `index.css`.
- Bundle size change: ~0 (class string edits only). Skeleton custom CSS adds ~200 bytes.
- Verification: spot-check Dialog close press, skeleton shimmer on Dashboard load, product card hover on mobile DevTools, OTP caret blink.

---

## Execution order

1. Tier E (primitives + sed sweep) — single batch
2. Tier F (skeleton + index.css guards) — single batch
3. Tier G (sed-replace hover:scale → hh:hover-scale on 20 files)
4. Tier H (5 surgical edits)
5. Re-run audit scans → fresh report
