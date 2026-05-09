# Architecture — Storivo / ShopBanao

> Deep map of the codebase. Read this first before debugging anything non-trivial.
> Last updated: May 2026.

## 1. What this app is

Multi-tenant ecommerce SaaS for the Indian market. One codebase serves:

- **Landing site** at root domain (shopbanao.in)
- **Seller dashboard** for store owners
- **Admin panel** for platform operators
- **20 storefront themes** for buyers, served via subdomains and custom domains
- **Partner program** for affiliates

Stack: React 18, Vite 5, TypeScript 5, Tailwind v3 + shadcn/ui, TanStack Query, React Router v6, Supabase (Postgres + Auth + Storage + Edge Functions + Realtime), Cloudflare Worker for edge.

## 2. Top-level entry flow

```text
                 main.tsx
                    │
       ┌────────────┴────────────┐
       │                         │
   isRootDomainHost &&       everything else
   path is / or /theme        (subdomain, custom domain,
       │                       /dashboard, /admin, /login,
       ▼                        /store/:slug, /preview)
   LandingApp.tsx                       │
   - Index.tsx                          ▼
   - ThemeShowcase                  App.tsx
   No Supabase, RQ, Auth        - QueryClientProvider
   No theme chunks              - DashboardProviders (lazy: Auth/Toaster/Tooltip/Sonner)
                                - All storefront + dashboard + admin routes
```

**Why two entries?** Landing critical-path JS = React + router + Index only. App.tsx pulls Radix + Supabase + RQ (~500KB). Hard navigation (`<a href>`) bridges the two — never nest BrowserRouters.

## 3. Host → store resolution

`src/lib/subdomain.ts` is the source of truth.

| Host pattern | Result |
|---|---|
| `shopbanao.in`, `www.shopbanao.in` | Root → LandingApp |
| `*.shopbanao.in` | Subdomain → `stores.slug = subdomain` |
| Custom domain (`example.com`) | Lookup `stores.custom_domain` |
| `*.lovable.app`, `id-preview--*` | Preview → `/store/:slug` route |
| `localhost` | Dev → `/store/:slug` route |

Multi-tenancy is enforced by RLS, not routing. If routing is wrong, RLS still blocks data leaks.

## 4. Storefront theme system (20 variants)

```text
stores.theme  →  picks layout + home pair
┌──────────────┬──────────────────────────────┬──────────────────────────────┐
│ Theme ID     │ Layout                       │ Home page                    │
├──────────────┼──────────────────────────────┼──────────────────────────────┤
│ default (V1) │ StorefrontLayout.tsx         │ StorefrontHome.tsx           │
│ V2, V3       │ StorefrontLayoutV{N}.tsx     │ StorefrontHomeV{N}.tsx       │
│ V10–V20      │ StorefrontLayoutV{N}.tsx     │ StorefrontHomeV{N}.tsx       │
└──────────────┴──────────────────────────────┴──────────────────────────────┘
```

V19 and V20 also have unique `ProductDetail` and `CartPage` (`V19ProductDetail.tsx` etc.). All other themes share `ProductDetail.tsx` / `CartPage.tsx`.

Per-store customization: `store_theme_config` row → CSS custom properties at runtime via `useStorefrontThemeConfig`. Colors, fonts, button-style, marquee gradient.

Shared shell: `src/layouts/StorefrontShell.tsx` + `StorefrontLayout.logic.ts` carry data fetch, theme injection, header/footer wiring. Variant layouts are presentation.

## 5. Auth — three separate systems

