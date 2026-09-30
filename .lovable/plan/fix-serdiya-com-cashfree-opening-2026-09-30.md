# Fix Serdiya.com Cashfree opening

## Goal
Make the existing **Pay with Cashfree** button reliably open payment on Serdiya.com without changing Serdiya Jewellers or other stores.

## Changes
- Keep the current order creation, amount validation, and Cashfree session creation unchanged.
- For Serdiya.com only, open Cashfree in the current page instead of a delayed modal, avoiding mobile and in-app browser popup blocking.
- Preserve the checkout return URL so successful, failed, and cancelled payments return to the same order.
- Leave every other store on its existing Cashfree behavior.

## Verification
- Confirm the Serdiya.com button reaches Cashfree on mobile and desktop.
- Confirm the payment amount/order remain correct and no test payment is completed.
- Check the preview build and browser errors.

## Technical detail
Use Cashfree SDK `redirectTarget: "_self"` only for store `04010cad-1cbe-40ac-b818-07d9a79c1bf7`; retain `_modal` elsewhere.
