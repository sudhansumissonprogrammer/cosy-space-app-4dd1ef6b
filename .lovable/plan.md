

## CSS & Network Dependency Optimization Plan

### Problem Summary

The current setup has three issues slowing down render:

1. **Duplicate preconnects** — `index.html` has 3 static preconnects (Supabase, Google Fonts x2), and the Worker injects 2-4 more (Supabase again, storage, hero origin, product image origin). That's 5-7 preconnects competing for connections.
2. **Google Fonts in `index.html`** — Two preconnects + a stylesheet for decorative fonts (Alegreya SC, Changa, Montserrat) block connection negotiation even with `media="print"` trick, because the preconnects are eager.
3. **CSS preload missing** — Vite's generated CSS file (`/assets/index-*.css`) is discovered only after the JS module graph is parsed, adding ~200-400ms to render.

### Changes

#### 1. Clean up `index.html` preconnects (remove 3 of 4)

**Remove** these static links since the Worker already injects them dynamically:
- `<link rel="preconnect" href="https://vjjlxmqgqtquggdajjvi.supabase.co" crossorigin />` (Worker injects this)
- `<link rel="preconnect" href="https://fonts.googleapis.com" />` (decorative fonts, not critical)
- `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />` (same)

**Keep only** the font preload (`/fonts/inter-latin.woff2`) which is critical.

Result: storefront pages get only Worker-injected preconnects (targeted to actual image origins). Dashboard pages get zero unnecessary preconnects.

#### 2. Move Google Fonts loading to JS (deferred)

Remove the `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?...">` from `index.html` entirely. These decorative fonts (Alegreya SC, Changa, Montserrat) are only used by storefronts, and the `loadGoogleFonts()` function in `StorefrontShell` already handles this via `requestIdleCallback`. The current setup loads them twice.

#### 3. Add CSS preload injection in Worker

In `fetchAndInjectSlug`, extract the CSS file path from HTML (like we do for JS modulepreloads) and inject a `<link rel="preload" as="style">` hint:

```javascript
// After modulePreloads block, add:
const cssMatch = html.match(/href="(\/assets\/[^"]+\.css)"/);
let cssPreload = "";
if (cssMatch) {
  cssPreload = `<link rel="preload" href="${cssMatch[1]}" as="style" />`;
}
html = html.replace("<head>", `<head>${injection}${lcpPreload}${cssPreload}${modulePreloads}`);
```

This lets the browser fetch CSS in parallel with JS parsing instead of waiting for discovery.

#### 4. Deduplicate Worker preconnects

Currently the Worker injects `preconnect` for Supabase URL AND Supabase storage as separate entries — but they share the same origin (`vjjlxmqgqtquggdajjvi.supabase.co`). Remove the duplicate storage preconnect (lines 453-454).

Also: skip adding hero image preconnect if it's a Supabase URL (already preconnected).

### Files to Edit

| File | Change |
|------|--------|
| `index.html` | Remove 3 preconnects + Google Fonts stylesheet/noscript block |
| `docs/cloudflare-worker-current.js` | Add CSS preload injection, deduplicate Supabase preconnects, skip redundant hero origin preconnect |

### Expected Impact

| Optimization | Savings |
|---|---|
| Remove 3 static preconnects | ~100-150ms (fewer TLS handshakes) |
| Remove duplicate Google Fonts load | ~200-300ms (eliminates render-blocking connection) |
| CSS preload in Worker | ~200-400ms (parallel CSS discovery) |
| Deduplicate Worker preconnects | ~50ms (cleaner connection pool) |
| **Total** | **~500-800ms render improvement** |

### Risks

- **None for FOUC**: Critical above-the-fold styles are already inlined in `index.html`. The CSS preload just makes the full stylesheet arrive sooner.
- **Dashboard unaffected**: Dashboard doesn't go through the Worker, so it keeps working as-is.
- **Google Fonts**: Still loaded for storefronts via `loadGoogleFonts()` in JS. The noscript fallback is removed, but storefronts require JS anyway.

