# Flipkart-style Search for Storefronts

## What's there today
- The search overlay (`StorefrontSearchOverlay`) queries the DB with a plain `ILIKE %text%` on name/category/description, capped at 30 rows, and only shows a dropdown list.
- Pressing Enter / "Go" does nothing — there is no search results page, so a shopper cannot see all matching products as a full product grid.
- No typo tolerance: "sadi" will not find "Saree", "gold rng" finds nothing (multi-word queries fail because ILIKE needs the exact phrase).
- No relevance ranking: results come back best-seller/newest first, not by how well they match the words typed.

## What we will build

### 1. A real search results page
- New route `/search?q=...` rendering the same product-card grid used on Shop/Category (same card, same add-to-cart, wishlist, badges).
- Enter key, the search icon, and "View all results" in the dropdown all navigate here.
- Header: "Showing results for **saree**" + result count; filters (price range, category, in-stock) and sort (relevance, price low→high, high→low, newest) like Flipkart.
- Infinite scroll / load-more, same pattern as Shop.
- Empty state: "No results for X" plus "Did you mean …" suggestion and a fallback grid of related/best-selling products, so the page is never a dead end.

### 2. Matching engine (the core of the request)
A single Postgres search function (`search_products`) replaces the ILIKE query. Layers, applied in order and merged by score:

1. **Exact / phrase match** — full query appears in the name → top score.
2. **Word-by-word match (AND)** — "gold ring 2 gram" matches products containing all words in any order, across name + category + description + SKU.
3. **Prefix match** — "necklac" or "ear" matches "Necklace", "Earrings" while typing (half-typed words work).
4. **Typo tolerance (fuzzy)** — trigram similarity so "sarre", "brasslet", "jwellery" still hit "Saree", "Bracelet", "Jewellery". Threshold tuned so 1–2 letter mistakes match, unrelated words don't.
5. **Synonyms / Indian spelling map** — a small curated list (saree/sari/sadi, jhumka/jhumki, chain/chein, watch/ghadi, kada/kada, bangle/chudi, anklet/payal, etc.) expanded at query time.
6. **Relevance ranking** — score = match quality (exact > prefix > fuzzy) + field weight (name > category > SKU > description) + business boost (in-stock, best-seller, has image, recent orders). Ties broken by popularity.
7. **Similar-title grouping** — products whose titles are near-duplicates of a matched product are pulled in too, so a search that hits one variant surfaces the whole family.

### 3. Smarter search bar (autosuggest)
- Suggestions now come from the same ranked engine, with product thumbnail + price (as today) **plus** keyword and category suggestions ("saree in Sarees", "under ₹999") above the products, Flipkart-style.
- Recent searches (stored locally) and trending searches (most-searched terms from our existing `storefront_events`) shown when the box is empty.
- Debounced, keyboard navigable (arrow keys + Enter), and "See all results for X" as the last row.

### 4. Analytics already in place
Existing `search_performed` / `search_no_results` events keep firing, now also from the results page — so the merchant dashboard can later show "top searches with no results" (products to add).

## Also possible later (Flipkart parity) — not in this pass unless you want it
- Filter facets computed from the result set (brand/category/price buckets with counts).
- "Sponsored"/promoted product slots in search results.
- Query autocomplete learned from real store searches instead of a static synonym list.
- Multi-language (Hinglish → Hindi) query handling.
- Semantic/AI vector search for descriptive queries ("gift for wife under 1000").

## Technical notes
- Enable `pg_trgm` and `unaccent` extensions; add a generated `search_tsv` (weighted tsvector: name A, category B, sku C, description D) column on `products` plus a GIN index, and a GIN trgm index on `name`. This keeps 15k+ product stores fast.
- `search_products(p_store_id, p_query, p_limit, p_offset, p_sort, p_min_price, p_max_price, p_category)` — `SECURITY DEFINER`, filtered to `is_active = true`, returns card fields only (reuse `PRODUCT_CARD_FIELDS`).
- Follow the DROP-FIRST rule for the RPC signature; grant `execute` to `anon` and `authenticated`.
- Client: new `useProductSearch` hook (React Query, debounced, infinite) used by both the overlay and the results page; synonym map lives in `src/lib/searchSynonyms.ts` so it can be edited without a migration.
- No Worker/edge changes required in this pass; search hits the RPC directly (cacheable at the edge later if volume grows).
