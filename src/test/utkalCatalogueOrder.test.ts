import { describe, expect, it } from "vitest";
import { applyCatalogueOrder, catalogueSort, UTKAL_CATALOGUE_STORE_ID } from "../../supabase/functions/_shared/catalogueOrder";
import { jdStockVisibility } from "../../supabase/functions/_shared/jdStockVisibility";
import { uniqueSupplierItems } from "../../supabase/functions/_shared/jdImportIdentity";

describe("Utkal catalogue rules", () => {
  it("keeps distinct suppliers even when their watch names match", () => {
    const rows = [{ id: "supplier-a", name: "Titan Watch" }, { id: "supplier-b", name: "Titan Watch" }, { id: "supplier-a", name: "Titan Watch" }];
    expect(uniqueSupplierItems(rows).map(row => row.id)).toEqual(["supplier-a", "supplier-b"]);
  });
  it("defaults Shop All to newest, not popular", () => {
    expect(catalogueSort(UTKAL_CATALOGUE_STORE_ID, "popular")).toBe("newest");
  });
  it("puts a new watch before an older manually promoted watch", () => {
    const rows = [
      { id: "older", created_at: "2026-10-25", display_order: -10 },
      { id: "new", created_at: "2026-10-27", display_order: 0 },
    ];
    const orders: { column: string; ascending: boolean }[] = [];
    const q = { order(column: string, options: { ascending: boolean }) { orders.push({ column, ...options }); return this; } };
    applyCatalogueOrder(q, UTKAL_CATALOGUE_STORE_ID);
    rows.sort((a, b) => {
      for (const o of orders) {
        const key = o.column as keyof typeof a;
        const cmp = String(a[key]).localeCompare(String(b[key]));
        if (cmp) return o.ascending ? cmp : -cmp;
      }
      return 0;
    });
    expect(rows.map(r => r.id)).toEqual(["new", "older"]);
  });
  it("preserves manual ordering for unrelated stores", () => {
    const orders: string[] = [];
    const q = { order(column: string) { orders.push(column); return this; } };
    applyCatalogueOrder(q, "another-store");
    expect(orders[0]).toBe("display_order");
    expect(catalogueSort("another-store", "price_asc")).toBe("price_asc");
  });
  it("hides a verified supplier stockout", () => {
    expect(jdStockVisibility(UTKAL_CATALOGUE_STORE_ID, 0, false)).toEqual({ stock_quantity: 0, is_active: false });
  });
  it("shows a watch again after verified restock with full stock", () => {
    expect(jdStockVisibility(UTKAL_CATALOGUE_STORE_ID, 1, false)).toEqual({ stock_quantity: 999999, is_active: true });
  });
  it("hides supplier delistings even if quantity is positive", () => {
    expect(jdStockVisibility(UTKAL_CATALOGUE_STORE_ID, 3, true)).toEqual({ stock_quantity: 0, is_active: false });
  });
  it("gives new Utkal imports full stock only when the supplier has stock", () => {
    expect(jdStockQuantity(UTKAL_CATALOGUE_STORE_ID, 1)).toBe(999999);
    expect(jdStockQuantity(UTKAL_CATALOGUE_STORE_ID, 0)).toBe(0);
  });
  it("keeps other stores on the supplier's real quantity", () => {
    expect(jdStockVisibility("another-store", 3, false)).toEqual({ stock_quantity: 3, is_active: true });
  });
});