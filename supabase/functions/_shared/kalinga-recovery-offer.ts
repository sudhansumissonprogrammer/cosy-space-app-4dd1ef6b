export const KALINGA_RECOVERY_STORE_ID = "c3c5dff2-173a-4f4d-90e4-8b1c88c305d9";
export const KALINGA_RECOVERY_CODE = "SAVE100";

/** Recovery links opt into this coupon, never general WhatsApp visits. */
export function recoveryCouponToken(token: string, storeId: string, code: string): string {
  return storeId === KALINGA_RECOVERY_STORE_ID && code === KALINGA_RECOVERY_CODE
    ? `${token}~${KALINGA_RECOVERY_CODE}` : token;
}

export function recoveryCouponTarget(target: string, storeId: string, code: string): string {
  if (storeId !== KALINGA_RECOVERY_STORE_ID || code !== KALINGA_RECOVERY_CODE) return target;
  const url = new URL(target);
  url.searchParams.set("coupon", KALINGA_RECOVERY_CODE);
  return url.toString();
}