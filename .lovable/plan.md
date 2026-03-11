

## Plan: Enforce Single Store Per Account (Shopify-style)

### Problem
The current system allows creating multiple stores per account. You have two stores on one account, which shouldn't be possible. The "Overlay Snow" store needs to be deleted, and the system needs to enforce a one-store-per-account limit.

### Step 1: Delete the "Overlay Snow" store data
Use the database tools to delete the Overlay Snow store and all its associated products and categories.

### Step 2: Enforce single-store logic in CreateStore page
- Add a check at the top of `CreateStore.tsx` that queries for existing stores
- If a store already exists, redirect the user to their dashboard instead of showing the create form
- Show a toast message: "You already have a store"

### Step 3: Simplify StoresList → remove multi-store UI
- Replace `StoresList.tsx` with a redirect: if user has a store, go to store dashboard; if not, go to create store
- Remove the grid layout showing multiple store cards
- The sidebar already handles single-store navigation correctly (it fetches `.limit(1).maybeSingle()`)

### Step 4: Update Dashboard to use single store
- Change `Dashboard.tsx` query from fetching multiple stores to fetching a single store (`.maybeSingle()`)
- Simplify the stats queries to use a single `store_id` instead of an array

### Step 5: Update routing
- Make `/dashboard/stores` redirect to the store management area directly (or to create if no store exists)
- Remove the "stores list" concept from the route structure

### Files to modify
- `src/pages/CreateStore.tsx` — add existing-store guard
- `src/pages/StoresList.tsx` — replace with single-store redirect logic
- `src/pages/Dashboard.tsx` — simplify to single store

