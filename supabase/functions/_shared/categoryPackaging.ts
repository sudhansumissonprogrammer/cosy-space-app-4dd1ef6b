export const UTKAL_PACKAGING_STORE_ID = "ab19143d-87a9-490e-90b7-837313522782";
export interface SavedPackaging { id: string; label: string; surcharge: number; is_active: boolean; }

/** Never take an amount or name from shopper metadata. */
export function resolveCategoryPackaging(storeId: string, key: string, optionId: unknown, saved: SavedPackaging | null) {
  if (storeId !== UTKAL_PACKAGING_STORE_ID || key !== "brandkit") return null;
  if (!saved || !saved.is_active || saved.id !== optionId) throw new Error("This packaging choice has changed. Please choose your box again.");
  const amount = Number(saved.surcharge);
  if (!Number.isFinite(amount) || amount < 0 || amount > 10000) throw new Error("Invalid packaging price");
  return { id: saved.id, label: saved.label, surcharge: amount };
}