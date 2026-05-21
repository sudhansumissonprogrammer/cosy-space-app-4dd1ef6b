# Plan: make custom-domain Worker caching reliable

## Goal
Make storefront HTML caching work correctly for ad traffic on custom domains like `serdiyajewellers.shop`, so repeat anonymous visits return cached HTML instead of running the full Worker pipeline every time.

Expected headers on repeat hits:

```text
x-edge-cache: HIT-EARLY
cf-cache-status: HIT
x-worker-version: 8.25.2-custom-domain-zone-key
x-cache-timestamp: unchanged for the cached object
```

## Current finding
Live home-page checks now show `serdiyajewellers.shop` can return `cf-cache-status: HIT`, but the Worker should be hardened because custom-domain cache keys are still more fragile than `*.shopbanao.in` keys.

The risk is that custom domains can be served from a different hostname context than the Worker zone. If the mirror write and early read do not use the exact same zone-safe key, `cache.put()` appears to succeed but later `cache.match()` does not find it.

## Changes to make
1. Add one canonical HTML cache-key helper
   - Build a zone-owned key using the store slug: `https://<slug>.shopbanao.in/<normalized-path>`.
   - Normalize home, product, and category paths consistently.
   - Ignore query strings for HTML navigations to prevent ad tracking params from fragmenting cache.

2. Make custom-domain reads use the same key as writes
   - On early anonymous HTML navigation, resolve custom domain to store slug using the existing lightweight domain lookup.
   - Check the canonical slug-subdomain key first.
   - Fall back to existing real-host/request lookups for safety during rollout.

3. Make custom-domain writes store under both safe keys
   - Continue writing the current host key for compatibility.
   - Also write the canonical slug-subdomain key so custom domains and subdomains share the same cached HTML.
   - Keep checkout/admin/dashboard/API excluded.

4. Improve diagnostics
   - Bump Worker version to `8.25.2-custom-domain-zone-key`.
   - Add a small diagnostic header on HIT showing whether the cache was found by canonical key or fallback key.
   - Keep existing `x-edge-cache: HIT-EARLY` behavior.

5. Validate after deployment
   - Test `serdiyajewellers.shop`, `imitationworld.in`, and `fitness.shopbanao.in`.
   - Test `/`, one `/product/...`, and one `/category/...` path per store where available.
   - Confirm second request returns HIT and timestamp does not change.

## Safety
- Do not cache logged-in, checkout, dashboard, admin, or API responses.
- Do not cache responses with auth/session cookies.
- Do not change database schema or app frontend.
- Only update the Worker reference file; deployment to Cloudflare remains manual.
