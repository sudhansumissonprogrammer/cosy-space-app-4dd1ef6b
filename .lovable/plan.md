# Parcel photo shipment message and direct 17TRACK link

## What will change

- Keep the verified parcel-label photo available only temporarily after a successful scan.
- When the owner presses **Save shipment**, send the existing approved image shipment message so the customer receives their parcel photo with courier, tracking number, payment summary, and Track Order button.
- Continue requiring the owner to press Save; scanning alone will never send a message or mark an order shipped.
- Change the customer Track Order button to open 17TRACK directly with the tracking number already filled in.
- Use the same prefilled 17TRACK destination for customer-facing tracking links while keeping ShopBanao’s saved tracking timeline available on the order page.

## Privacy and safety

- Store the parcel photo in a dedicated temporary location only after the label passes strict customer matching.
- Tie the temporary photo to the verified store, order, operator, image fingerprint, and tracking number; the browser cannot substitute another photo after verification.
- Never store full OCR text.
- Delete the temporary photo after WhatsApp accepts the message, and also clean up abandoned or failed photos after a short expiry window.
- Never send a photo when the scan is rejected, needs review, belongs to another order, or the owner disables WhatsApp notification.
- Keep existing WhatsApp deduplication so one shipment save cannot send the parcel photo/message multiple times.

## Delivery reliability

- Use the already approved image-header shipment template when a valid temporary parcel photo exists.
- Fall back to the existing approved text-only shipment template if the image is unavailable or expired, so shipping itself is not blocked.
- Preserve retry handling long enough for temporary WhatsApp failures, then remove the photo on final success, final failure, expiry, muted notification, or cancellation.

## Verification

- Test correct-label scan → locked details → Save → one image shipment message.
- Test wrong-customer and unclear labels never upload or send a parcel photo.
- Test repeated Save/retry does not duplicate the customer message.
- Test the WhatsApp Track Order button opens 17TRACK with the exact tracking number prefilled.
- Test expired-photo fallback and confirm no raw parcel photo remains afterward.
