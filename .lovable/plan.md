# Fix and refresh order invoices

## What will change
- Fix the partial-payment totals so “Balance Due (COD)” and its amount always have separate, non-overlapping columns in the preview, printed label, downloaded PDF, and WhatsApp PDF.
- Replace the cramped totals block with a wider, stable two-column layout and slightly clearer spacing while preserving the 4×6 invoice size.
- Refresh the invoice typography and hierarchy using an embedded local font where PDF support is reliable, with a safe fallback so Indian currency and customer text remain readable.
- Repair product-image loading by using the image saved on the order first, then the linked product image as a fallback, normalizing image formats for the PDF, and leaving a clean placeholder when an image cannot be fetched.
- Ensure the order detail fetch supplies the required image data to every invoice action.

## Validation
- Generate a partial-payment invoice with a long COD amount and confirm no text overlaps.
- Confirm product photos appear in the invoice preview and generated PDF when an accessible image exists.
- Check a multi-item invoice still fits and remains readable at the 100×150 mm print size.
- Confirm the app build remains healthy.

## Technical details
- Keep invoice calculations and payment behavior unchanged.
- Apply the same layout rules to `OrderInvoice` print markup and the shared PDF generator so print, download, and WhatsApp output stay consistent.
- Use local assets only; no runtime font dependency will be added to PDF generation.
