import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useGalleryPreparation } from "./useGalleryPreparation";

describe("gallery preparation", () => {
  it("starts with one photo and prepares neighbours only after main readiness", async () => {
    const { result, rerender } = renderHook(({ ready }) => useGalleryPreparation(0, 6, ready), { initialProps: { ready: false } });
    expect([...result.current[0]]).toEqual([0]);
    rerender({ ready: true });
    await waitFor(() => expect([...result.current[0]]).toEqual([0, 1, 5]));
    expect(result.current[0].has(2)).toBe(false);
  });
  it("advances the buffer and retains earlier slides without cascading", async () => {
    const { result, rerender } = renderHook(({ index }) => useGalleryPreparation(index, 6, true), { initialProps: { index: 0 } });
    rerender({ index: 1 });
    await waitFor(() => expect([...result.current[0]]).toEqual([0, 1, 5, 2]));
    expect(result.current[0].has(3)).toBe(false);
  });
});