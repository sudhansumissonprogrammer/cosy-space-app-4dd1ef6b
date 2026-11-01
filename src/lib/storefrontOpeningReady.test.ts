import { afterEach, describe, expect, it, vi } from "vitest";
import { afterStorefrontOpening } from "./storefrontOpeningReady";

afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ""; vi.restoreAllMocks(); });

function opening() {
  vi.useFakeTimers();
  vi.spyOn(document, "readyState", "get").mockReturnValue("complete");
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  document.body.innerHTML = '<main data-storefront-ready="true"><img src="/opening.webp"></main>';
  const image = document.querySelector("img");
  if (!image) throw new Error("Missing fixture image");
  vi.spyOn(image, "getBoundingClientRect").mockReturnValue({ top: 0, bottom: 200, left: 0, right: 200, width: 200, height: 200, x: 0, y: 0, toJSON: () => ({}) });
  return image;
}

describe("opening-page priority", () => {
  it("waits for visible photos, then the requested three seconds", () => {
    const image = opening();
    const complete = vi.spyOn(image, "complete", "get").mockReturnValue(false);
    const run = vi.fn(); const dispose = afterStorefrontOpening(run, 3000);
    vi.advanceTimersByTime(5000); expect(run).not.toHaveBeenCalled();
    complete.mockReturnValue(true);
    vi.advanceTimersByTime(3000); expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250); expect(run).toHaveBeenCalledTimes(1);
    dispose();
  });
  it("does not reveal while route data is loading even when document load finished", () => {
    const image = opening(); vi.spyOn(image, "complete", "get").mockReturnValue(true);
    document.querySelector("main")?.setAttribute("data-storefront-loading", "true");
    const run = vi.fn(); const dispose = afterStorefrontOpening(run, 3000);
    vi.advanceTimersByTime(10000); expect(run).not.toHaveBeenCalled();
    dispose();
  });
  it("cancels the countdown if a visible photo starts loading and cancels on unmount", () => {
    const image = opening(); const complete = vi.spyOn(image, "complete", "get").mockReturnValue(true);
    const run = vi.fn(); const dispose = afterStorefrontOpening(run, 3000);
    vi.advanceTimersByTime(2000); complete.mockReturnValue(false);
    vi.advanceTimersByTime(1000); expect(run).not.toHaveBeenCalled();
    complete.mockReturnValue(true); vi.advanceTimersByTime(2000);
    dispose(); vi.advanceTimersByTime(5000); expect(run).not.toHaveBeenCalled();
  });
});