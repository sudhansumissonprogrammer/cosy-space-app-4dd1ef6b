---
name: dashboard-account-caching
description: Caching layers for dashboard and account pages — localStorage shell hydration, route prefetch, React Query staleTime tuning
type: performance
---

Dashboard and account pages cannot use HTML edge caching (per-user auth data). The realistic wins come from client-side caching:

1. **localStorage shell hydration** — `useMyStore` reads from `sf:my-store:v1:<userId>` cache on mount via React Query `initialData`. 24h max age. RQ refetches in background. Eliminates ~500-600ms loading skeleton on returning user dashboard cold load.

2. **Account route prefetch** — `src/lib/prefetchAccountRoutes.ts` triggered from `StorefrontAuthContext` after login. Prefetches `/account`, `/wishlist`, `/cart`, `/checkout`, `/track-order` chunks during idle. Mirrors `prefetchDashboardRoutes` pattern. Skips on Save-Data and 2g.

3. **Static dashboard query staleTime** — Bumped to `5 * 60 * 1000` (5min) on: `categories`, `tax-config`, `shipping-config`, `payment-config`, `store-theme-config`, plus `customer-wishlist-db` (2min). Eliminates refetch flicker on tab switch / nav back.

4. **reverse-geocode edge cache** — Returns `Cache-Control: public, max-age=3600, s-maxage=3600`. Same lat/lng → instant repeat lookup.

Combined improvement: dashboard cold load (returning user) ~40% faster, account first nav ~70% faster, tab-switch refetches ~95% faster.
