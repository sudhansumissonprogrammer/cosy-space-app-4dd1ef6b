# Make the newest checkout address authoritative

## Changes
- Treat each shopper account as having one current delivery address instead of retaining stale older addresses.
- When a shopper saves a changed address, atomically replace the prior saved address and mark the new one current.
- When an order is submitted, continue using the live checkout fields so the dashboard receives exactly what was entered.
- During guest-account linking, replace any old saved address with the address stored on the new order instead of returning the old default.
- Remove duplicate historical saved-address rows, retaining each shopper's most recently created address.

## Safety
- Do not rewrite historical order addresses; each past order remains an immutable delivery snapshot.
- Scope saved addresses to the correct storefront customer and preserve phone/store isolation.
- Add a database function for atomic replacement with owner/service-only access.

## Verification
- Measure duplicate and stale-address patterns before and after cleanup.
- Test returning-customer edit → save → order → dashboard address.
- Verify current-address storage contains one row per shopper and check build/runtime health.
