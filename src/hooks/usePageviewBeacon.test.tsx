import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { usePageviewBeacon } from "./usePageviewBeacon";

vi.mock("@/lib/visitorSession", () => ({
  getOrCreateSessionId: () => "sid-1",
  getVisitorId: () => "vid-1",
  isLikelyBot: () => false,
}));

function Probe() {
  usePageviewBeacon("store-1");
  return null;
}

describe("usePageviewBeacon", () => {
  const beacon = vi.fn(() => true);
  const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));

  beforeEach(() => {
    sessionStorage.clear();
    (window as Window & { __SF_WORKER__?: boolean }).__SF_WORKER__ = true;
    Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    delete (window as Window & { __SF_WORKER__?: boolean }).__SF_WORKER__;
    vi.unstubAllGlobals();
    beacon.mockClear();
    fetchMock.mockClear();
  });

  it("records live-store visits through the ingest service, never the store-server /__sf/pv path", () => {
    render(<MemoryRouter initialEntries={["/category/chain"]}><Probe /></MemoryRouter>);
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(String(beacon.mock.calls[0][0])).toMatch(/\/functions\/v1\/ingest$/);
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("/__sf/pv"))).toBe(false);
  });
});
