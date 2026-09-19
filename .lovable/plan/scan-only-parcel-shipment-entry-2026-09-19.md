# Scan-only parcel shipment entry

## What will change

- Remove manual courier and tracking-number entry when adding a new shipment.
- Show two clear choices: **Take photo** and **Upload from gallery**.
- Send either image through the existing strict parcel-label verification.
- After a successful match, show the detected courier and tracking number as locked details; the owner cannot edit them.
- Keep **Save shipment** as a separate required action. Scanning will never submit or mark an order shipped automatically.
- Keep retrying with another camera photo or gallery image when the label is unclear or belongs to the wrong customer.

## Existing shipments

- Existing shipment tracking details will remain locked.
- Owners can still update shipment status where currently supported, without manually changing the courier or tracking number.

## Safety and verification

- Continue blocking wrong-customer labels, conflicting label details, reused parcel photos, and duplicate tracking numbers.
- Verify camera and gallery flows on mobile-sized screens.
- Confirm no shipment can be saved until a verified scan supplies valid courier and tracking details.
