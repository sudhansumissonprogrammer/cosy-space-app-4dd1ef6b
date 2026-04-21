

## Add Themed Category Strips + "View All" Card to Theme 19 & 20

For each per-category carousel on the Theme 19 / Theme 20 home page, add a colorful header strip (matching the active theme color) and limit each carousel to 8 products + a 9th "View All" tile that links to the category page.

### What changes visually

For every category section under the Categories grid:

1. **Themed header strip** (replaces the current plain `v19-section-title` / `v20-section-title` row)
   - Full-width rounded pill/banner using the storefront primary color as background with a subtle gradient.
   - Left side: category name in bold, in the contrasting button-text color (white on most themes).
   - Right side: a "View all →" pill button that's tappable and routes to `/category/{slug}`.
   - Entire strip is wrapped in a `<Link>` so tapping anywhere on the strip also navigates to that category page.

2. **Carousel content cap**
   - Replace `slice(0, 12)` with `slice(0, 8)` so a maximum of 8 product cards render per category strip.

3. **"View All" tile as 9th card**
   - After the 8 product cards, append a final card the same width/aspect as `V19ProductCard` / `V20ProductCard`.
   - Uses theme primary color background, centered icon (`ArrowRight` / `LayoutGrid`) and text "View all {category name}".
   - Links to the category page; only rendered when there are more than 8 items (or always — see decision below).

```text
[ 🟦 Snacks                                  View all → ]   ← themed strip
[ p1 ][ p2 ][ p3 ][ p4 ][ p5 ][ p6 ][ p7 ][ p8 ][ ➜ All ]   ← carousel
```

### Files to edit

- `src/pages/StorefrontHomeV19.tsx` — update category-section render block (lines ~351-371).
- `src/pages/StorefrontHomeV20.tsx` — same update mirrored for V20.
- `src/index.css` (or inline styles) — add `.v19-cat-strip` / `.v20-cat-strip` styles using `var(--storefront-primary)` and `var(--storefront-btn-text, #fff)` so it auto-matches each store's color scheme.

### Implementation details

- Strip background: `linear-gradient(135deg, var(--storefront-primary) 0%, color-mix(in srgb, var(--storefront-primary) 75%, #000) 100%)` for a subtle depth effect that adapts to any saved theme color.
- Text color: `var(--storefront-btn-text, #ffffff)` (already used elsewhere for buttons on primary).
- "View all" pill: semi-transparent white background (`rgba(255,255,255,0.18)`) with white text and a chevron icon, hover brightens.
- "View all" 9th card: same `flex-shrink-0 snap-start` width classes as product cards so it sits inline in the scroller; uses `aspect-[3/4]` matching product card height with centered content.
- The 9th card is rendered only if the category truly has products to view (always when `items.length > 0`, since the strip already implies there's a destination).

### Decision needed

Should the "View All" 9th card appear:

- **(a)** Always at the end of every carousel (even if the carousel shows fewer than 8 products), OR
- **(b)** Only when the category has more than 8 products (so it's a true "see more" affordance)?

Default in implementation will be **(a)** for consistency unless you say otherwise.

