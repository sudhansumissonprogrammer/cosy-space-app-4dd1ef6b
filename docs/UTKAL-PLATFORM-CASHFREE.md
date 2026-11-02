# Utkal-only platform Cashfree handoff

## Status
2026-11-02: TEMPORARILY ON for owner testing (frontend flag true, settings enabled with environment=production because the platform Cashfree keys are live). Switch both back off after the test.

Originally implemented as dormant code. No payments or provider test transactions performed. Frontend flag is false and the service-only settings table has no enabled row. Existing storefront gateway, amounts and merchant payment settings are unchanged.

Owner states Cashfree approval exists; account-specific approval, product eligibility, production-domain whitelisting and test credentials are not independently verified.

## Flow when explicitly activated later
The current checkout creates its normal order and calculates the selected full/partial amount. At payment intent, an Utkal-only server capability is issued after matching the saved checkout token. Navigation goes to `https://shopbanao.in/utkalwatch/checkout#handoff=…`. The capability is a 256-bit random secret, hashed at rest and valid for thirty minutes. It is not the original checkout token and never goes in a query string.

The isolated page removes the capability fragment, retains it in host-scoped session storage/cookie, then obtains a persisted/idempotent Cashfree session from the backend. Cashfree opens in the current window. Its return lands on the platform page; signed server notifications and direct API verification use the saved account, reference, exact amount/currency and original order/store mapping.

Success atomically marks the original order confirmed/partially_paid and the payment attempt paid. Return to Utkal uses a fragment capability for a separate verified confirmation view displaying saved total, amount paid and delivery balance, without reusing the merchant-account verifier. Other stores never enter this flow.

## Safety
- No client-provided charge amounts or redirect destinations.
- Only exact Utkal store ID is accepted; no slug inference for payment authority.
- Payment attempts are service-only, with unique references and payment IDs; partial advances cannot silently become full charges.
- One open attempt per order; unresolved changed amounts are blocked instead of creating another charge.
- Provider order creation uses durable reservation and Cashfree idempotency key.
- Raw-body HMAC webhook authentication; amount, currency, provider order and original store/order tags are validated with Cashfree before finalization.
- Wallet recharge paths and records are not reused. Existing commission billing is unchanged.
- Platform page is noindex and Worker no-store; deploy Worker source before enabling. Do not put capability hashes/fragments in analytics, errors or logs.
- On browser closure, webhook can finalize the order; browser retries can check status. This is not a seller payout or Easy Split reporting implementation.

## Activation is intentionally NOT performed
Owner must explicitly ask to test. Before then, do not flip the frontend flag, insert enabled settings, initiate a provider order or change merchant gateways. Both frontend and server gates must be deliberately coordinated later. Settings default to sandbox; confirm the correct Cashfree sandbox account credentials before a test. Never change the existing platform credentials blindly, since wallet recharges already use them.

Before live activation, verify approved ShopBanao/Cashfree domains and business/product scope, test full and partial amounts, retries, expiry, wrong-token/order/store/amount, duplicate callbacks, browser closure, return confirmation, refunds and account-specific settlement responsibilities. Actual payments/notifications are unverified until that authorized test.

Files: `src/lib/utkalPlatformCashfree.ts`, `src/pages/UtkalPlatformCheckout.tsx`, `supabase/functions/utkal-platform-cashfree/index.ts`, service-only settings/attempts and reservation/finalization functions. The Cloudflare Worker source has the new route in its private utility policy and requires owner deployment.