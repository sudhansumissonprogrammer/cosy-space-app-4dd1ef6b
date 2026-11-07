import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminChatTab } from "./AdminChatTab";

const { from, eq } = vi.hoisted(() => ({ from: vi.fn(), eq: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from, rpc: vi.fn().mockResolvedValue({ data: 0, error: null }),
  channel: () => ({ on: () => ({ subscribe: () => ({}) }) }), removeChannel: vi.fn(),
} }));
vi.mock("@/hooks/useWhatsAppMode", () => ({ useWhatsAppMode: () => ({ isPlatformOnly: true }) }));
vi.mock("@/components/whatsapp/WaMediaBubble", () => ({ WaMediaBubble: () => null }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AdminChatTab /></QueryClientProvider>);
const row = { id: "incoming-1", recipient_phone: "919876543210", sender_phone: "919876543210", store_id: null,
  direction: "incoming", message_body: "hi", created_at: new Date().toISOString(), status: "read", stores: null };
function setup(error: unknown = null) {
  Element.prototype.scrollIntoView = vi.fn();
  from.mockImplementation(() => {
    const request: any = { select: () => request, order: () => request, range: () => request,
      limit: () => request, is: () => request, eq: (...args: unknown[]) => { eq(...args); return request; },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: error ? null : [row], error }).then(resolve) };
    return request;
  });
}
describe("Admin incoming WhatsApp inbox", () => {
  it("shows unassigned hi messages by default and loads full conversation on selection", async () => {
    setup(); mount();
    fireEvent.click(await screen.findByRole("button", { name: /919876543210/ }));
    await waitFor(() => expect(eq).toHaveBeenCalledWith("direction", "incoming"));
    await waitFor(() => expect(eq).toHaveBeenCalledWith("recipient_phone", "919876543210"));
    expect(await screen.findByText("hi", { selector: "p" })).toBeInTheDocument();
  });
  it("shows a load error instead of claiming no conversations", async () => {
    setup(new Error("failed")); mount();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("No conversations yet")).toBeNull();
  });
});