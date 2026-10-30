import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StoreInbox } from "./StoreInbox";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  rpc,
  channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
  removeChannel: vi.fn(),
} }));
vi.mock("@/components/whatsapp/WaMediaBubble", () => ({ WaMediaBubble: () => null }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const thread = (phone: string, incoming: boolean, total = 1) => ({
  phone, name: null, last_body: incoming ? "Customer reply" : "Outgoing campaign",
  last_at: "2026-10-30T17:00:00Z", last_incoming_at: incoming ? "2026-10-30T17:00:00Z" : null,
  last_direction: incoming ? "incoming" : "outgoing", unread: 0, total_threads: total,
});
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
  <StoreInbox storeId="store-a" />
</QueryClientProvider>);

describe("WhatsApp replied conversation filter", () => {
  it("fetches replies separately from outgoing-only threads and returns to All", async () => {
    rpc.mockImplementation(async (name: string) => ({ data: [thread(name === "store_wa_replied_threads" ? "919876543210" : "919876543211", name === "store_wa_replied_threads")], error: null }));
    mount();
    await screen.findByText("919876543211");
    fireEvent.click(screen.getByRole("radio", { name: "Replied only" }));
    await screen.findByText("919876543210");
    expect(screen.queryByText("919876543211")).toBeNull();
    expect(rpc).toHaveBeenCalledWith("store_wa_replied_threads", expect.objectContaining({ _store_id: "store-a", _offset: 0 }));
    fireEvent.click(screen.getByRole("radio", { name: "All", exact: true }));
    await screen.findByText("919876543211");
  });

  it("pages only the replied result and intersects phone search", async () => {
    rpc.mockImplementation(async (name: string, args: { _offset: number; _search: string | null }) => ({
      data: name !== "store_wa_replied_threads" ? [] : args._search ? [thread("919876543210", true)] :
        args._offset === 0 ? Array.from({ length: 30 }, (_, i) => thread(`91987654${String(i).padStart(4, "0")}`, true, 31)) : [thread("919876543210", true, 31)], error: null,
    }));
    mount();
    fireEvent.click(screen.getByRole("radio", { name: "Replied only" }));
    fireEvent.click(await screen.findByRole("button", { name: "Load older conversations" }));
    await screen.findByText("919876543210");
    expect(rpc).toHaveBeenCalledWith("store_wa_replied_threads", expect.objectContaining({ _offset: 30 }));
    fireEvent.change(screen.getByPlaceholderText("Search name or number"), { target: { value: "3210" } });
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("store_wa_replied_threads", expect.objectContaining({ _search: "3210", _offset: 0 })));
  });
});