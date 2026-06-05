## Goal

Add a new **Star** toggle on each product in the dashboard. When ON, that product sits at the **top of its own category page** on the storefront. Independent from the existing **Best Selling** flag (which controls the homepage Best Sellers row). A product can have both, neither, or either — they don't interfere.

Newly added products do **not** displace existing starred ones, because the pin is an explicit flag, not a date.

## Behavior summary

| Flag | Where it affects | Behavior |
|---|---|---|
| `is_best_selling` (existing) | Homepage "Best Sellers" rail | Unchanged |
| `is_category_pinned` (new) | `/category/<slug>` page only | Pinned products show first, in order they were starred (most-recent star on top) |
| Both ON | Homepage + category top | Both behaviors apply, no overlap |

Sort order on category page becomes:
1. `is_category_pinned = true` first, newest-pinned first (via `category_pinned_at DESC`)
2. then existing order: `display_order ASC, created_at DESC, id ASC`

Shop-All page, search, and Best Sellers rail are **not** changed.

## Technical plan

### 1. Database migration

Add two columns to `products`:

```sql
ALTER TABLE public.products
  ADD COLUMN is_category_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN category_pinned_at timestamptz;

CREATE INDEX idx_products_category_pinned
  ON public.products (store_id, category, category_pinned_at DESC)
  WHERE is_category_pinned = true;
```

Update `get_category_page` RPC (DROP-first per overload rule) so the inner `SELECT` orders by:
```
ORDER BY is_category_pinned DESC, category_pinned_at DESC NULLS LAST, display_order ASC, created_at DESC
```
and selects the two new columns.

### 2. Backend / data layer

- `src/hooks/useInfiniteProducts.ts` — extend `PRODUCT_COLUMNS` with `is_category_pinned,category_pinned_at`; in the preview/localhost Supabase branch, add the same ORDER BY chain **only when `category` filter is set** (Shop-All stays as-is).
- `src/hooks/useBestSellingProducts.ts` — no change.

### 3. Cloudflare Worker (`docs/cloudflare-worker-current.js`)

- Add `is_category_pinned,category_pinned_at` to `PRODUCT_COLUMNS` (line 2128).
- In `_fetchProductsFromDb` default sort (line 4655), when `filters.category` is present, prepend pinned ordering:
  ```
  is_category_pinned.desc,category_pinned_at.desc.nullslast,display_order.asc,is_best_selling.desc,created_at.desc,id.asc
  ```
  When no category filter, keep current sort untouched.
- Bump worker version comment; user redeploys manually (per memory).

### 4. Dashboard UI — Products list (`src/pages/ProductsList.tsx`)

- Add a star icon button per row (lucide `Star` / `StarOff`) next to the existing best-selling toggle.
- Click → `UPDATE products SET is_category_pinned = !current, category_pinned_at = (CASE WHEN newValue THEN now() ELSE null END) WHERE id = ?`.
- Optimistic toast: "Pinned to top of {category}" / "Unpinned".
- Disabled with tooltip when the product has no category set ("Assign a category first").

### 5. Dashboard UI — Edit Product page (`src/pages/EditProduct.tsx`) and Create

- Add a labelled switch in the same card as the "Best Selling" toggle: **"Pin to top of category"** with helper text *"Shows this product first on its category page. Independent of Best Selling."*
- Saves alongside other fields; sets `category_pinned_at = now()` when toggled on, `null` when off.

### 6. Cache invalidation

When the star flag is toggled, call the existing `purgeStoreCache` (same path already used by best-selling toggle in ProductsList) so the Worker `/api/products?category=…` and `get_category_page` KV entries refresh.

### 7. Out of scope (explicit)

- No multi-category join table — each product still has one `category`.
- No changes to homepage Best Sellers logic.
- No changes to Shop-All / search ordering.
- No new admin "Pinned manager" page — toggle lives on existing product surfaces.

### Files touched

```text
supabase/migrations/<new>.sql        new column + index + updated RPC
docs/cloudflare-worker-current.js    PRODUCT_COLUMNS + sort branch (manual deploy)
src/hooks/useInfiniteProducts.ts     columns + category-only sort
src/pages/ProductsList.tsx           star toggle button per row
src/pages/EditProduct.tsx            star switch in form
src/pages/CreateProduct.tsx          star switch in form (defaults off)
```

After the migration runs, Supabase types regenerate and the React code can reference the new columns.
