import { describe, expect, it } from "vitest";
import { hasHindiShoppingVoice, voiceCheckoutClip, voicePaymentClip, voiceRouteClip, SERDIYA_VOICE_STORE_ID } from "./hindiShoppingVoice";
import { KALINGA_STORE_ID } from "./kalingaStore";
describe("Hindi shopping voice eligibility and payment truth", () => {
  it("enables only Serdiya Jewellers and Kalinga", () => {
    expect(hasHindiShoppingVoice({ id: SERDIYA_VOICE_STORE_ID })).toBe(true);
    expect(hasHindiShoppingVoice({ id: KALINGA_STORE_ID })).toBe(true);
    expect(hasHindiShoppingVoice({ id: "04010cad-1cbe-40ac-b818-07d9a79c1bf7" })).toBe(false);
    expect(hasHindiShoppingVoice({ id: "utkalwatch" })).toBe(false);
    expect(hasHindiShoppingVoice(null)).toBe(false);
  });
  it("speaks a fixed ₹100 only for an actual ₹100 partial advance", () => {
    const state = { storeId: SERDIYA_VOICE_STORE_ID, stage: "payment" as const, mode: "partial" as const, amount: 100, balance: 1700 };
    expect(voicePaymentClip(state)).toBe("partial100");
    expect(voicePaymentClip({ ...state, amount: 200 })).toBe("partial");
    expect(voicePaymentClip({ ...state, amount: 50 })).toBe("partial");
    expect(voicePaymentClip({ ...state, mode: "full" })).toBe("full");
    expect(voicePaymentClip({ ...state, mode: "cod" })).toBe("cod");
  });
  it("guides direct and prefixed shopping pages but not private utility pages", () => {
    expect(voiceRouteClip("/category/chain", "serdiyajewellers")).toBe("category");
    expect(voiceRouteClip("/store/kalingajewels/product/chain", "kalingajewels")).toBe("product");
    expect(voiceRouteClip("/store/kalingajewels", "kalingajewels")).toBe("home");
    expect(voiceRouteClip("/account", "kalingajewels")).toBe(null);
    expect(voiceRouteClip("/checkout", "kalingajewels")).toBe(null);
  });
  it("mentions the ₹100 booking on the address step only for an actual ₹100 partial advance", () => {
    const state = { storeId: SERDIYA_VOICE_STORE_ID, stage: "address" as const, mode: "partial" as const, amount: 100, balance: 1700 };
    expect(voiceCheckoutClip(state)).toBe("address100");
    expect(voiceCheckoutClip({ ...state, amount: 200 })).toBe("address");
    expect(voiceCheckoutClip({ ...state, mode: "full" })).toBe("address");
    expect(voiceCheckoutClip({ ...state, stage: "payment" })).toBe("partial100");
  });
});
