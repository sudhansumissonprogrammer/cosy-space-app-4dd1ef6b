# Fix checkout loading and payment glitches

## Goal
Make the mobile checkout move smoothly from verified phone and address to payment, without a blank screen, faded controls, endless “Updating amount…”, or a dead first tap.

## Changes
- Show a stable payment-loading card immediately instead of leaving a large blank area while payment settings load.
- Separate initial payment-settings loading from amount re-syncing so the checkout does not display misleading or permanent spinners.
- Harden the payment intent lifecycle with bounded recovery: clear stale loading states, preserve queued taps, and expose a retry when payment preparation fails.
- Prevent repeated amount/order preparation caused by address debounce and initial settings arriving at different times.
- Keep partial COD, prepaid discount, coupon, order-idempotency, and PayU verification safeguards unchanged.

## Verification
- Reproduce the phone → address → payment sequence at a mobile viewport with delayed requests.
- Test partial COD ↔ prepaid switching, rapid payment-app taps, and a failed/slow intent response.
- Confirm no layout jump, blank payment area, blocked tap, duplicate order preparation, or endless spinner.
- Check the project build signal and focused checkout tests.

## Technical details
- Limit changes to checkout presentation/state code and focused tests unless a confirmed server-side fault requires a matching payment-function fix.
- Retain the existing server-authoritative totals and one-order-per-checkout-token behavior.
