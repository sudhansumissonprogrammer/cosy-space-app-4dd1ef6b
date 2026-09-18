# Restore trustworthy Serdiya shipment tracking

## Goal
Make the dashboard and customer order page accurately show whether India Post tracking is live, stale, or temporarily unavailable, without presenting seller-entered statuses as courier-confirmed scans.

## Changes
- Correct India Post's client capability so active shipments can request the existing backend refresh path.
- Return and display tracking availability and last-error information in the shipment snapshot.
- Keep the last valid courier scans visible when India Post blocks a new lookup, while clearly marking them as stale.
- Add a direct official India Post tracking action for manual CAPTCHA verification instead of sending customers to a generic aggregator.
- Make refresh failures informative rather than reporting a generic courier error.
- Add regression coverage for CAPTCHA/unavailable responses, stale cached scans, and status/source labelling.

## Data safety
- Do not rewrite shipment or order statuses from an unsuccessful carrier lookup.
- Do not auto-refund or cancel any order.
- Preserve all existing scan history and customer details.
- Flag duplicate tracking numbers and order/shipment mismatches separately for owner review; do not merge or delete records automatically.

## Technical details
- Update the shipment RPC response if needed to include `last_error`, then extend the frontend tracking type and timeline state.
- Treat India Post as refresh-capable because the backend has a public-feed adapter, but expose provider outages as an unavailable state.
- Use the official India Post tracking page as the fallback destination.
- Deploy the tracking function only if backend response behavior changes.
