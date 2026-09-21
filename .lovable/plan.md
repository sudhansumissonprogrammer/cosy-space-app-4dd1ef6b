# Parcel scan phone verification

## Changes
- Keep the optimized, resized parcel-photo upload and tracking-number extraction.
- Also extract only the recipient phone number needed for verification.
- Normalize `+91`, `91`, leading `0`, spaces, and dashes to the final valid Indian 10-digit number.
- Compare it with the order phone number and reject missing, partial, masked, invalid, or different numbers.
- Keep duplicate tracking-number checks, manual shipment confirmation, private saved parcel photos, and WhatsApp behavior unchanged.

## Validation
- Test matching and mismatching phone formats.
- Run type checks, tests, and preview build checks.
- Deploy the parcel scanner after validation.
