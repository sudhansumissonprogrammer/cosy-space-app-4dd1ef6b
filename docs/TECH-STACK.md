# ShopBanao (Storivo) — Tech Stack & Developer Onboarding

> Hand this to any new developer. Read `docs/ARCHITECTURE.md` next for the deep map.

## 1. What it is

Multi-tenant ecommerce SaaS for India. One codebase, four audiences:

| Surface | Who | Where |
|---|---|---|
| Marketing landing | Visitors | `shopbanao.in` |
| Seller dashboard | Store owners | `/dashboard/*` |
| Admin panel | Platform ops | `/admin/*` |
| Storefronts (22 themes) | Buyers | `brand.shopbanao.in`, custom domains |
| Partner program | Affiliates | `/partner/*` |

Scale reference: ~591 TS/TSX source files, 98 edge functions, 393 DB migrations, 88 tables.

## 2. Frontend

| Layer | Choice | Version |
|---|---|---|
| Framework | React | 18.3 |
| Language | TypeScript | 5.x |
| Bundler | Vite + `@vitejs/plugin-react-swc` | 5.x |
| Styling | Tailwind CSS v3 + `tailwindcss-animate` + typography plugin | 3.x |
| Components | shadcn/ui on Radix UI primitives (~30 packages) | — |
| Icons | lucide-react | 0.462 |
| Routing | react-router-dom | 6.30 |
| Server state | TanStack Query v5 | 5.83 |
| Forms | react-hook-form + zod v4 + `@hookform/resolvers` | — |
| Charts | recharts | 2.15 |
| Carousels | embla-carousel-react (+ autoplay, auto-height) | 8.6 |
| Animation | GSAP, tailwindcss-animate | 3.14 |
| Toasts | sonner + shadcn toaster | — |
| Sheets/drawers | vaul | — |
| SEO head | react-helmet-async | 3.0 |
| PDF/invoices | jspdf + jspdf-autotable | — |
| Media | `@ffmpeg/ffmpeg`, mp4-muxer, WebCodecs compression | — |
| PWA | vite-plugin-pwa (preview/local only — never on live hosts) | 0.19.8 |
| Sanitization | dompurify | 3.3 |
| QR | qrcode.react | 4.2 |
| Testing | vitest + @testing-library/react + jsdom | — |
| Lint | eslint 9 flat config + react-hooks + react-refresh | — |

### Two app entries (critical)
`src/main.tsx` picks at runtime by host + path:
- `src/LandingApp.tsx` — root domain `/`, `/theme`, `/guides` only. No Supabase, no React Query, no theme chunks.
- `src/App.tsx` — everything else (storefronts, dashboard, admin, partner).

Cross-app navigation uses plain `<a href>` hard nav. Never nest two BrowserRouters. Never import `App` from `LandingApp`.

### Chunking (`vite.config.ts`)
`react-core`, `storefront-shell`, `dashboard`, `admin`, `landing`, `radix`, `supabase`. Goal: a storefront pageview = React chunk + storefront-shell chunk + one theme chunk.

## 3. Backend — Lovable Cloud (Supabase)

- **Postgres** — 88 tables, RLS on everything, ~200 SQL functions (mostly `security definer` RPCs).
- **Auth** — three isolated systems: platform sellers (`AuthContext`), storefront buyers (`StorefrontAuthContext` + `storefront_customers`), admins (`user_roles` + `has_role()`).
- **Storage** — legacy Supabase storage, now migrated to Cloudflare R2.
- **Edge Functions** — 98, Deno runtime, in `supabase/functions/`.
- **Realtime** — live sessions, order updates.

### Key data-path RPCs (protected by an event trigger against overloads)
`get_storefront_shell(_slug)`, `get_storefront_data(_slug)`, `get_store_public(_slug)`.
**Rule:** always `DROP FUNCTION IF EXISTS ...(old_sig)` before `CREATE OR REPLACE` when changing arguments. Skipping this → PGRST203 → every storefront 500s.

### Edge function domains
| Domain | Functions |
|---|---|
| Payments | `payu-*` (create-txn, webhook, reconcile, status, verify), `razorpay-*`, `*-cashfree-*`, `create-upi-intent`, `place-order`, `checkout-v2-cod`, `order-payment-status`, `cancel-pending-order`, `expire-stale-pending-orders` |
| WhatsApp (24 fns) | `wa-queue-worker`, `wa-platform-send`, `wa-cart-recovery-cron`, `wa-campaign-runner`, `wa-autologin`, `wa-r` / `wa-link-redirect`, `wa-template-*`, `wa-billing-reconcile`, `whatsapp-webhook` |
| Marketing/analytics | `meta-capi`, `verify-meta-capi`, `meta-product-feed`, `upsell-track`, `track-referral-click` |
| Storefront ops | `prewarm-store`, `prewarm-cron`, `purge-cache`, `bot-render`, `seo-page`, `image-ops`, `pincode-lookup`, `reverse-geocode` |
| Images/R2 | `r2-upload`, `r2-delete`, `r2-migrate-images`, `r2-convert-jpegs`, `review-upload` |
| Shipping | `delhivery`, `ekart`, `shiprocket` |
| Partner program | `partner-*`, `admin-partner-*`, `admin-withdrawal-action` |
| Wallet/billing | `wallet-cashfree-*`, `admin-wallet-controls` |
| Migration (import from other platforms) | `migration-detect/start/status/worker` |
| AI (Lovable AI Gateway, no key) | `generate-description`, `generate-page-html`, `generate-store-content`, `ingest`, `wa-ai-template-draft` |
| Auth/onboarding | `auth-proxy`, `auth-email-hook`, `phone-login`, `create-guest-account`, `delete-store`, `verify-domain` |

