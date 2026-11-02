import { UTKAL_STORE_ID } from "./utkalContent.ts";

export const PLATFORM_CASHFREE_PATH = "/utkalwatch/checkout";
export const HANDOFF_TTL_MS = 30 * 60 * 1000;

// Pending provider results are never proof of failure or permission to pay again.
export const PAYMENT_RETURN_CHECK_DELAYS_MS = [0, 1500, 2500, 4000, 6000, 8000, 10000];

export function platformConfirmationUrl(token: string): string {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Invalid payment capability");
  return `https://utkalwatch.in/checkout?platform_return=1#platform_payment=${token}`;
}

export function isPlatformStoreReturn(host: string, path: string, search: string, hash: string): boolean {
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  return host === "utkalwatch.in" && path === "/checkout" &&
    (new URLSearchParams(search).get("platform_return") === "1" || fragment.has("platform_payment"));
}

export function canUsePlatformCashfree(storeId: string, enabled: boolean): boolean {
  return enabled === true && storeId === UTKAL_STORE_ID;
}

export function platformCharge(order: { total: unknown; advance_paid: unknown; payment_type: unknown; currency: unknown }) {
  if (order.currency !== "INR") throw new Error("Only INR is supported");
  const total = Math.round(Number(order.total) * 100);
  const amount = order.payment_type === "partial" ? Math.round(Number(order.advance_paid) * 100) : total;
  if (!Number.isSafeInteger(total) || !Number.isSafeInteger(amount) || total <= 0 || amount <= 0 || amount > total) {
    throw new Error("Invalid payment amount");
  }
  return { amountMinor: amount, totalMinor: total, balanceMinor: total - amount, currency: "INR" };
}

export function matchesPlatformPayment(attempt: { provider_order_id: string; amount_minor: number; currency: string; order_id: string; store_id: string }, payment: any): boolean {
  return payment?.order_status === "PAID" && payment.order_id === attempt.provider_order_id
    && payment.order_currency === attempt.currency
    && Math.round(Number(payment.order_amount) * 100) === Number(attempt.amount_minor)
    && payment.order_tags?.store_order_id === attempt.order_id
    && payment.order_tags?.store_id === attempt.store_id;
}