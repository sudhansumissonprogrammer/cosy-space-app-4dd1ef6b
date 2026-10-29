import { newestFirstCatalogue } from "./catalogueOrder.ts";

/** Storefront "unlimited stock" marker (no low-stock urgency, no quantity cap). */
export const SUPPLIER_FULL_STOCK = 999999;

/**
 * Stores whose availability is owned by the supplier store store any verified
 * in-stock supplier watch as full stock, so the supplier's placeholder "1"
 * never caps buyers or shows false urgency. Website orders never consume it;
 * only a verified supplier stockout returns 0.
 */
export function jdStockQuantity(storeId: string, quantity: number, delisted = false): number {
  const stock = delisted || !(quantity > 0) ? 0 : Math.floor(quantity);
  if (stock > 0 && newestFirstCatalogue(storeId)) return SUPPLIER_FULL_STOCK;
  return stock;
}

/** Failed lookups never reach this helper: only verified quantities may hide a row. */
export function jdStockVisibility(storeId: string, quantity: number, delisted: boolean) {
  const stock = jdStockQuantity(storeId, quantity, delisted);
  return { stock_quantity: stock, is_active: newestFirstCatalogue(storeId) ? stock > 0 : true };
}
