import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTranslatorLanguage } from "@/lib/storefrontTranslator";

describe("storefront language switching", () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { setTranslatorLanguage("en"); document.body.innerHTML = ""; vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("switches common controls immediately and restores English", () => {
    document.body.innerHTML = '<p>Add to Cart</p>';
    setTranslatorLanguage("hi");
    expect(document.querySelector("p")?.textContent).toBe("कार्ट में जोड़ें");
    setTranslatorLanguage("hinglish");
    expect(document.querySelector("p")?.textContent).toBe("Cart mein add karein");
    setTranslatorLanguage("en");
    expect(document.querySelector("p")?.textContent).toBe("Add to Cart");
  });

  it("keeps product names, numbers and protected inputs unchanged", () => {
    document.body.innerHTML = '<a href="/product/watch"><span>Hublot Watch 42</span></a><p>₹1,299</p><div translate="no"><input placeholder="Search products..."></div>';
    setTranslatorLanguage("hi");
    expect(document.querySelector("a")?.textContent).toBe("Hublot Watch 42");
    expect(document.querySelector("p")?.textContent).toBe("₹1,299");
    expect(document.querySelector("input")?.placeholder).toBe("Search products...");
  });

  it("does not duplicate outstanding requests during DOM changes", async () => {
    const fetcher = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetcher);
    document.body.innerHTML = '<p>Merchant delivery details here</p>';
    setTranslatorLanguage("hi");
    await vi.advanceTimersByTimeAsync(30);
    document.body.append(document.createElement("span"));
    await vi.advanceTimersByTimeAsync(500);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects translated copy that changes the user's digits", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ translations: { "Delivery in 3 days": "डिलीवरी 4 दिनों में" } }))));
    document.body.innerHTML = '<p>Delivery in 3 days</p>';
    setTranslatorLanguage("hi");
    await vi.advanceTimersByTimeAsync(100);
    expect(document.querySelector("p")?.textContent).toBe("Delivery in 3 days");
  });

  it("discards old-language responses after a rapid switch", async () => {
    let complete: ((response: Response) => void) | undefined;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { complete = resolve; })));
    document.body.innerHTML = '<p>Merchant details</p>';
    setTranslatorLanguage("hi");
    await vi.advanceTimersByTimeAsync(30);
    setTranslatorLanguage("en");
    complete?.(new Response(JSON.stringify({ translations: { "Merchant details": "विवरण" } })));
    await vi.advanceTimersByTimeAsync(100);
    expect(document.querySelector("p")?.textContent).toBe("Merchant details");
  });
});