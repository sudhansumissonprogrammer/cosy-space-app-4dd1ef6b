import { describe, expect, it } from "vitest";
import { activePhotoAspectRatio, photoAspectRatio } from "./pdpPhotoSizing";

describe("complete product photo sizing", () => {
  it("preserves wide, square and tall photo proportions without clamping", () => {
    expect(photoAspectRatio(1200, 600)).toBe(2);
    expect(photoAspectRatio(1200, 1200)).toBe(1);
    expect(photoAspectRatio(1200, 2400)).toBe(0.5);
    expect(photoAspectRatio(0, 1200)).toBeNull();
  });
  it("fits each selected photo rather than inheriting the first photo height", () => {
    const slides = [{ kind: "image" }, { kind: "video" }, { kind: "image" }] as const;
    expect(activePhotoAspectRatio(slides, 0, { 0: 0.75, 2: 2 })).toBe(0.75);
    expect(activePhotoAspectRatio(slides, 2, { 0: 0.75, 2: 2 })).toBe(2);
  });
  it("never supplies photo sizing for a video slide", () => {
    expect(activePhotoAspectRatio([{ kind: "image" }, { kind: "video" }], 1, { 0: 1 })).toBeNull();
  });
});