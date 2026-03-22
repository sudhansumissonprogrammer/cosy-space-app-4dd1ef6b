

## Plan: Improve Storefront Performance (74→95+) and Accessibility (85→95+)

Based on the Lighthouse report from mgwinner.in, here are the specific issues and fixes.

---

### Performance Fixes (74 → 95+ target)

**Issue 1: FCP 3.2s / LCP 4.6s — CSS is render-blocking (1,250ms)**

The main CSS bundle (`index-DK4_eNLb.css`) blocks first paint for 1.25 seconds with 17KB unused.

**Fix:** Inline critical above-the-fold CSS in `index.html` and async-load the full stylesheet. We already have some inline styles — expand them to cover the storefront skeleton, marquee bar, and nav shell so the page paints instantly.

| File | Change |
|------|--------|
| `index.html` | Add more critical CSS inline (nav, marquee, card grid skeleton). Add `<link rel="preload" as="style">` pattern for main CSS |

**Issue 2: LCP element render delay 1,280ms — image not preconnected**

The LCP image comes from `overlaysnow.com` (external CDN), but there's no `<link rel="preconnect">` for it. Lighthouse suggests 300ms savings.

**Fix:** Dynamically inject `<link rel="preconnect">` for the product image origin when storefront data loads. Since image origins vary per store, we'll add this in `StorefrontLayout.tsx` after store data is available.

| File | Change |
|------|--------|
| `src/layouts/StorefrontLayout.tsx` | After store loads, extract image origin from first product and inject `preconnect` link |

**Issue 3: LCP resource load delay 1,240ms — JS execution before image request**

The browser discovers the LCP image late because it's rendered by React after JS executes.

**Fix:** In the Cloudflare Worker (already injects `__STOREFRONT_DATA__`), also inject a `<link rel="preload" as="image">` for the first product image directly into the HTML `<head>`. On the client side, use `preloadHeroImage()` earlier.

| File | Change |
|------|--------|
| `src/layouts/StorefrontLayout.tsx` | Call `preloadHeroImage` for first product image in `useStorefront` initialData path |

**Issue 4: Unused JS 94KB — vendor bundles too large**

Supabase SDK (35.6KB unused), main index (29.3KB unused), UI vendor (29.3KB unused).

**Fix:** Split Radix UI components into more granular chunks and ensure tree-shaking works properly. Move rarely-used Radix packages out of the vendor-ui chunk.

| File | Change |
|------|--------|
| `vite.config.ts` | Split `vendor-ui` into `vendor-ui-core` (dialog, popover, select) and `vendor-ui-extra` (rest). Add `vendor-icons` for lucide-react |

**Issue 5: `<main>` landmark missing**

No `<main>` element wrapping page content, which also affects accessibility.

**Fix:** Wrap the `<Outlet>` content area with `<main>` in all storefront layouts.

| File | Change |
|------|--------|
| `src/layouts/StorefrontLayout.tsx` (+ all V2–V13 variants) | Wrap `<Suspense>` block in `<main>` element |

---

### Accessibility Fixes (85 → 95+ target)

**Issue 6: Buttons without accessible names (5 failing elements)**

- `CartBadge` button — no `aria-label`
- `WishlistBadge` link+button — no `aria-label`  
- `AccountBadge` link — no `aria-label`
- `ShareStoreDialog` icon-only button — no `aria-label`
- Filter/sort buttons on StorefrontHome — no `aria-label`
- Search trigger button — no `aria-label`

| File | Change |
|------|--------|
| `src/layouts/StorefrontLayout.tsx` | Add `aria-label` to CartBadge, WishlistBadge, AccountBadge, ShareStoreDialog icon button |
| `src/components/ShareStoreDialog.tsx` | Add `aria-label="Share store"` to icon-only button |
| `src/pages/StorefrontHome.tsx` | Add `aria-label` to search trigger, filter button, sort button |

**Issue 7: Links without discernible names**

- Store logo link (no alt text when logo is an image, no text fallback)
- Login link (icon only, no aria-label)
- Wishlist link (icon only, no aria-label)

| File | Change |
|------|--------|
| `src/layouts/StorefrontLayout.tsx` | Add `aria-label` to logo link, login link, wishlist link |

**Issue 8: Insufficient color contrast**

- Search bar placeholder text on `bg-accent/60` — low contrast
- `text-success` discount badges on `bg-success/10` — low contrast  
- `btn-gold` ADD TO CART buttons — potential contrast issue
- Marquee text on gradient background

| File | Change |
|------|--------|
| `src/index.css` | Darken `--success` from `152 60% 42%` to `152 60% 32%` for better contrast on light bg |
| `src/pages/StorefrontHome.tsx` | Change search placeholder from `text-muted-foreground` to `text-foreground/60` for better contrast |
| `src/components/storefront/ProductCardStyle1.tsx` | Ensure discount badge text meets 4.5:1 ratio. Change `text-success` to `text-success-foreground` with darker `bg-success` |
| `src/components/storefront/StorefrontMarquee.tsx` | Ensure marquee text color has sufficient contrast against gradient |

**Issue 9: Missing `<main>` landmark** (covered in Issue 5 above)

---

### SEO Fix

**Issue 10: robots.txt validation error**

Line 29 `Content-Signal: search=yes,ai-train=no` is flagged as unknown directive.

| File | Change |
|------|--------|
| `supabase/functions/robots-txt/index.ts` | Remove or comment out the `Content-Signal` line since it's a non-standard directive |

---

### Summary — 13 files to edit

| Category | Files |
|----------|-------|
| Performance | `index.html`, `vite.config.ts`, `src/layouts/StorefrontLayout.tsx` (+ V2–V13) |
| Accessibility | `StorefrontLayout.tsx`, `ShareStoreDialog.tsx`, `StorefrontHome.tsx`, `ProductCardStyle1.tsx`, `StorefrontMarquee.tsx`, `index.css` |
| SEO | `robots-txt/index.ts` |

All changes apply to the shared storefront components, so every current and future store will benefit automatically.

