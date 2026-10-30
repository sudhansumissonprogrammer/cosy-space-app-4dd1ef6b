import { describe, expect, it } from "vitest";
import { hidesPlatformBranding } from "./storefrontBranding";
import { KALINGA_STORE_ID } from "./kalingaStore";
import { UTKAL_STORE_ID } from "../../supabase/functions/_shared/utkalContent";

describe("storefront platform branding", () => {
  it("hides branding for Utkal even after a slug rename", () => {
    expect(hidesPlatformBranding({ id: UTKAL_STORE_ID, slug: "renamed" })).toBe(true);
    expect(hidesPlatformBranding({ slug: "utkalwatches" })).toBe(true);
  });
  it("hides branding for Kalinga and its legacy identity", () => {
    expect(hidesPlatformBranding({ id: KALINGA_STORE_ID, slug: "renamed" })).toBe(true);
    expect(hidesPlatformBranding({ slug: "kalingajewels" })).toBe(true);
    expect(hidesPlatformBranding({ slug: "imitationworld" })).toBe(true);
  });
  it("preserves branding for unrelated and unknown stores", () => {
    expect(hidesPlatformBranding({ id: "other", slug: "utkalwatches" })).toBe(false);
    expect(hidesPlatformBranding({ id: "other", slug: "kalingajewels" })).toBe(false);
    expect(hidesPlatformBranding({ slug: "serdiyajewellers" })).toBe(false);
    expect(hidesPlatformBranding(undefined)).toBe(false);
  });
});