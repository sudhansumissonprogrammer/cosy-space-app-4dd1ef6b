

## Plan: Add "Express Delivery in 3 Days" to Product Detail Page

**What:** Add an "Express Delivery" badge/row in the Delivery & Trust Badges section, between "Free Delivery" and "Easy Returns".

**Changes in `src/pages/ProductDetail.tsx`:**

1. Add a new row after the "Free Delivery" row (after line 591) with:
   - A `Clock` icon (already imported) in a green-tinted background circle
   - Bold text: "Express Delivery"  
   - Subtext: "Get it in just 3 days! 🚀"

The new entry will follow the exact same layout pattern as the existing trust badge rows (icon container + text block).

