# Parcel-label scan and verified shipment entry

## What will be built

Add a **Scan parcel label** option to the shipment window in each order. The store owner can photograph the courier label instead of typing the tracking number.

The flow will:
1. Open the phone camera and capture the real parcel label.
2. Read the barcode/QR code when present, plus the printed tracking number, courier, recipient name, phone, PIN code, address clues, order reference, and payable amount from the photo.
3. Compare those details with the order currently open in the dashboard.
4. Prefill the courier and tracking number only when the label is a safe match.
5. Block saving and show **Wrong parcel — this label does not match this customer** when important details conflict.
6. Ask for a clearer photo when the label is unreadable, cropped, blurred, or has too little evidence.
7. Keep the existing final Save shipment step, WhatsApp choice, shipment history, and tracking refresh behavior.

## Matching and safety rules

- The customer name must match after safe normalization; a clear different name is always rejected.
- An exact phone match is strong evidence; masked phone numbers may contribute partial evidence but cannot pass alone.
- A different six-digit PIN code is always rejected.
- A printed order number/reference, when present, must match the open order.
- A printed COD/payable amount, when present, must match the order balance within a small rounding tolerance.
- If the same customer has multiple open orders, name/address alone is treated as ambiguous; the scan must also match an order reference or payable amount.
- Barcode and printed tracking values must agree when both are readable. A conflict is rejected instead of guessing.
- The same label image or tracking number cannot be attached to another order in the same store.
- Low-confidence results never mark an order shipped and never notify the customer.

## Store-owner experience

- Add a camera button beside the tracking-number field.
- Show simple stages: **Reading label → Checking customer → Ready to use**.
- Show matched details and any mismatch in a compact comparison.
- On success, fill the courier and tracking number while leaving the owner in control of the final Save shipment button.
- Keep manual entry available as a fallback.

## Technical details

- Create an authenticated `parcel-label-scan` function that derives the store and owner from the open order; it will never trust a store ID from the browser.
- Use barcode detection in the browser for immediate feedback, then independently inspect the image server-side with Lovable AI vision using `openai/gpt-6-astra`.
- Validate and normalize all extracted values server-side before matching.
- Add a private, owner-scoped scan-audit table containing the image fingerprint, masked extraction evidence, decision, confidence, order, store, and operator. Raw label photos and full OCR text will not be retained after analysis.
- Add replay and duplicate-AWB checks before allowing the prefill.
- Keep `store_upsert_shipment` as the only final shipment writer so existing ownership, AWB validation, status history, and notification safeguards remain authoritative.
- Add bounded abuse protection and preserve safe AI error messages; failed scans never alter orders.

## Verification

- Test correct labels, wrong names, wrong PINs, wrong phones, mismatched order references, duplicate photos, reused tracking IDs, masked phones, repeat-customer orders, unreadable photos, barcode/text conflicts, and AI service failures.
- Verify on mobile camera capture and desktop file capture.
- Confirm no scan can mark an order shipped before the owner presses Save shipment.
- Confirm customer-facing tracking never exposes the label photo or scan evidence.

## Also completed

Telegram was freshly connected in the new workspace and the order-alert service was redeployed.
