---
name: Liquid Glass (Apple refraction)
description: Setup + usage of the liquid-glass refraction effect available for storefront UI
type: reference
---

Source: https://github.com/deepika-builds/liquid-glass (MIT), ported into the project.

Files:
- `src/lib/liquidGlass.ts` — optics: SVG displacement map + `backdrop-filter`. Chromium only; Safari/Firefox auto-fallback to frosted blur.
- `src/hooks/useLiquidGlass.ts` — ref hook, cleans up on unmount, skips heavy filter under prefers-reduced-motion.
- `src/components/storefront/LiquidGlass.tsx` — `<LiquidGlass as="nav" interactive tone="dark" scale={-90}>`.
- `src/styles/liquid-glass.css` — `.lg-surface` dressing, imported only by the component (zero cost unless used).

Rules: never let refraction carry meaning; keep panels under ~800px per side; tune `scale` (-60 subtle / -112 default / -180 dramatic) and `chroma`. `color-interpolation-filters="sRGB"` is mandatory (module sets it).

Not wired into any storefront theme yet — opt-in per component on request.
