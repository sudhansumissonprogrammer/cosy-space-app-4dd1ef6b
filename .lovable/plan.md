## Good news — this is already working exactly as you described

I checked the code and your live data for `serdiyajewellers`. The flow you want is already implemented end-to-end. No code changes are needed.

### How it works today

**1. First Buy Now click (any product)**
- Phone popup appears.
- Customer enters phone → saved to browser (`localStorage`) **AND** a row is inserted into `customer_leads` with that product's name/id.

**2. Same person clicks Buy Now on a different product**
- The popup detects the saved phone and **skips asking again** (no double prompt).
- It still creates a **new lead row** for the new product, so you see the second product in your Leads list too.
- Then sends them straight to checkout.

**3. If they place an order**
- The Leads page fetches every order's `customer_phone` for your store, normalizes to the last 10 digits, and **hides every lead** whose phone matches a non-cancelled order.
- So the moment they order, **all their leads (across every product they viewed) disappear** from the Leads tab.

**4. If the order is cancelled**
- Their leads come back into the list (so you can recover them again via WhatsApp).

### Verification on your live store

I queried your `serdiyajewellers` data — it confirms:
- Leads from phones with status `pending` / `partially_paid` / `confirmed` → correctly hidden.
- Leads from phones with no order yet → correctly shown.
- Leads from phones whose only order is `cancelled` → correctly still shown.

### Nothing to change

No file edits, no database migration, no plan needed. If you're seeing a specific lead that you think *should* be hidden but isn't (or vice versa), tell me the phone number and I'll trace it.