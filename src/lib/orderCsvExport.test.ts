import { describe, it, expect } from "vitest";
import { buildOrdersCsv, collectExportOrders, csvCell, togglePageSelection, type ExportOrder } from "./orderCsvExport";

const order: ExportOrder = {
  id: "order-1", order_number: 100, total: 699, customer_name: 'Asha, "Devi"', customer_phone: "9692282485",
  street_address: "House 2, Main Road\nNear school", city: "Khorda", state: "Odisha", pincode: "752030",
  order_items: [{ product_name: "Om Chain", quantity: 1, unit_price: 699, total: 699,
    products: { source_platform: "meesho", source_path: "https://www.meesho.com/om/p/abc" } }],
};

describe("order CSV data rules", () => {
  it("exports name, phone and each checkout address field unchanged in separate columns", () => {
    expect(buildOrdersCsv([order], null)).toContain('"Asha, ""Devi""","9692282485","House 2, Main Road\nNear school","Khorda","Odisha","752030"');
  });
  it("keeps each supplier PDP URL with its own purchased product", () => {
    const csv = buildOrdersCsv([{ ...order, order_items: [...(order.order_items ?? []), {
      product_name: "Ram Chain", quantity: 2, products: { source_platform: "cartpe", source_path: "ram" },
    }] }], { source_platform: "cartpe", source_base_url: "https://supplier.example" });
    expect(csv).toContain('"Om Chain","1","699","699","https://www.meesho.com/om/p/abc"');
    expect(csv).toContain('"Ram Chain","2","","","https://supplier.example/ram"');
  });
  it("leaves unavailable address and supplier data blank rather than inventing values", () => {
    expect(buildOrdersCsv([{ id: "missing", total: 0 }], null).split("\r\n")[1]).toContain('"missing","#MISSING","","","","","","","",""');
  });
  it("exports every order beyond the first page even when the server caps pages", async () => {
    const all = Array.from({ length: 701 }, (_, i) => ({ ...order, id: `order-${i}` }));
    const result = await collectExportOrders(async (offset, limit) => all.slice(offset, offset + Math.min(limit, 200)));
    expect(result).toHaveLength(701);
    expect(result.at(-1)?.id).toBe("order-700");
  });
  it("exports exactly selected IDs from different list pages", async () => {
    const all = Array.from({ length: 205 }, (_, i) => ({ ...order, id: `order-${i}` }));
    const selected = ["order-0", "order-204"];
    const result = await collectExportOrders(async (offset, limit, ids) => all.filter(row => ids?.includes(row.id)).slice(offset, offset + limit), selected);
    expect(result.map(row => row.id)).toEqual(selected);
  });
  it("fails rather than silently exporting an incomplete selection", async () => {
    await expect(collectExportOrders(async () => [], ["deleted-order"])).rejects.toThrow("no longer available");
  });
  it("selecting and clearing a page retains selections from other pages", () => {
    expect([...togglePageSelection(new Set(["page1"]), ["page2", "page3"])]).toEqual(["page1", "page2", "page3"]);
    expect([...togglePageSelection(new Set(["page1", "page2", "page3"]), ["page2", "page3"])]).toEqual(["page1"]);
  });
  it("escapes formulas, quotes and commas for safe spreadsheet opening", () => {
    expect(csvCell('=HYPERLINK("bad")')).toBe('"\'=HYPERLINK(""bad"")"');
    expect(csvCell("A,B")).toBe('"A,B"');
  });
});