/** Identical supplier SKUs are one item; identical names from different SKUs are not. */
export function uniqueSupplierItems<T extends { id: unknown }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = String(item.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}