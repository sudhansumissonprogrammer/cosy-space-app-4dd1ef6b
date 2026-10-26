import { describe, it, expect } from "vitest";
import { utkalCategoryHeading, utkalCategoryIntro, utkalCategoryFaq, relatedCategories, listedAttributes, faqPageSchema } from "../../supabase/functions/_shared/utkalCategorySeo";

const guessMen = { name: "Guess Watch Men", slug: "guess-watch-men" };

describe("Utkal category SEO", () => {
  it("heading matches the search wording", () => {
    expect(utkalCategoryHeading(guessMen)).toBe("Guess Watches for Men");
    expect(utkalCategoryHeading({ name: "Sale", slug: "sale", meta_title: "Sale" })).toBe("Sale");
    expect(utkalCategoryHeading({ name: "Casio New", slug: "casio-new", meta_title: "Plain title" })).toBe("Casio New");
  });

  it("intro only names attributes present in listed titles", () => {
    const intro = utkalCategoryIntro(guessMen, ["Guess Black Dial Leather Strap"])!;
    expect(intro).not.toContain("Not genuine");
    expect(intro).toContain("black dials");
    expect(intro).toContain("leather straps");
    expect(intro).not.toContain("blue");
    expect(listedAttributes(["Plain watch"])).toEqual({ dials: [], straps: [], styles: [] });
  });

  it("FAQ discloses replica status and schema mirrors it", () => {
    const faq = utkalCategoryFaq(guessMen);
    expect(faq[0].answer).toContain("1:1 inspired");
    expect((faqPageSchema(faq) as any).mainEntity).toHaveLength(faq.length);
    expect(utkalCategoryFaq({ name: "Sale", slug: "sale" })).toEqual([]);
  });

  it("related links point only to real categories, same brand first", () => {
    const all = [guessMen, { name: "Guess Watch Women", slug: "guess-watch-women" }, { name: "Diesel Watch Men", slug: "diesel-watch-men" }, { name: "Rolex Watch Women", slug: "rolex-watch-women" }];
    expect(relatedCategories(guessMen, all).map((c) => c.slug)).toEqual(["guess-watch-women", "diesel-watch-men"]);
  });
});
