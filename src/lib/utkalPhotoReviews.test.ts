import { describe, expect, it } from "vitest";
import { utkalPhotoReviews } from "./utkalPhotoReviews";
import { ratingBreakdown } from "@/components/storefront/reviews/reviewTypes";

describe("Utkal merchant photo reviews", () => {
  it("retains thirty photos and adds four complete unique photos only to Utkal", () => {
    const photos = utkalPhotoReviews("ab19143d-87a9-490e-90b7-837313522782");
    expect(photos).toHaveLength(34);
    expect(new Set(photos.map(r => r.media[0]?.url)).size).toBe(34);
    expect(photos[0].media[0].url).toContain("01_1000498261");
    expect(photos[10].media[0].url).toContain("01-1000498247");
    expect(photos[20].media[0].url).toContain("01-1000498272_utkalwatch");
    expect(photos[30].media[0].url).toContain("01_1000498227_utkalwatch");
    expect(photos.some(r => r.media[0].url.includes("02_1000498228") || r.media[0].url.includes("04_1000498232"))).toBe(false);
    expect(photos.every(r => r.customer_name === "" && r.rating === 0 && r.photo_only && r.media.length === 1)).toBe(true);
    expect(utkalPhotoReviews("another-store")).toEqual([]);
  });
  it("never adds unprovided ratings to the store average", () => {
    const photos = utkalPhotoReviews("ab19143d-87a9-490e-90b7-837313522782");
    expect(ratingBreakdown([...photos, { rating: 4 }])).toEqual({ counts: { 5: 0, 4: 1, 3: 0, 2: 0, 1: 0 }, total: 1, average: 4 });
  });
  it("does not claim verification before merchant confirmation", () => {
    expect(utkalPhotoReviews("ab19143d-87a9-490e-90b7-837313522782").every(r => r.is_verified === false)).toBe(true);
  });
});