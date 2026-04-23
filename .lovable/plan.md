

## Phone-Only Instant Login (No Email, No Password, No OTP)

Strip the storefront login UI down to a **single phone-number field**. Enter phone → instantly logged in. If the phone is new, an account is auto-created with that number; if it exists, the user is signed back into the same account (with all past orders, addresses, wishlist intact).

### What changes

**1. `src/pages/StorefrontLogin.tsx` — full rewrite of UI**
- Remove the Email/Password tab entirely.
- Remove the Tabs component (no tabs needed — only one method).
- Remove the "New here? Create an account" link (no separate signup).
- Change copy:
  - Title: **"Continue with Mobile Number"**
  - Description: **"Enter your number to view your orders, addresses & track delivery. No password needed."**
  - Button: **"Continue"**
- Keep one `Input` (10-digit phone) + one submit button.
- Keep client-side rate limiter (`useLoginRateLimit`) — protects against abuse since there's no OTP.
- Keep the existing `phone-login` edge function call exactly as-is (already does account auto-create + session mint).

**2. `src/pages/StorefrontSignup.tsx` — redirect to login**
- Replace the entire signup form with a `<Navigate to={storefrontPath(slug, "login")} replace />` since signup and login are now the same single-step flow.
- Any old links pointing to `/signup` will silently land on the unified phone screen.

**3. No backend changes needed**
- `phone-login` edge function already:
  - Normalizes the phone number.
  - Creates the auth user (`{phone}@phone.guest`) if missing, with `user_type: "customer"`.
  - Creates the `storefront_customers` row (where addresses live).
  - Returns a real Supabase session → instant login.
- Guest checkout (`create-guest-account`) already keys accounts by the same phone scheme, so an order placed during checkout and a later "Sign In" with the same number both resolve to the **same account** — orders, addresses, and profile data merge automatically.

### User flow after change

```text
Storefront → "Sign In" / "My Account"
        │
        ▼
 ┌──────────────────────────────────────┐
 │  Continue with Mobile Number         │
 │  ┌────────────────────────────────┐  │
 │  │ 98XXXXXXXX                     │  │
 │  └────────────────────────────────┘  │
 │  [        Continue        ]          │
 └──────────────────────────────────────┘
        │ (one click, no OTP)
        ▼
   Account page — orders, addresses,
   wishlist all visible, keyed by phone
```

### Notes / trade-offs

- **No verification** = anyone who knows a phone number can access that account's order history and saved addresses. You explicitly chose this for speed/UX. Rate limiting (5 attempts / 5 min) is the only guardrail. We can add WhatsApp OTP later as a one-line toggle without changing the UI shape.
- Existing accounts created via email/password still work in the database — they just can't be logged into from the storefront UI anymore (admin/merchant login is unchanged).
- The phone format is normalized to digits-only, so "+91 98765 43210" and "9876543210" map to the **same account**.

