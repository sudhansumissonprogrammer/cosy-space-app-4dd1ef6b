
Objective
- Restore storefront on real devices to match preview behavior/design and stop image/font/loading failures without rolling back performance work.

What I found (deep analysis)
1) Production/subdomain rendering is not the same as preview
- Preview uses React app directly.
- Live subdomain uses edge HTML injection + server-rendered shell.
- The live shell currently outputs product cards that can differ visually from app cards (button/style mismatch), so users see “changed layout”.

2) Server-rendered shell image logic is breaking product images
- Shell generates image src using `/cdn-cgi/image/.../https://external-image`.
- For external sources (like carrybazaar.com / wordpress/shopify custom hosts), this can fail/hotlink-block and show broken images.
- One product URL contains multiple comma-separated images; shell currently doesn’t split to first image, producing invalid src.

3) HTML injection path is brittle
- Skeleton replacement logic in worker is regex-fragile; malformed replacement can leave mixed old/new markup.
- That causes unstable first paint and “not loading like before” behavior on fresh devices.

4) Remaining UI regressions from invalid CSS alpha syntax across themes
- Many files still use invalid patterns like `var(--storefront-text...)0a` / `...08`.
- Browsers drop these values, causing border/background/button styling drift.
- Theme-10 (user’s store) still has multiple such values in header/menu/tabbar/home sections.

5) Minor storefront consistency issues
- Some components still hardcode color/currency formatting inconsistently with theme/store settings.
- This contributes to visual mismatch between preview and published storefront.

Safe fix implementation plan (minimal-risk, targeted)
Phase 1 — Stabilize live rendering path first (highest impact)
1. Harden edge shell image generation
- In worker shell builder: always normalize product image by taking first URL from comma-separated string.
- Only use `/cdn-cgi/image` for trusted compatible origins; for external hosts, use original URL (or safe proxy fallback) to prevent broken images.
- Keep current performance preloading behavior where compatible.

2. Make shell replacement deterministic
- Replace fragile regex replacement with marker-based replacement:
  - Add explicit skeleton start/end markers in HTML template.
  - Worker replaces content only between those markers.
- Prevent partial DOM corruption and ensure scripts/styles remain intact.

3. Keep app hydration source authoritative
- Continue injecting `window.__STOREFRONT_DATA__` for speed.
- Ensure shell HTML is only a visual placeholder, not a divergent UI implementation.

Phase 2 — Restore design parity (theme/UI regressions)
4. Sweep and fix invalid alpha color syntax in storefront files
- Replace remaining `var(...)xx` usages with `withAlpha(...)` or `color-mix(...)`.
- Prioritize theme-10 + shared components first, then all storefront theme files found by regex scan.
- This restores borders, tinted backgrounds, badges, and button surfaces.

5. Align button/product card styles to theme variables
- Ensure Add to Cart and key CTAs use `--storefront-primary` + `--storefront-btn-text`.
- Remove lingering hardcoded visual colors where they break theme consistency.

6. Patch any remaining component-level drift
- Search overlay hover/background tints
- Header/menu borders
- Trust badges / category chips
- Product card fallback/image states

Phase 3 — Verification and rollout
7. Regression checklist on live domains (not just preview)
- Open store on fresh browser/incognito + second device.
- Confirm:
  - Product images load (including first 4 above-the-fold)
  - No broken `&amp;amp;` text rendering
  - Buttons match previous intended design
  - No permanent skeleton/flicker state
  - Theme colors/fonts applied correctly
  - Add-to-cart/cart drawer/checkout interactions work

8. Publish + edge cache hygiene
- Publish latest build after fixes.
- Purge edge cache for affected hosts to clear stale injected HTML.
- Re-check subdomain and custom domain separately.

Files I will touch in implementation
- src/pages/StorefrontHomeV10.tsx
- src/layouts/StorefrontLayoutV10.tsx
- src/components/storefront/StorefrontSearchOverlay.tsx
- (plus all storefront files with remaining invalid alpha syntax from scan)
- docs/cloudflare-worker-fixed.js (and align final production worker variant used in deployment)
- index.html (only if marker hooks are needed for deterministic shell replacement)

Expected result
- Live storefront on new devices matches preview structure/design.
- Product images reliably load across external image hosts.
- No random style regressions from invalid CSS color syntax.
- Performance optimizations remain (fast first paint + cached storefront data), but without visual/behavior breakage.