## 4. Edge layer — Cloudflare Worker

File: `docs/cloudflare-worker-current.js` (plain JS, **not** bundled by Vite, **manual deploy**).

Owns:
- `/cf-img?url=&w=&q=` — edge image resize
- `/fonts/*` — immutable cache
- Google Fonts injection (`data-sf-font` marker), `#sf-skel` skeleton, `__SF_WORKER__` flag
- `/r/`, `/cart/`, `/order/` WhatsApp redirect fast path (302 at edge, zero JS)
- HTML caching via `cacheableResponse()`
- Analytics Engine pageview writes
- Storefront-shell parallel warming

React and `index.html` detect the worker markers and skip duplicating work.

## 5. Images / CDN

All production storefront images: **R2 bucket `shopbanao-images` → `cdn.shopbanao.in`**. Uploads via edge fn `r2-upload` (SigV4 with `aws4fetch`). Single 800w webp, browser downscales, no runtime resize. Worker bypasses the CDN hostname so R2 serves directly.

## 6. Integrations

- **Payments:** PayU (primary), Razorpay, Cashfree, UPI intent deep-links (`intent://` on Android), COD, partial/advance payments.
- **WhatsApp:** Meta Cloud API — shared platform number today, BYON/embedded signup planned. Template management, campaign runner, cart recovery, magic-link auto-login (HMAC tokens).
- **Meta Ads:** Pixel + Conversions API with dedupe, PII hashing, server-side client-IP forwarding, EMQ tuning.
- **Shipping:** Delhivery, Ekart, Shiprocket.
- **Analytics:** GA4, Facebook Pixel, Cloudflare Analytics Engine, in-house `page_views` / `live_sessions`.
- **MCP server:** `src/lib/mcp/` + `mcp` edge fn (list stores/products, get store).

## 7. Themes

22 storefront layouts. `stores.theme` selects `StorefrontLayoutV{N}.tsx` + `StorefrontHomeV{N}.tsx`. V19/V20/V22 also have their own ProductDetail/CartPage. Per-store colors, fonts, button styles come from `store_theme_config` → CSS custom properties via `useStorefrontThemeConfig`.

Shared shell: `src/layouts/StorefrontShell.tsx` + `StorefrontLayout.logic.ts`. Variant layouts are presentation only.

## 8. Repo layout

```
src/
  main.tsx                entry router (host+path → LandingApp | App)
  LandingApp.tsx / App.tsx
  pages/                  ~150 pages (dashboard, admin, partner, storefront, appStore)
  layouts/                StorefrontShell + 22 theme layouts + Admin/Partner layouts
  components/             ui/ (shadcn), storefront/, dashboard/, admin/, landing/,
                          partner/, whatsapp/, wallet/, billing/, shipping/, appStore/
  hooks/                  ~60 hooks (data, perf, tracking, UX)
  contexts/               Auth, StorefrontAuth, Cart, Wishlist, DashboardStore, AdminView
  lib/                    subdomain resolution, pixel/CAPI, image opt, prefetch,
                          appStore engines (bundle pricing, upsell matching), mcp
  integrations/supabase/  AUTO-GENERATED — never edit
supabase/
  functions/              98 Deno edge functions
  migrations/             393 SQL migrations
docs/                     ARCHITECTURE.md, TECH-STACK.md, cloudflare-worker-current.js, audits
loadtest/                 k6 scripts + SQL monitoring
.lovable/                 feature specs + project memory
```

## 9. Commands

```bash
bun run dev       # Vite dev server (port 8080)
bunx vitest run   # tests
bun run lint      # eslint
```
Never run `vite build` / `tsc --noEmit` manually — the harness does it.

## 10. Hard rules (breaking these causes outages)

1. Never edit `src/integrations/supabase/client.ts`, `types.ts`, `.env`, or project-level `supabase/config.toml`.
2. Never add an RPC parameter without `DROP FUNCTION` first.
3. Roles live only in `user_roles`. Never on `profiles`. Never FK to `auth.users`.
4. Every new public table needs `GRANT` + `ENABLE ROW LEVEL SECURITY` + policies in the same migration.
5. No hardcoded colors (`bg-black`, `text-white`, hex) — semantic tokens only.
6. No `CHECK` constraints using `now()` — use validation triggers.
7. Never put `src/lib/subdomain` into the `storefront-shell` manual chunk (drags 245KB onto landing).
8. Worker edits require a manual Cloudflare deploy.
9. Service workers only on preview/local hosts — never live.
10. No pricing figures on the landing page.

## 11. Performance targets (cold subdomain load)

TTFB < 500ms · FCP < 1.8s · CLS < 0.1 · DCL < 2s.
Levers already in place: worker HTML cache, font `display:optional`, hero aspect-ratio reservation, localStorage shell hydration, module preload warming, R2/webp images, chunk merging.

## 12. Where to look first when debugging

| Symptom | Look at |
|---|---|
| "Store not found" | `lib/subdomain.ts`, `stores.slug`, RLS |
| All storefronts 500 after a migration | RPC overload (PGRST203) |
| Payment stuck pending | `payu-reconcile` cron, `order-payment-status`, gateway webhook logs |
| WhatsApp message not sent | `wa_send_queue`, `wa-queue-worker`, Meta token expiry, frequency cap |
| Slow first paint | Worker cache headers, font swap, hero reservation |
| Auth loop | Wrong auth context (platform vs storefront vs admin) |
| Image not resizing | `/cf-img` route + `lib/imageOptimize.ts` |
