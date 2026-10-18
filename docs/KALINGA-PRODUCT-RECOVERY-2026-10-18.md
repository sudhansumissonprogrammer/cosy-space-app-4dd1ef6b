# Kalinga product availability audit

## Findings
- The pictured Round Openwork Om Pendant currently resolves correctly; the Maa pendant also opens from its live category card.
- All 69 active Kalinga products resolve to the correct database ID through the public product lookup; none are category-hidden.
- All 69 live category entries returned matching product IDs from the live PDP endpoint (zero failures).
- Reproduced a temporary service failure being converted into a successful empty result by the early route prefetch in App.tsx. The standard PDP then treated that result as unavailable and redirected home. This is a verified shared failure mechanism, not proof of the exact historical cause in the screenshot.
- A cached edge payload with no product previously prevented consulting the fresh product lookup.

## Changes and verification
- Early prefetch now throws both slug and UUID lookup errors instead of caching an empty success.
- Standard and V22 PDPs distinguish lookup errors from successful missing-product responses, defer cached negative edge results to fresh lookups, and offer explicit retry.
- Standard PDP retains the requested URL rather than automatically sending the shopper home.
- Browser test: force product service requests to return 503, confirm retry remains on the PDP URL, restore requests, click Try again, confirm the correct product heading returns.
- 13 targeted tests passed. Preview build passed.
- No products, visibility, category assignments, pricing, orders, payments or tracking settings changed.
- Frontend publication remains required; no automatic deployment was requested.