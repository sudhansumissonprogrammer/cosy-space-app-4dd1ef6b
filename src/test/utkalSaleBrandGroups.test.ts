import { expect, it } from "vitest";
import { groupSaleProductsByBrand } from "@/components/storefront/BrandCarouselGroups";

it("assigns supplied title spellings to the correct Sale brands exactly once", () => {
  const titles = ["Role x Dayton a Silicon Belt", "Rol ex Day Date", "PATEK_PHILIPPE_GOLD_BLACK", "PATEK PHILLIP NAUTILUS", "Patek Phillpe Nautilus", "AUDEMARS_PIGUET_SILVER-GREEN", "Cartie r sunmoon", "Fossiil Fs4656", "Se ko 5 Sports", "Tisso_t 1853", "Hublot Big Bang _04", "Raddo True Square"];
  const groups = groupSaleProductsByBrand(titles.map((name, id) => ({ id: String(id), name })));
  expect(Object.fromEntries(groups.map((g) => [g.label, g.items.length]))).toEqual({ Rolex: 2, "Patek Philippe": 3, "Audemars Piguet": 1, Cartier: 1, "Seiko Trending": 1, Tissot: 1, Rado: 1, Fossil: 1, Hublot: 1 });
  expect(groups.flatMap((g) => g.items).map((p) => p.id).sort()).toEqual(titles.map((_, i) => String(i)).sort());
});
it("keeps Sale brand rails in first-seen order as later pages arrive", async () => {
  const { stableGroupOrder } = await import("@/components/storefront/BrandCarouselGroups");
  const seen: string[] = [];
  expect(stableGroupOrder([{ key: "seiko" }, { key: "tissot" }, { key: "more" }], seen).map((g) => g.key)).toEqual(["seiko", "tissot", "more"]);
  // A non-opening brand discovered on a later page is appended below, never inserted above.
  expect(stableGroupOrder([{ key: "seiko" }, { key: "rado" }, { key: "tissot" }, { key: "more" }], seen).map((g) => g.key)).toEqual(["seiko", "tissot", "rado", "more"]);
});
it("opens Sale with Seiko, Tissot, Fossil, Rolex and Patek, then Hublot, preserving the rest", async () => {
  const { stableGroupOrder } = await import("@/components/storefront/BrandCarouselGroups");
  const keys = ["seiko", "fossil", "hublot", "rolex", "patek-philippe", "tissot", "audemars-piguet", "casio", "more"];
  const groups = keys.map((key) => ({ key, items: [`${key}-second`, `${key}-first`] }));
  const result = stableGroupOrder(groups, []);
  expect(result.map((group) => group.key)).toEqual(["seiko", "tissot", "fossil", "rolex", "patek-philippe", "hublot", "audemars-piguet", "casio", "more"]);
  for (const group of result) expect(group.items).toEqual([`${group.key}-second`, `${group.key}-first`]);
});
it("puts dashboard-pinned watches first in their Sale brand row, newest pin first", () => {
  const products = [
    { id: "pin-old", name: "Tissot A", is_category_pinned: true, category_pinned_at: "2026-11-03T19:40:47Z" },
    { id: "pin-new", name: "Tissot B", is_category_pinned: true, category_pinned_at: "2026-11-04T08:52:27Z" },
    { id: "newest", name: "Tissot C" },
    { id: "older", name: "Tissot D" },
  ];
  const tissot = groupSaleProductsByBrand(products).find((g) => g.key === "tissot")!;
  expect(tissot.items.map((p) => p.id)).toEqual(["pin-new", "pin-old", "older", "newest"]);
});
