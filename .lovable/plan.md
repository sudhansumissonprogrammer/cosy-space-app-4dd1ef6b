

## Plan: Bulk CSV Upload & Custom Domain Configuration

### 1. Bulk Product Upload via CSV

**New page**: `src/pages/BulkUpload.tsx` — accessible from the Products list page for each store.

**How it works**:
- User uploads a CSV file with columns: `name`, `price`, `sale_price`, `description`, `category`, `stock_quantity`, `sku`
- Client-side CSV parsing (no library needed — use native `FileReader` + split logic)
- Preview parsed rows in a table before confirming
- On confirm, batch insert products into the `products` table with the store's `storeId`
- Auto-generate slugs from product names
- Respect product limit via `check_product_limit` RPC
- Show success/error summary (e.g., "15 of 20 products uploaded")
- Provide a downloadable CSV template

**Route**: `/dashboard/stores/:storeId/products/bulk-upload`

**UI additions**:
- Add an "Import CSV" button on the `ProductsList` page next to "Add Product"

### 2. Custom Domain Configuration

**New page**: `src/pages/StoreDomain.tsx` — accessible from store settings or as a separate page.

**How it works**:
- This is an **informational/instructional UI** since actual domain provisioning happens through Lovable's platform
- Show the store's current storefront URL (`/store/:slug`)
- Display step-by-step instructions for connecting a custom domain:
  1. Add A records pointing to `185.158.133.1`
  2. Add TXT record for verification
  3. Add both root and www subdomain
- Store the custom domain value in a new `custom_domain` column on the `stores` table
- Display domain status (pending verification, active, etc.)

**Database migration**: Add `custom_domain` text column to `stores` table.

**Route**: `/dashboard/stores/:storeId/domain`

**UI additions**:
- Add a "Domain" link/card in Store Settings page or as a sidebar item for the store

### Files to Create/Edit

| File | Action |
|------|--------|
| `src/pages/BulkUpload.tsx` | Create — CSV upload page with preview table |
| `src/pages/StoreDomain.tsx` | Create — Domain configuration page |
| `src/pages/ProductsList.tsx` | Edit — Add "Import CSV" button |
| `src/pages/StoreSettings.tsx` | Edit — Add link to domain settings |
| `src/App.tsx` | Edit — Add two new routes |
| DB migration | Add `custom_domain` column to `stores` |

### Technical Details

**CSV Parsing** (client-side):
```
FileReader → text → split by newlines → split by comma → map to product objects → validate required fields → batch insert via supabase.from("products").insert([...])
```

**Slug generation**: lowercase name, replace spaces with hyphens, remove special chars, append random suffix if duplicate.

**Product limit check**: Before inserting, call `check_product_limit` and only insert up to the remaining allowance.

**Domain column migration**:
```sql
ALTER TABLE public.stores ADD COLUMN custom_domain text;
```

