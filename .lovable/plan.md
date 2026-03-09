

## Why Your Storefront is Slow to Load

The slow load is caused by several factors working together:

1. **Google Fonts blocking render** — `@import url('https://fonts.googleapis.com/css2?family=Alegreya+SC...')` in `index.css` is a render-blocking request. The browser must download this CSS before painting anything.

2. **Waterfall of sequential requests** — The page loads in a chain: HTML → JS bundle → Supabase store query → then products query + categories query. Each step waits for the previous one.

3. **Track-view edge function fires on every load** — The `track-view` fetch in `StorefrontLayout` adds a network request that, while async, competes for bandwidth on initial load.

4. **Product images load eagerly on viewport** — All product card images within the grid load as the page renders (they have `loading="lazy"` which helps, but the initial visible ones still load immediately).

## Plan

### 1. Move Google Fonts to `<link>` with preconnect in `index.html`
Replace the `@import` in CSS with `<link rel="preconnect">` and `<link rel="stylesheet">` tags in `index.html`. This allows the browser to start fetching the font much earlier and in parallel with other resources, rather than blocking render.

### 2. Add `staleTime` to storefront queries
Set `staleTime: 5 * 60 * 1000` (5 minutes) on the store, products, and categories queries so repeat visits / navigations don't re-fetch data. Currently every navigation re-fetches from scratch.

### 3. Defer the track-view call
Wrap the `track-view` fetch in a `setTimeout(..., 2000)` or use `requestIdleCallback` so it doesn't compete with critical data fetching on initial load.

### 4. Add `font-display: swap` to the Google Fonts URL
Append `&display=swap` to the Google Fonts URL so text renders immediately with a fallback font instead of waiting for the custom font to download.

### Files to change:
- **`index.html`** — Add `<link rel="preconnect">` for Google Fonts + `<link rel="stylesheet">` with `display=swap`
- **`src/index.css`** — Remove the `@import` line for Google Fonts
- **`src/layouts/StorefrontLayout.tsx`** — Add `staleTime` to store query; defer `track-view` call
- **`src/pages/StorefrontHome.tsx`** — Add `staleTime` to products and categories queries

