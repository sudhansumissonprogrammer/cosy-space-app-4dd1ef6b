/** Supplier recency is already stored in created_at by the JD organizer. */
export const UTKAL_CATALOGUE_STORE_ID = "ab19143d-87a9-490e-90b7-837313522782";

export function newestFirstCatalogue(storeId: string): boolean {
  return storeId === UTKAL_CATALOGUE_STORE_ID;
}

export function catalogueSort(storeId: string, requested?: string): string | undefined {
  return newestFirstCatalogue(storeId) ? "newest" : requested;
}

export function applyCatalogueOrder<T extends { order: (column: string, options: { ascending: boolean }) => T }>(query: T, storeId: string): T {
  if (!newestFirstCatalogue(storeId)) query = query.order("display_order", { ascending: true });
  return query.order("created_at", { ascending: false }).order("id", { ascending: true });
}