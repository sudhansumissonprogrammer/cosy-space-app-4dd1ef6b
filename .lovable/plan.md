

# Fix: Stores Not Loading (Skeleton-Only / Shimmering)

## Root Cause

The **Service Worker (Workbox)** is the primary culprit. Your `vite.config.ts` has:

```
globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"]
```

This precaches the **bare `index.html`** — the one WITHOUT `__STORE_SLUG__` or `__STOREFRONT_DATA__`. When a user visits any storefront, the SW intercepts the navigation request and serves this cached bare HTML instead of the Cloudflare Worker's injected version. The SPA then has no store context → falls through to login or shows skeleton forever.

This is why **incognito works** (no SW) but **normal browsing doesn't** (SW active).

Secondary issue: `src/lib/subdomain.ts` returns `null` for custom domains (not `.storivo.in`), so if `__STORE_SLUG__` is missing, the app routes to auth/login instead of storefront.

---

## Plan (4 changes)

### 1. Fix Service Worker Config — Stop Precaching HTML

**File: `vite.config.ts`**

- Change `globPatterns` from `"**/*.{js,css,html,ico,png,svg,woff2}"` to `"**/*.{js,css,ico,png,svg,woff2}"` (remove `html`)
- Add `navigateFallback: null` to the workbox config so it never serves a fallback HTML for navigation requests
- Add a `NetworkFirst` runtime caching rule for navigation requests (document type), so the browser always tries the network first (getting the Worker-injected HTML), with cache fallback only for offline

### 2. Force-Unregister Old Service Workers

**File: `src/main.tsx`**

- Before registering the new SW, add cleanup logic that checks if a stored SW is serving stale HTML
- On storefront routes (custom domains / subdomains), if `__STORE_SLUG__` is missing and an SW is active, unregister it and reload once to get fresh Worker-injected HTML
- Use a `sessionStorage` flag to prevent infinite reload loops

### 3. Custom Domain Fallback in App Router

**File: `src/App.tsx`**

- In `AppRouter()`, add detection for custom domains: if hostname is not `*.lovable.app`, not `*.storivo.in`, not `localhost`, and `getSubdomainSlug()` returns `null` — this is a custom domain where slug injection failed
- Instead of falling through to `LazyAuthRoutes` (login page), show a loading state and attempt to resolve the store by fetching from the database using the hostname
- This acts as a safety net when the Worker injection or SW cache fails

### 4. Worker: Reduce Stale Cache Duration

**File: `docs/cloudflare-worker-current.js`**

- In `proxyToOrigin()`, reduce `stale-while-revalidate` from `86400` (24h) to `3600` (1h) for HTML responses
- In `fetchAndInjectSlug()`, set explicit `Cache-Control: public, max-age=120, stale-while-revalidate=3600` on the returned Response (shorter than raw proxy)
- Add `X-Store-Slug` header to injected HTML responses for debugging

**After deploying**: Purge Cloudflare cache ("Purge Everything") to clear stale bare HTML.

