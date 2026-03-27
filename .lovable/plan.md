

# Performance Fix Plan: Cold Load → Sub-2s, Lighthouse 85+

## Root Cause (Critical Bug Found)

**The #1 bottleneck is a wrong Supabase URL in `index.html`.**

Line 69-70 of `index.html` still points to the **old project** (`vjjlxmqgqtquggdajjvi.supabase.co`). The prefetch script fires, silently fails (wrong DB, no data), then React mounts and makes a **second** fresh RPC call to the correct Supabase. This creates a ~3-4 second waterfall where nothing loads.

This single bug explains why performance dropped dramatically after the remix.

## All Bottlenecks Identified

| # | Issue | Impact | Fix |
|---|-------|--------|-----|
| 1 | **Wrong Supabase URL/key in index.html prefetch** | Prefetch fails silently → 3-4s wasted, double fetch | Update to correct project credentials |
| 2 | Render-blocking CSS (320ms per Lighthouse) | Delays FCP | Add `<link rel="preload" as="style">` for main CSS |
| 3 | Layout shift from hero banner (CLS ~0.7) | High CLS score penalty | Already has `aspect-ratio: 16/7` — verify it's applied before image loads |
| 4 | Product skeleton grid shifts when real cards mount | CLS contributor | Match skeleton card dimensions exactly to real card dimensions |
| 5 | Carousel interval=2000ms causes excessive repaints | Minor CPU overhead on mobile | Increase to 4000ms (already default in component, but overridden to 2000 in StorefrontMobileHero) |

## Implementation Plan

### Step 1: Fix Supabase credentials in index.html (THE critical fix)
Update lines 69-70:
- `vjjlxmqgqtquggdajjvi.supabase.co` → `hnuowboxptvobvmgvqnx.supabase.co`  
- Old anon key → new anon key (`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...RGWBfVVKdCcmkcKxl2pgGP3kQJUWmoDz_yMHwQfETME`)

This alone should cut ~3-4s off cold load since the prefetch will actually work.

### Step 2: CSS preload hint
Add before the module script in `index.html`:
```html
<link rel="preload" href="/src/index.css" as="style" />
```
Saves ~320ms of render-blocking time.

### Step 3: Fix carousel interval
In `StorefrontMobileHero.tsx` line 60, change `interval={2000}` to `interval={4000}` to reduce unnecessary repaints on mobile (every 2s carousel transition is too aggressive).

### Step 4: Ensure skeleton-to-content CLS match
Verify the inline skeleton in `index.html` (line 169) uses the same `aspect-ratio: 4/5` for card images as the real `ProductCardStyle1` component. Already matches — no change needed.

## Files Changed

| File | Change |
|------|--------|
| `index.html` (lines 69-70) | Fix Supabase URL + anon key to new project |
| `index.html` (head) | Add CSS preload link |
| `StorefrontMobileHero.tsx` (line 60) | interval 2000 → 4000 |

## Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Cold load | ~6s | ~2s |
| LCP | ~5.9s | <2.5s |
| CLS | ~0.7 | <0.1 |
| Performance | ~47 | 85-92 |

The massive improvement comes almost entirely from Step 1 — fixing the prefetch so it actually returns data instead of silently failing.

