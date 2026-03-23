

## Plan: Critical Performance Fixes — CSS Splitting, Supabase Deferral, Theme Isolation, Worker Parallelization

### Problem Summary

4 critical bottlenecks remain on cold storefront load:

1. **119KB monolithic CSS** — All admin/dashboard/11-theme styles render-block every storefront visitor
2. **Supabase SDK (46KB gzip)** on storefront critical path — imported synchronously in `StorefrontLayout.tsx` line 5, but only used for the `get_storefront_data` RPC call (which is already bypassed when Worker-injected data exists)
3. **vendor-ui (46KB gzip)** — Sheet, Dialog, Button eagerly imported in `StorefrontLayout.tsx` lines 6-8
4. **All 11 themes bundled together** — `manualChunks` uses a static object, not a function, so Vite can't isolate per-theme chunks

### Changes

---

#### 1. Function-based `manualChunks` with per-theme isolation (`vite.config.ts`)

Replace the static `manualChunks` object with a function that:
- Routes each `StorefrontLayoutVX` and `StorefrontHomeVX` into its own `theme-X` chunk
- Isolates admin pages (`route-admin`), dashboard pages (`route-dashboard`)
- Keeps vendor splits (react, router, query, supabase, ui-core, ui-extra)
- Adds `vendor-icons` for lucide-react

This ensures a theme-12 visitor downloads zero code from themes 1-11, 13.

#### 2. Lazy-load Supabase SDK in StorefrontLayout (`src/layouts/StorefrontLayout.tsx`)

The `supabase` import on line 5 pulls the entire SDK into the storefront critical path. Since Worker-injected data (`__STOREFRONT_DATA__`) eliminates the need for the RPC call on first load for most visitors:

- Replace the static `import { supabase }` with a dynamic `import()` inside the `queryFn` — only when actually needing to call the API (cache miss, no injected data)
- This removes ~46KB gzip from the initial storefront JS parse

#### 3. Lazy-load Sheet and Dialog (`src/layouts/StorefrontLayout.tsx`)

Sheet (hamburger menu) and Dialog (exit checkout confirmation) are never visible on first paint. Lazy-load them:

- Wrap `HamburgerMenu` in a lazy component that imports Sheet on first open
- Wrap the exit-checkout Dialog similarly
- Keep Button since it's lightweight and used in nav

#### 4. Parallelize Worker subdomain checks (`docs/cloudflare-worker-fixed.js`)

Lines 697-711: `getCustomDomainForSlug`, `handleSeoFiles`, `handleBot` run sequentially but are independent. Wrap in `Promise.all` to save 50-100ms per subdomain request.

#### 5. Move non-critical storefront components to lazy imports (`src/layouts/StorefrontLayout.tsx`)

These are already imported but should use `lazy()`:
- `SideCart` — only renders when cart opens
- `ExitIntentPopup` — only renders after delay
- `FloatingWhatsApp` — non-critical
- `SmartInstallPrompt` — non-critical
- `DynamicPwaManifest` — non-critical

---

### File Changes

| File | Change |
|------|--------|
| `vite.config.ts` | Replace static `manualChunks` with function-based splitter. Per-theme chunks, admin/dashboard isolation, `vendor-icons` chunk |
| `src/layouts/StorefrontLayout.tsx` | Dynamic `import()` for Supabase SDK in queryFn. Lazy-load Sheet, Dialog, SideCart, ExitIntentPopup, FloatingWhatsApp, SmartInstallPrompt, DynamicPwaManifest |
| `docs/cloudflare-worker-fixed.js` | Parallelize subdomain checks (custom domain + SEO + bot) with `Promise.all` |

### Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| Storefront JS (initial) | ~325KB raw | ~120KB raw (theme-specific only) |
| Supabase SDK | Always loaded (170KB raw) | Deferred until needed |
| Sheet+Dialog UI | Always loaded (80KB raw) | Deferred until interaction |
| Subdomain TTFB | Sequential (150ms) | Parallel (50ms) |
| CSS | Still monolithic (Tailwind limitation) | Same — requires build-time purge plugin (out of scope) |

**Note on CSS**: The 119KB CSS bundle is a Tailwind architectural constraint — all utility classes compile into one file. True CSS splitting requires `@tailwind` per entry point or a PurgeCSS post-build step, which is a larger refactor. The inline critical CSS in `index.html` already ensures the skeleton renders before the CSS bundle loads.