| Context | Users | Provider | Routes |
|---|---|---|---|
| Platform | Store owners | `AuthContext.tsx` | /login /signup /dashboard /forgot-password /reset-password |
| Storefront | Buyers | `StorefrontAuthContext.tsx` | per-store login, account, orders |
| Admin | Platform admins | role check via `user_roles` | /admin/login, /admin/* |

Roles always in `user_roles`, NEVER on profiles. `has_role(auth.uid(), 'admin')` security-definer powers admin RLS without recursion. `AdminRoute.tsx` is just UX — RLS is truth.

Storefront customers live in `storefront_customers` (per-store), separate from platform `profiles`. Auto-confirm email is allowed for buyers, never for sellers.

## 6. Storefront data path (cold load)

```text
1. brand.shopbanao.in/  →  Cloudflare Worker
                              │
2.                            ▼
   Worker injects:  fonts (<link data-sf-font>), #sf-skel, __SF_WORKER__ flag
   Worker rewrites: <img src> → /cf-img?url=&w=&q=
   Worker may serve fully cached HTML (cacheableResponse v8.3.0)
                              │
3.                            ▼
   Browser parses, React boots (App.tsx)
                              │
4. getSubdomainSlug() → 'brand'
                              │
5. RPCs (Postgres):
   - get_storefront_shell(_slug)  → store + theme + nav  (paint immediately)
   - get_storefront_data(_slug)   → products, categories, banners (post-paint)
   - get_store_public(_slug)      → public-safe store row, no secrets
                              │
6. localStorage shell hydration if recent visit (see mem://performance/dashboard-account-caching)
                              │
7. React Query keeps everything for 5–10 min staleTime
```

**CRITICAL — RPC overload rule.** Three RPCs above are protected by a Postgres event trigger that blocks duplicate overloads. Adding a parameter without dropping the old signature → PGRST203 → every storefront 500s. Always:
```sql
DROP FUNCTION IF EXISTS public.get_storefront_shell(text);
CREATE OR REPLACE FUNCTION public.get_storefront_shell(_slug text, _new_param ...) ...
```
See `mem://constraints/database-function-overloads` for the post-mortem.

## 7. Cloudflare Worker (`docs/cloudflare-worker-current.js`)

Owns everything edge-side. Manual deploy after edits.

| Route | Behavior |
|---|---|
| `/cf-img?url=&w=&q=` | Edge image resize (Cloudflare Images-style). Localhost falls back to Supabase Render API. |
| `/fonts/*` | `Cache-Control: public, max-age=31536000, immutable` + edge cache. (v8.9.2) |
| HTML responses | Inject Google Fonts `<link>` (with `media="print" onload=...` swap), `#sf-skel`, `__SF_WORKER__` flag |
| Synthesized responses | `cacheableResponse()` helper so redirects/4xx hit cache too (v8.3.0) |

React + index.html detect `__SF_WORKER__` / `data-sf-font` markers and skip duplication.

## 8. Vite chunking strategy (`vite.config.ts`)

```text
manualChunks:
  react-core   ← react-dom, react, scheduler
  storefront-shell ← StorefrontShell + commonly-used storefront pieces
                    (useProductCardActions, StarRating, SectionHeading,
                     OptimizedImage, PageTransition, StorefrontTrustStrip,
                     ScrollProgressBar)  — keeps storefront to a single chunk
  dashboard    ← AppSidebar, dashboard pages
  admin        ← admin/* pages
  landing      ← Index + landing components (only loaded by LandingApp)
  radix        ← all @radix-ui/*
  supabase     ← @supabase/supabase-js (lazy, off landing critical path)
```

Goal: storefront pageview = ~1 React chunk + 1 storefront-shell chunk + 1 theme chunk. Dashboard never loads on storefront.

## 9. Edge functions (50+, in `supabase/functions/`)

Grouped:
- **Payments** — razorpay-*, cashfree-*, store-cashfree-*, place-order
- **Auth/onboarding** — auth-proxy, auth-email-hook, phone-login, create-guest-account, delete-store
- **Storefront ops** — prewarm-store, bot-render, seo-page, reverse-geocode, image-ops
- **Notifications** — notify-order, process-email-queue, whatsapp-* (3), meta-capi
- **AI (Lovable AI Gateway, no key)** — generate-description, generate-page-html, generate-store-content, ingest
- **Partner program** — admin-partner-*, partner-* (analytics/wallet/payouts), assign-store-plan, billing-cron
- **Domains** — verify-domain

Per-store payment keys live in `store_payment_config`. Public view `store_payment_config_public` hides secrets from RLS.

## 10. Database — key tables

Stores: `stores`, `store_theme_config`, `store_payment_config`, `store_shipping_config`, `store_tax_config`
Catalog: `products`, `product_images`, `product_variants`, `categories`
Sales: `orders`, `order_items`, `coupons`, `abandoned_carts`, `whatsapp_orders`, `customer_leads`
People: `profiles`, `user_roles`, `storefront_customers`, `customer_addresses`, `customer_wishlists`
Analytics: `page_views`
Plans: `plans`, `subscriptions`

All have RLS. Public read on products/categories/stores for storefront. Admin checks via `has_role()`.

## 11. Performance baseline & known fixes

| Concern | Fix | Where |
|---|---|---|
| CLS from late-mount footer | Suspense fallback `min-height:600px` | `CheckoutAwareLayout.tsx` |
| Hero LCP | Aspect-ratio reservation + Worker preload | `mem://performance/pagespeed-cls-lcp-fixes` |
| Font CLS | Inter preload + secondary fonts `font-display:optional` | `index.html`, `index.css` |
| Render-blocking Google Fonts | Worker injects with `media="print" onload=this.media='all'"` | Worker v8.9.2 |
| Worker hits per pageview | Vite chunk merge (~7 fewer hits) | `vite.config.ts` |
| Cache rate on synthesized responses | `cacheableResponse()` helper | Worker v8.3.0 |
| Image waterfalls | `/cf-img` edge resize | Worker, `lib/imageOptimize.ts` |

Targets (cold subdomain load): TTFB <500ms, FCP <1.8s, CLS <0.1, DCL <2s.

## 12. Forbidden / careful list

See `mem://conventions` for the full list. Quick form:

- Don't edit auto-gen files: `supabase/client.ts`, `types.ts`, `.env`, `config.toml` project-level
- Don't import App from LandingApp (perf regression)
- Don't add RPC params without DROP FUNCTION first (outage)
- Don't put roles on profiles
- Don't FK to `auth.users`
- Don't use raw color classes (`bg-black`) — semantic tokens only
- Don't use CHECK constraints with `now()` (immutability) — validation triggers
- Don't show specific prices on landing page

## 13. Build/test/dev commands

```bash
bun run dev          # Vite dev (already running in sandbox)
bunx vitest run      # tests
bun run lint         # eslint
```

Never run `vite build` or `tsc --noEmit` manually — the Lovable harness runs them automatically after edits.

Worker file (`docs/cloudflare-worker-current.js`) is plain JS, not bundled by Vite. Deploy manually to Cloudflare after editing.

## 14. Where to look first when debugging

| Symptom | Look at |
|---|---|
| Wrong storefront / "store not found" | `lib/subdomain.ts` host detection, `stores.slug`, RLS |
| 500 on every storefront after migration | RPC overload — check `get_storefront_shell` signatures |
| Slow first paint | Worker cache headers, font swap, hero aspect-ratio |
| CLS shift | Late-mount components without size reservation |
| Auth loops | Wrong context — platform vs storefront vs admin |
| Payment failure | `store_payment_config` row, edge fn logs (`razorpay-verify`) |
| Missing data with RLS error | Check policy + that role check uses `has_role` |
| Module preload pulling huge chunks onto landing | `LandingApp.tsx` accidentally imports App or Supabase |
| Image not resizing | `/cf-img` worker route + `imageOptimize.ts` fallback |
