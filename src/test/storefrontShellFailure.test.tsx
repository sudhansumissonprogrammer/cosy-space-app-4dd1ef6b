import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { useStorefront } from "@/layouts/StorefrontLayout.logic";
import StorefrontNotFound from "@/components/storefront/StorefrontNotFound";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
afterEach(() => { cleanup(); rpc.mockReset(); });

function Probe() {
  const { store, isLoading, isError, refetch, slug } = useStorefront();
  if (isLoading) return null;
  if (store) return <h1>{store.name}</h1>;
  return <StorefrontNotFound slug={slug} loadFailed={isError} onRetry={() => { void refetch(); }} />;
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/store/utkalwatches/category/unclassified-watches"]}><Routes><Route path="/store/:slug/category/:category" element={<Probe />} /></Routes></MemoryRouter></QueryClientProvider>);
}

it("does not report an existing store as missing after a failed request and retries its same identity", async () => {
  rpc.mockResolvedValueOnce({ data: null, error: new Error("temporary failure") })
    .mockResolvedValueOnce({ data: { store: { id: "ab19143d-87a9-490e-90b7-837313522782", slug: "utkalwatches", name: "Utkal Watch" } }, error: null });
  mount();
  await screen.findByRole("heading", { name: "Store couldn't load" });
  expect(screen.queryByText(/doesn't exist/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByRole("heading", { name: "Utkal Watch" });
  expect(rpc).toHaveBeenCalledTimes(2);
  expect(rpc).toHaveBeenNthCalledWith(2, "get_storefront_shell", { _slug: "utkalwatches" });
});

it("keeps confirmed missing stores distinct from temporary failures", async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  mount();
  await screen.findByRole("heading", { name: "Store not found" });
  expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
});