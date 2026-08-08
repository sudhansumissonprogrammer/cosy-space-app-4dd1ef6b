# WhatsApp OTP verification for merchant signup

Replace the email verification link with a WhatsApp OTP so creating a store is instant, while still collecting both email and mobile and allowing login with either.

## Findings from the deep check (current state)

- Merchant signup (`src/pages/Signup.tsx`) creates an account with email + password and then waits for the email confirmation link. That link is the current bottleneck (delays, spam folder, new sender domain reputation).
- Customer-side phone auth already works without OTP: `phone-login` maps a 10-digit Indian number to a synthetic auth user `<digits>@phone.guest` and mints a session using an admin magic-link exchange. Same technique can be reused for merchants.
- WhatsApp sending goes through one platform sender (`wa-platform-send`) on the platform WABA, with kill switch, opt-outs, per-phone daily caps and marketing gates.
- Blocking issue: there is **no AUTHENTICATION-category template** in `platform_wa_templates` today — only MARKETING and UTILITY ones. WhatsApp will not deliver an OTP through a marketing/utility template. An AUTHENTICATION template with a copy-code button must be created and approved by Meta first (usually minutes to a few hours). Until it is approved, OTP cannot be sent, so the email link must stay as a fallback.
- The marketing rate gates (3 msgs / 7 days, daily per-phone cap) must **not** apply to OTP messages, exactly like order UTILITY messages are exempt today.

Conclusion: no architectural blocker. The only real prerequisite is the approved authentication template plus a secure OTP store and rate limits.

## What will be built

### 1. Signup form
- Fields: Full name, Mobile (+91, 10 digits), Email, Password.
- Both are collected. Email stays the account's primary identity (as today); mobile is stored on the profile and becomes a login identity.
- Duplicate check on both email and mobile before creating the account.

### 2. Verification via WhatsApp OTP
- After the account is created, the app sends a 6-digit OTP to the mobile over WhatsApp and shows an OTP screen (auto-advance boxes, resend timer, "change number").
- On correct OTP: mark the auth user's email as confirmed server-side, mark the phone verified, sign the user in, go to onboarding/dashboard. No email click required.
- Fallback: if WhatsApp delivery fails or the template is not yet approved, the screen automatically offers the email verification link (existing flow) so signup is never dead-ended.

### 3. Login with email OR mobile
- Login page gets a toggle: "Email + password" (current) or "Mobile + OTP".
- Mobile + OTP resolves the phone to the merchant account and mints a session the same way the storefront phone login does.
- Existing merchant accounts without a phone can add and verify one from settings; nothing breaks for them.

### 4. Safety / anti-abuse (so store creation stays easy but not abusable)
- OTP is 6 digits, hashed before storage, 5-minute expiry, max 5 wrong attempts, single use.
- Resend cooldown 30s, max 3 sends per number per 15 min, plus an IP-level cap using the existing rate-limit table.
- OTP sends bypass marketing gates but are logged and counted for cost.
- Phone is stored only in canonical 10-digit form, matching the rest of the stack.

## Technical details

- New table `auth_otp_codes` (id, phone, purpose, code_hash, attempts, expires_at, consumed_at, ip, created_at) with RLS locked to service role only, plus GRANTs to `service_role`.
- New edge functions (both `verify_jwt = false`, service-role internally):
  - `merchant-otp-send`: validates phone, rate limits, generates code, hashes it, calls `wa-platform-send` with the authentication template.
  - `merchant-otp-verify`: constant-time compare, marks user email confirmed via admin API, sets `profiles.phone` + `phone_verified`, mints a session via the existing generate-link/verifyOtp technique and returns tokens.
- New platform template `merchant_otp_v1`, category AUTHENTICATION, language `en`, body "*{{1}}* is your ShopBanao verification code..." with copy-code button; submitted through the existing template submit flow. `wa-platform-send` gets an OTP path exempt from marketing gates and 24h-window logic.
- Profile changes: add `phone` (canonical 10-digit, unique where not null) and `phone_verified` to `profiles`; a phone-to-user lookup helper function (SECURITY DEFINER) so login by mobile never exposes emails to anonymous clients.
- Frontend: `Signup.tsx` gains phone field + OTP step component; `Login.tsx` gains the mobile-OTP tab; both keep the current Commerce Editorial auth styling.

## Rollout order

1. Migration (table, profile columns, lookup function, grants).
2. Create + submit the AUTHENTICATION template to Meta.
3. Ship the two edge functions and the send-path exemption.
4. Ship signup OTP step and login mobile tab, with the email link kept as automatic fallback.
5. End-to-end test on a real number: signup → OTP within seconds → dashboard; wrong code, expired code, resend, rate-limit, and login-by-mobile cases.
6. Once the template is approved and delivery is verified, WhatsApp OTP becomes the default verification and the email link stays as fallback only.
