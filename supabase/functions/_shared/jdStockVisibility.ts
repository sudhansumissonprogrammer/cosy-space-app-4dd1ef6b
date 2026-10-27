import { newestFirstCatalogue } from "./catalogueOrder.ts";

/** Failed lookups never reach this helper: only verified quantities may hide a row. */
export function jdStockVisibility(storeId: string, quantity: number, delisted: boolean) {
  const stock = delisted || quantity <= 0 ? 0 : quantity;
  return { stock_quantity: stock, is_active: newestFirstCatalogue(storeId) ? stock > 0 : true };
}