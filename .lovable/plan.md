# Review visibility, ordering, and approval

## What will change
- Show exactly the first 12 approved reviews on each product page.
- Keep the **View all** link for the complete approved review list.
- Show every approved review in checkout, loaded progressively so checkout stays fast.
- Preserve dashboard featured order everywhere: featured reviews first in rank order, then newest approved reviews.
- Add a clear **Pending approval** section in the store dashboard.
- Reviews submitted by shoppers will enter Pending approval and remain invisible on the storefront until the owner approves them.
- Reviews added directly by the store owner remain visible immediately.

## Safety and performance
- Reuse the existing hidden-review protection, so pending reviews cannot be read publicly.
- Keep review images lazy-loaded and render long lists in batches.
- Increase the shared review-feed capacity so checkout and the full review page are not silently capped at the current small limits.
- Keep ratings and totals based only on approved, visible reviews.

## Technical details
- Storefront submission forms will create reviews as hidden/pending.
- The review dashboard will separate pending, featured, and other approved reviews, with an explicit Approve action.
- The shared review query will consistently sort by `pinned_rank ASC NULLS LAST, created_at DESC`.
- The database review-summary function will retain its signature and gain a higher safe maximum result limit.
- Add focused tests for ordering, 12-review PDP cap, pending visibility, and approval behavior where practical.
