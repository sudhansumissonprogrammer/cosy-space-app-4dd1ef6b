# Always-available, scan-verified RTO

## Outcome
- Show **RTO / Returned to seller** for every order, on mobile and desktop.
- If the order already has an accepted parcel-label scan and tracking number, mark it RTO directly after confirmation.
- Otherwise open the parcel-photo flow, default the courier to India Post, verify the customer and extract the tracking number, then require the seller to press **Mark RTO**.
- Never send WhatsApp, Telegram, or another customer notification when an order is marked RTO.

## Interface changes
- Reuse the shipment dialog in an explicit RTO mode rather than showing an error.
- In RTO mode, require an accepted matching scan and extracted tracking number before enabling the final button.
- Clearly state that RTO sends no customer message and causes no automatic refund.
- Keep ordinary shipping behavior unchanged.

## Safety and backend rules
- Update the protected shipment action so a new verified shipment may be created directly as returned/RTO.
- Require an accepted scan tied to the same store and order, and require its extracted tracking number to exactly match the saved tracking number.
- Keep duplicate-tracking protection and seller ownership checks.
- Update the direct order-status guard to allow RTO from any prior status only when matching accepted scan and tracking evidence already exist.
- Force customer notification off for RTO at the database boundary and keep message functions restricted to shipping/delivery events.

## Verification
- Check direct RTO without evidence opens the scanner and cannot save.
- Check wrong-customer photos remain blocked.
- Check accepted scans prefill India Post/tracking and require a manual final click.
- Check RTO updates both shipment and order status without queueing WhatsApp or Telegram.
- Check existing normal shipment notifications still work.
