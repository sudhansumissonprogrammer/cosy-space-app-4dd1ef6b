# Shared ShopBanao Cashfree payments

## Goal
Let approved merchants without their own payment gateway accept full online payments or a configured online advance with the remaining balance collected on delivery, through ShopBanao’s official Cashfree setup.

## Recommended model and launch requirement
Use Cashfree Easy Split under a Cashfree-approved marketplace arrangement, with each participating store onboarded as a vendor. No separate merchant API keys are required in this model, but required business verification and a validated settlement beneficiary remain necessary.

Before live collections, Cashfree must confirm ShopBanao’s account approval, Easy Split activation, eligible product categories, full/advance collection permissions, checkout domains and merchant identity, settlement schedules, fees, refunds, disputes and reserves. The existing Cashfree commission-wallet integration is not proof of marketplace approval.

If Cashfree requires independent stores to have individual merchant accounts instead, revise the onboarding approach to its Embedded Payments model before enabling collections. Do not silently substitute this alternative.

## Merchant experience
- Add “ShopBanao Payments — powered by Cashfree” alongside existing merchant-gateway settings.
- Collect Cashfree-required business, verification and settlement details securely; show Not started, Verification pending, Active, Rejected and Suspended statuses.
- Require explicit merchant consent and approval before enabling shared payments. Missing gateway credentials alone never activate it.
- Approved merchants control full-payment availability and partial-payment advances through their existing payment settings.
- Preserve existing merchant gateways and COD settings unless the merchant deliberately switches.
- Show collections, awaiting settlement, settled payments, refunds and failures, with order references and fee breakdowns.

## Shopper flow
1. Shopper checks out on the merchant’s store and selects full online payment or partial payment.
2. ShopBanao validates the order and calculates the amount due now on the server.
3. Reserve a payment attempt bound to this exact merchant and order, then create the Cashfree payment session using server-only platform credentials.
4. “Pay with Cashfree” opens Cashfree’s secure checkout using the approved ShopBanao account. A separate ShopBanao landing page is unnecessary.
5. Confirm payment directly with Cashfree; returning to the store is navigation, not payment proof.
6. Return the shopper to that store’s confirmation page, showing paid-now and remaining-delivery amounts.
7. Allocate the collected online amount to the approved vendor settlement flow and track bank settlement separately from payment success.

For an illustrative ₹1,500 order with a ₹100 advance, Cashfree collects ₹100 and checkout records ₹1,400 due on delivery. The delivery balance is not money collected or settled through this online payment.

## Payment safety first
Before sharing one account, harden existing Cashfree verification/status/webhook paths that do not consistently bind a provider reference to its original local order.
- Reject same-order, cross-order and cross-store payment-reference reuse.
- Verify amount, currency, original payment account and environment before finalization.
- Authenticate notifications using the exact raw payload and Cashfree signature, then confirm authoritative payment status.
- Persist references before exposing a payable session; make retries and concurrent clicks idempotent.
- Handle duplicate notifications, failed database writes, browser closure, delayed success, cancellation races and configuration changes without losing a payment.
- Preserve historical payments and downstream notification/analytics deduplication.

## Funds, fees and refunds
- Keep customer collections and seller payables separate from the non-refundable commission top-up wallet.
- Preserve ShopBanao’s existing 3% order-commission policy without double charging; freeze the applicable fee policy per order/payment.
- Do not deduct 3% of an advance as though it were necessarily the full order commission. Reconcile existing commission charges against any proposed settlement deductions.
- Gateway, vendor-settlement charges and applicable taxes require Cashfree’s confirmed schedule and a disclosed merchant fee policy before live use.
- Split only amounts actually collected online; track failed/missing allocations and settlement deadlines.
- Refund to the original payment source with tracked vendor/platform liability and settlement adjustments.
- Track disputes, evidence deadlines, reserves and settlement failures independently.
- Do not promise instant payouts or automatic holds until delivery without Cashfree approval.
- Never use the platform account to bypass prohibited-product or seller eligibility restrictions.

## Technical implementation
- Extend public checkout configuration with safe payment availability and explicit account mode; never return platform secrets or save them in merchant-visible payment rows.
- Add access-controlled vendor onboarding, immutable payment attempts, verified payment records, seller settlement accounting and refund/dispute records in Lovable Cloud. Follow existing role/RLS/grant conventions.
- Snapshot order/store, amount in minor units, currency, purpose, account/environment, credential-version reference and vendor/fee allocation on each attempt.
- Use one authoritative finalization service across shopper verification, status recovery, authenticated webhook and paginated background reconciliation.
- Resolve callbacks from the saved attempt mapping, not caller-provided tags, notes or shortened order IDs.
- Require a scoped checkout capability for shopper payment operations; allowlist return destinations to the verified merchant domain.
- Keep wallet recharge callbacks and records separate. Persist all hosted/UPI attempts consistently.
- Integrate both existing checkout implementations and preserve store-specific navigation behavior where required.
- Use a feature flag, approved-store allowlist, transaction controls and an admin stop switch; retain original account mapping for in-flight attempts when settings change.

## Delivery sequence
1. Harden existing Cashfree payment binding and attempt/finalization logic with regression tests.
2. Build merchant onboarding and test-only shared checkout without enabling live collection.
3. Integrate the approved Easy Split settlement/refund flow and reporting; finalize fee treatment before activation.
4. Verify full payment, partial advance, cancellation, retry, browser closure, delayed webhook, reference replay, duplicate events, refund and settlement failure in Cashfree test mode.
5. Obtain account/product approval and onboard a small eligible pilot cohort.
6. Perform authorized live payment/refund/settlement checks, then expand gradually with reconciliation alerts.

## Acceptance and blockers
Every successful payment must read back against its original merchant/order, show accurate paid-now/delivery balance, and reconcile to the correct vendor allocation without duplicate order commission.

Live launch is blocked until Cashfree’s account-specific approval, merchant verification and commercial/liability terms are confirmed. Planning approval authorizes implementation preparation, not unapproved live collections or real-money test charges.