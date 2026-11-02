import { describe, expect, it } from "vitest";
import { canUsePlatformCashfree, platformCharge, matchesPlatformPayment, HANDOFF_TTL_MS } from "../../supabase/functions/_shared/utkalPlatformCashfreePolicy";
import { UTKAL_STORE_ID } from "../../supabase/functions/_shared/utkalContent";
import { UTKAL_PLATFORM_CASHFREE_ENABLED, usesUtkalPlatformCashfree } from "./utkalPlatformCashfree";

describe("Utkal platform Cashfree policy", () => {
  // Temporary owner test window: switched on for Utkal only.
  it("is on for Utkal during the owner test window", () => {
    expect(UTKAL_PLATFORM_CASHFREE_ENABLED).toBe(true);
    expect(usesUtkalPlatformCashfree(UTKAL_STORE_ID)).toBe(true);
  });
  it("never applies to another store even when enabled", () => {
    expect(canUsePlatformCashfree("04010cad-1cbe-40ac-b818-07d9a79c1bf7", true)).toBe(false);
    expect(canUsePlatformCashfree(UTKAL_STORE_ID, true)).toBe(true);
  });
  it("collects only the selected partial advance and leaves delivery balance", () => {
    expect(platformCharge({ total: 1799, advance_paid: 100, payment_type: "partial", currency: "INR" })).toEqual({ amountMinor: 10000, totalMinor: 179900, balanceMinor: 169900, currency: "INR" });
  });
  it("collects the complete saved total for full payment", () => {
    expect(platformCharge({ total: 1799, advance_paid: 0, payment_type: "full", currency: "INR" }).amountMinor).toBe(179900);
  });
  it("rejects an invalid advance rather than charging full instead", () => {
    expect(() => platformCharge({ total: 1799, advance_paid: 0, payment_type: "partial", currency: "INR" })).toThrow();
    expect(() => platformCharge({ total: 1799, advance_paid: 1800, payment_type: "partial", currency: "INR" })).toThrow();
  });
  it("expires handoff capabilities after thirty minutes", () => expect(HANDOFF_TTL_MS).toBe(1800000));
  it("requires exact amount, currency and original order/store binding", () => {
    const a = { provider_order_id: "utkal_1", order_id: "order1", store_id: UTKAL_STORE_ID, amount_minor: 10000, currency: "INR" };
    const p = { order_id: "utkal_1", order_status: "PAID", order_amount: 100, order_currency: "INR", order_tags: { store_order_id: "order1", store_id: UTKAL_STORE_ID } };
    expect(matchesPlatformPayment(a, p)).toBe(true);
    expect(matchesPlatformPayment(a, { ...p, order_amount: 1 })).toBe(false);
    expect(matchesPlatformPayment(a, { ...p, order_tags: { ...p.order_tags, store_order_id: "order2" } })).toBe(false);
    expect(matchesPlatformPayment(a, { ...p, order_currency: "USD" })).toBe(false);
    expect(matchesPlatformPayment(a, { ...p, order_id: "other" })).toBe(false);
  });
});