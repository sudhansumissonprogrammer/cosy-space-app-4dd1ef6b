import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import LiveStoreView from "./LiveStoreView";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({supabase:{rpc}}));
vi.mock("./ActivityEarth", () => ({default:()=>null}));
function mount() { return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><LiveStoreView storeId="store-a" symbol="₹" /></QueryClientProvider>); }
describe("live store aggregates", () => {
  beforeEach(()=>rpc.mockReset());
  it("requests only the selected store and preserves distinct activity counts", async()=>{
    rpc.mockResolvedValue({error:null,data:{live:{active:4,top_pages:[]},behavior:{cart_sessions:2,checkout_sessions:1},purchases:3,sales:1200,updated_at:"2026-10-31T15:00:00Z",order_locations:[],visitor_countries:[]}});
    mount();
    await waitFor(()=>expect(rpc).toHaveBeenCalledWith("get_store_live_view",{_store_id:"store-a"}));
    expect(await screen.findByText("4")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("₹1,200")).toBeInTheDocument();
  });
  it("does not present a failed read as zero visitors", async()=>{
    rpc.mockResolvedValue({error:new Error("Unavailable"),data:null});
    mount();
    await screen.findByRole("alert");
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});