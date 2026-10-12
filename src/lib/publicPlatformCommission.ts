/** Public estimate only; stored merchant billing settings are independent. */
export function calculatePublicPlatformCommission(subtotal: number): number {
  return subtotal * 0.03;
}
