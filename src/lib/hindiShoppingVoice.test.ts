import { describe, expect, it } from "vitest";
import { hasHindiShoppingVoice, voiceCheckoutClip, voiceStoreClip, voicePaymentClip, voiceRouteClip, SERDIYA_VOICE_STORE_ID, stopVoiceForPayment, getVoicePaymentStopped, resetVoicePaymentStopped, subscribeVoiceCheckout } from "./hindiShoppingVoice";
import { KALINGA_STORE_ID } from "./kalingaStore";
describe("Hindi shopping voice eligibility and payment truth", () => {
  it("stops immediately on a payment tap and stays stopped until checkout is left", () => {
    resetVoicePaymentStopped(SERDIYA_VOICE_STORE_ID);
    let notified = false;
    const unsubscribe = subscribeVoiceCheckout(() => { notified = true; });
    stopVoiceForPayment(SERDIYA_VOICE_STORE_ID);
    expect(notified).toBe(true);
    expect(getVoicePaymentStopped(SERDIYA_VOICE_STORE_ID)).toBe(true);
    expect(getVoicePaymentStopped(KALINGA_STORE_ID)).toBe(false);
    resetVoicePaymentStopped(SERDIYA_VOICE_STORE_ID);
    expect(getVoicePaymentStopped(SERDIYA_VOICE_STORE_ID)).toBe(false);
    unsubscribe();
  });
  it("does not speak while payment is being verified", () => {
    expect(voiceCheckoutClip({ storeId: SERDIYA_VOICE_STORE_ID, stage: "waiting", mode: "partial", amount: 100, balance: 1700 })).toBe(null);
  });
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
  it("greets by Serdiya Jewellers name only on Serdiya home and category pages", () => {
    expect(voiceStoreClip("home", SERDIYA_VOICE_STORE_ID)).toBe("homeSerdiya");
    expect(voiceStoreClip("category", SERDIYA_VOICE_STORE_ID)).toBe("categorySerdiya");
    expect(voiceStoreClip("product", SERDIYA_VOICE_STORE_ID)).toBe("product");
    expect(voiceStoreClip("home", KALINGA_STORE_ID)).toBe("home");
    expect(voiceStoreClip("category", KALINGA_STORE_ID)).toBe("category");
  });
});
