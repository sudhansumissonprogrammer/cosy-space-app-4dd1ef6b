# Reorder Telegram order alert

## Changes
- Remove the order number from the first order-details message.
- Keep all product photos immediately after the details, including multi-photo albums.
- Send the dashboard-matching order number as a separate final message after every photo finishes.
- Preserve multi-group delivery and failure isolation.

## Verification
- Deploy the updated Telegram notification function.
- Confirm the function deploys successfully and retains the correct `+1000` dashboard order-number display.
