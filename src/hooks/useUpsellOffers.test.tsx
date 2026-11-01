import { createElement, type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useStoreEnabledApps } from "./useStoreEnabledApps";
import { useUpsellOffers } from "./useUpsellOffers";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

describe("shared merchant app state", () => {
  it("shares one request between app and offer consumers and excludes disabled apps and inactive offers", async () => {
    rpc.mockResolvedValue({ error: null, data: [
      { app_id: "upsell-crosssell", enabled: true, config: { offers: [{ id: "active", active: true }, { id: "inactive", active: false }] } },
      { app_id: "spin-wheel", enabled: false, config: {} },
    ] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => createElement(QueryClientProvider, { client }, children);
    const { result, unmount } = renderHook(() => ({ apps: useStoreEnabledApps("shared-test-store"), offers: useUpsellOffers("shared-test-store") }), { wrapper });
    await waitFor(() => expect(result.current.offers.isSuccess).toBe(true));
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(result.current.apps.data?.map((app) => app.app_id)).toEqual(["upsell-crosssell"]);
    expect(result.current.offers.data?.map((offer) => offer.id)).toEqual(["active"]);
    unmount(); client.clear();
  });
});