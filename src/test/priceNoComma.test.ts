import { expect, it } from "vitest";
import { formatPrice } from "@/lib/productUtils";

it("shows shopper prices without thousands commas", () => {
  expect(formatPrice(1499)).toBe("₹1499");
  expect(formatPrice(125000, "INR")).toBe("₹125000");
});
