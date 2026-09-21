# Fix seven storefront and operations findings

## Goal
Remove the confirmed permission failures and interaction regressions without exposing private product data, weakening parcel-customer verification, sending extra WhatsApp messages, or changing payment/refund behavior.

## Changes

1. **Logged-out product listings**
   - Restore anonymous read access only to the public storefront columns already consumed by product cards, recommendations, category pages, bundles, and storefront hooks.
   - Keep private fields such as product cost excluded.
   - Preserve the existing active-product/store isolation policies and verify the affected logged-out queries.

2. **QR parcel labels and safe tracking fallback**
   - Treat browser-detected QR/barcode content as an untrusted hint, not a conflicting source that can reject an otherwise valid label.
   - Continue requiring an exact normalized 10-digit customer-phone match from the label.
   - If the phone matches but tracking extraction is unclear, allow the owner to correct the tracking number; validate and bind that correction server-side to the phone-matched scan before shipment save.
   - Never auto-submit a shipment.

3. **Payments settings permission**
   - Grant store owners read access to the single `checkout_otp_enabled` setting added after the restricted stores-column grant.
   - Do not broaden access to payment credentials or private store settings.

4. **Category collage duplicates**
   - Render only unique available product/category images.
   - Use the normal single-image presentation when there are not enough unique images for a useful collage, rather than repeating one photo to fill four slots.
   - Keep the existing tile size and lazy-loading behavior.

5. **Older shipment RTO updates**
   - Permit an already-shipped order with a valid saved tracking number to move to RTO without demanding a new parcel scan.
   - For orders without saved tracking, retain the phone-matched parcel-scan requirement and open the scanner flow.
   - Keep RTO customer messaging off and keep all payment/platform-fee refunds manual.

6. **Review text overlap**
   - Keep the reviewer/name/stars caption inside the media area so it cannot cover the separate full review text below.
   - Verify the checkout review card in short and long-text cases on mobile and desktop.

7. **Saved-address fallback**
   - Separate address/profile creation from optional guest-session minting.
   - If session minting is temporarily unavailable, return the saved address payload successfully so checkout can still fill it; authentication may retry separately.
   - Preserve existing ownership and phone checks.

## Technical details
- Apply database permission and RTO-rule changes through one reviewed migration, including explicit grants.
- Update the parcel scan function and shipment dialog together so manual correction cannot bypass phone verification.
- Update only the affected storefront components and guest-account function.
- Deploy changed cloud functions after source changes.

## Verification
- Test logged-out product recommendations/listings and authenticated Payments settings.
- Exercise parcel scans with a normal barcode, QR payload, mismatched phone, missing phone, and phone-matched/manual tracking correction.
- Test RTO for an older tracked shipment and an untracked order.
- Check category tiles with 1, 2, 3, and 4 unique images.
- Check checkout review cards for overlap at mobile and desktop widths.
- Simulate session-mint failure and confirm the entered address remains available.
- Run focused tests, inspect current build status, run the database linter, and resolve all seven monitoring findings only after verification.
