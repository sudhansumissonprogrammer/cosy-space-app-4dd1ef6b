## Goal

The Leads page should only show people who entered their phone number (Buy Now popup / WhatsApp order intent) but **did NOT complete a successful order**. People who already placed an order must not appear here at all — they belong in Orders, not Leads.

## Changes (single file: `src/pages/CustomerLeads.tsx`)

1. **Remove the "Pending / All" toggle** at the top right of the Leads card. Always filter to "not yet ordered" only.
2. **Remove the "Status" column** from the desktop table (no more "Pending / Ordered" badge — every row is pending by definition).
3. **Remove the green "Ordered" badge** from the mobile card view.
4. **Update the header copy** to say `{N} Leads` only — drop the `(X already ordered, hidden)` hint since converted leads are no longer tracked here.
5. **Keep the underlying `orderedPhonesSet` query** — still needed to filter out anyone whose phone matches a non-cancelled order in the `orders` table.
6. **Subtitle stays**: "People who showed interest but haven't placed an order yet — recover them via WhatsApp" (already accurate).

## Filtering logic (unchanged, just always-on)

A lead is hidden if its phone (last 10 digits, normalized) matches the `customer_phone` of any order in the `orders` table for this store with `status != 'cancelled'`. Everything else stays visible — including users who opened the phone popup, dropped off at checkout, or have a cancelled order.

## Out of scope

- No new "Confirmed Orders" section — confirmed orders already live under the **Orders** menu. Duplicating them inside Leads would be confusing.
- No DB / RLS / edge function changes.
- WhatsApp recovery message, delete action, product deep-links — all unchanged.