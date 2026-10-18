import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
import { fetchOwnedReviewStore } from "./reviewManagerData";
describe("review manager owner store resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const query = { select: mocks.select, eq: mocks.eq, maybeSingle: mocks.maybeSingle };
    mocks.from.mockReturnValue(query);
    mocks.select.mockReturnValue(query);
    mocks.eq.mockReturnValue(query);
  });
  it("resolves the requested store rather than the owner's first store", async () => {
    const store = { id: "second-store", slug: "serdiyajewellers" };
    mocks.maybeSingle.mockResolvedValue({ data: store, error: null });
    expect(await fetchOwnedReviewStore("current-owner", "serdiyajewellers")).toEqual(store);
    expect(mocks.eq.mock.calls).toEqual([["owner_id", "current-owner"], ["slug", "serdiyajewellers"]]);
  });
  it("supports permanent IDs while retaining the owner filter", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    await fetchOwnedReviewStore("current-owner", "c3c5dff2-173a-4f4d-90e4-8b1c88c305d9");
    expect(mocks.eq).toHaveBeenCalledWith("id", "c3c5dff2-173a-4f4d-90e4-8b1c88c305d9");
    expect(mocks.eq).toHaveBeenCalledWith("owner_id", "current-owner");
  });
  it("propagates request errors rather than returning an empty store", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: new Error("connection failed") });
    await expect(fetchOwnedReviewStore("current-owner", "kalingajewels")).rejects.toThrow("connection failed");
  });
});