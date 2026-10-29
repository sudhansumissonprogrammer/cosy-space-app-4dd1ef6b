import { describe, it, expect } from "vitest";
import { parsePhoneList } from "./utkalBulkPhones";

describe("parsePhoneList", () => {
  it("dedupes formats of the same number and drops non-mobile values", () => {
    const r = parsePhoneList("phone\n9692186366\n+91 96921 86366\n09692186366\n12345\n5123456789");
    expect(r.phones).toEqual(["919692186366"]);
  });
});
