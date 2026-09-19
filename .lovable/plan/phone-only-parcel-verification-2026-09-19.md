# Phone-only parcel verification

## What will change
- Verify parcel ownership only by the phone number visible on the label against the order’s dashboard phone number.
- Normalize both numbers to the final valid 10-digit Indian mobile number, so `+91`, `91`, `0`, spaces, and punctuation compare consistently.
- Require both sides to produce a valid 10-digit number starting with 6–9; missing, masked, partial, or different numbers will not pass.
- Stop using recipient name, PIN code, address, order reference, or payable amount to accept or reject the parcel.

## What remains unchanged
- Continue extracting the courier and tracking number from the label.
- Keep barcode/printed-AWB consistency checks, duplicate-photo protection, duplicate-tracking protection, temporary-photo handling, and manual Save shipment.
- Never auto-submit a shipment or retain full OCR text.

## Interface
- Update scanner messages to say that the phone number must be clearly visible and matched.
- A matching phone prepares the tracking details; a missing or different phone blocks the scan.

## Verification
- Test matching forms such as `9876543210`, `919876543210`, `+91 98765 43210`, and `09876543210`.
- Test mismatched, masked, short, landline-like, and unreadable numbers.
- Confirm name, address, PIN, and amount differences no longer affect parcel ownership verification.
