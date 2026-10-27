# Utkal catalogue and stock audit — 27 October 2026

## Snapshot at 05:57 UTC
- 7,687 total watch catalogue entries; 6,025 publicly visible (includes independent/manual stock).
- 7,298 JD-linked watches: 5,636 in stock and visible; 1,662 out of stock and inactive.
- Supplier sections: men's 6,496 total / 5,223 available; women's 716 / 328 available; luxury 86 / 85 available.
- No supplier stock/visibility contradictions. All 7,298 supplier items have watch categories and supplier-SKU-derived dates.
- Supplier catalogue completeness was not established against a fresh exhaustive supplier listing. Imported totals in sync state are cumulative, not current counts.

## Verified fixes
- Category RPCs now put Utkal recency before pin/display priority, before pagination; all other stores preserve ordering and permissions.
- Every public category RPC sampled up to 40 entries: 74 categories, zero request failures and zero date-order inversions.
- Browser Shop All, Men's Watch and Fossil Watch Men show real newest products first; no runtime exceptions. Screenshots inspected.
- Live `/api/products?sort=newest` and Fossil category API return newest-first.
- App sends `sort=newest` for Utkal Shop All. Worker source mirrors Utkal-only default; its owner-managed rollout remains pending.
- Stock hot targets now filter supplier identity, preserving independent/manual watches. Verified stockouts hide; verified restocks restore visibility. Seven focused rule tests plus eleven existing discovery/category tests pass.

## Import blocker repaired
- At 05:45 UTC the catalogue job logged `idx_products_source_dedup` conflicts, imported zero and stayed at page 483.
- Repair: stable ID-ordered catalogue index; fail closed on index errors; SKU deduplication across listing pages and returned detail identities; bounded pre-insert identity lookup; isolated conflicting inserts rather than rejecting entire batches.
- Newest page of men's, women's and luxury sections is checked during backfill, so older catalogue work does not delay new arrivals.
- No product deletion, title-based merging, price edits, image rewriting, or custom sticker changes.
- Function deployment succeeded. Post-repair scheduled import progress must be checked separately; deployment alone is not proof of a completed import.

## Automatic checks and limitations
- Live source sync enabled. Stock cron every five minutes; catalogue cron every fifteen minutes, both active.
- 05:35 and 05:40 Utkal stock runs verified all 150 targeted watches with no errors. 05:45 verified 139 and skipped 11 failed reads; no unverified quantity was written as zero.
- 150 targets per five minutes across 7,298 supplier watches implies roughly four hours for a full rotation without failures; it is not instant per-product synchronization. Latest oldest sync snapshot was within about five hours, but timestamps can also reflect failed-read backoff, not successful verification.
- No actual supplier stock change/restock was induced. Visibility rules tested, current data reconciled, real stock responses checked through normal scheduled jobs. Exhaustive present-time supplier stock equality remains unverified.
- Existing supplier access constants are embedded in function source; no values included in this report. Credential rotation requires replacement supplier credentials and is outside this catalogue repair.

## Owner-managed rollout
Publish frontend so production Shop All requests explicitly select newest order. Deploy `docs/cloudflare-worker-current.js` so every default Worker product request follows the same Utkal recency contract. Category sorting is already applied in Lovable Cloud; cached category payloads may take time to refresh.

## Live recheck at 06:09–06:11 UTC
- The repaired 06:00 catalogue run imported 155 watches and 221 photos, linked one legacy row, advanced the men's backfill cursor from 483 to 523, and purged the storefront cache. Zero listing errors and no retry page: the duplicate-SKU blocker is no longer holding that run.
- New supplier arrivals dated 05:21 appeared in the 06:00 import and at the top of the real preview Shop All page. Men's, women's, luxury and Sale public category responses have no recency inversions in their first 50 rows.
- The 06:05 stock run verified 150/150 Utkal targets, detected one real stockout, hid it and successfully purged caches. Public product lookup for that exact watch returns `{product:null}`.
- The 06:10 run was throttled: eight verified, 22 failed lookups, remaining batch skipped. This is a real supplier-rate limitation, not an all-clear. Unknown quantities were not converted into stockouts.
- Snapshot: 7,842 total entries; 6,072 visible; 7,448 supplier-linked watches, of which 5,678 available and 1,770 hidden sold-out. Supplier available by section: men's 5,233; women's 336; luxury 109.
- All six owner-stock Sale Hublots remain active, positive-stock and merchant-managed after scheduled stock updates.
- Stockout propagation verified with a real change. Restock visibility passed logic tests, but no real supplier restock occurred in the observed runs. Full supplier equality is still unverified; batches and throttling mean a full stock sweep takes hours, not five minutes.
- Newest page of each watch section runs every 15 minutes. Deeper new arrivals and failed women's/luxury detail fetches can wait for a later section rotation; no immediate delivery guarantee is established.