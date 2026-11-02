import { KALINGA_STORE_ID } from "@/lib/kalingaStore";

/**
 * Stores that use Kalinga Jewels' wider mobile product cards (tighter page
 * padding and card gutters). Gated by permanent store ID so slug/domain
 * renames never change the layout. Storefront custom domains are served from
 * the preview build by the Worker, so this only reaches them after a fresh
 * preview build (publishing alone updates shopbanao.in only).
 */
export const WIDE_MOBILE_CARD_STORE_IDS: ReadonlySet<string> = new Set([
  KALINGA_STORE_ID, // Kalinga Jewels
  "771a3012-393c-421a-b1c9-2ca918e6917f", // serdiyajewellers.shop
  "5fb2aa02-79dc-4f14-9dcf-ab410730b394", // Shakshi Imitation
  "e62eade0-acc0-4dfd-891d-3580d7d9e5f4", // Sanvariya Imitation
]);

export function usesWideMobileCards(store?: { id?: string | null } | null): boolean {
  return !!store?.id && WIDE_MOBILE_CARD_STORE_IDS.has(store.id);
}
