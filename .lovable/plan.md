# PDP: 3 smart product carousels

Replace the single "Complete the Look" grid on the product page with three horizontal carousels that never repeat a product, load lazily, and paginate as the shopper swipes.

## What the shopper sees

Below the reviews section, in this order:

1. **More in {current category}** — other products from the same category as the open product (e.g. open a Chain product → Chains carousel).
2. **Best sellers** — the store's best-selling products.
3. **You may also like — {other category}** — products from a different category (the next category in the store's category order, wrapping around; if the store has only one category, this carousel is skipped).

Rules:
- No product appears in more than one carousel, and the currently open product never appears at all. Carousel 1 claims its items first, then 2, then 3.
- Each carousel shows ~6 items at a time on desktop (2.2 on mobile, 3–4 on tablet) and loads the next batch automatically as the shopper swipes to the end (infinite scroll inside the carousel), until that category / best-seller pool is exhausted.
- Any carousel with zero remaining products after dedupe is hidden entirely.

## Performance guarantees (no PDP slowdown)

- The whole block stays inside the existing `DeferUntilVisible` (600px rootMargin) + `React.lazy` boundary — nothing loads until the shopper scrolls near it, so LCP/TTI of the PDP is unchanged.
- First data fetch is a single request that pulls one page for all three pools at once, using the existing lightweight `PRODUCT_CARD_FIELDS` selector (~280 bytes/row, no descriptions).
- Further pages fetch only for the carousel being swiped, 12 rows at a time.
- Images use the existing lazy-loading product card; only the first row of each carousel is eagerly decoded.
- React Query caching with a 5-minute staleTime, keyed per store + category, so navigating between PDPs in the same category reuses the data with zero network calls.

## Technical details

- New `src/components/storefront/pdp/PdpCarousels.tsx` — owns the three sections, the dedupe ledger, and shared card style from `useStorefrontThemeConfig`.
- New `src/components/storefront/pdp/PdpProductCarousel.tsx` — a single embla carousel (reusing `@/components/ui/carousel`, same theme-token styling as `BestSellingCarousel`) with `useInfiniteQuery`, an end-sentinel that calls `fetchNextPage`, and a skeleton tile while loading.
- New hook `src/hooks/usePdpCarouselPools.ts`:
  - fetches distinct categories for the store (from `categories`, ordered as the merchant arranged them) to resolve the "other category" target;
  - three `useInfiniteQuery` pools — same-category, `is_best_selling=true`, other-category — each filtered `store_id`, `is_active`, `neq id = current`, page size 12;
  - dedupe applied at render time in priority order 1 → 2 → 3, so pagination in an earlier carousel can't duplicate into a later one.
- `RelatedProducts.tsx` is retired from `src/pages/ProductDetail.tsx` and `src/pages/V22ProductDetail.tsx`; both mount `PdpCarousels` with the same props (store, slug, current product id, current category). The file stays in place unused-safe or is deleted if no other importer exists.
- Reuses `UniversalProductCard` + `VariantCountProvider` so pricing, badges, wishlist and add-to-cart behaviour are identical to today.
