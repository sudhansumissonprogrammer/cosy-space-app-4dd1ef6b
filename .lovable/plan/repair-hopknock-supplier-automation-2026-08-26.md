# Repair HopKnock supplier automation

## Scope
- Keep HopKnock connected only to `thewristlife.cartpe.in`.
- Restore full catalog, new-product, stock-out, back-in-stock, and price synchronization.
- Preserve manually imported special collections that are intentionally outside the supplier feed.

## Fix
1. Update the stock sync selection so only Cartpe products with a valid supplier path can occupy the rotating batch. This removes the starvation caused by 366 legacy JD rows.
2. Mark those 366 wrong-supplier legacy rows unavailable (`stock = 0`, inactive) rather than hard-deleting them, preventing accidental sales without cascading media/review deletion.
3. Deploy both Cartpe sync functions and trigger fresh catalog and stock runs.
4. Verify the live connection, cron schedules, recent function results, products checked per batch, newest imports, stock-out transitions, and supplier-path coverage.

## Safety
- Supplier request failures never change stock.
- Confirmed supplier 404/410 or explicit sold-out status becomes unavailable; rows are not deleted.
- HopKnock is scoped by immutable store ID and Cartpe source metadata.
- Special manually imported products from other named sources remain untouched.
