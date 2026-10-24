import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMobileCardActivation } from "./useMobileCardActivation";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); document.body.innerHTML = ""; });

describe("shared mobile card preparation", () => {
  it("holds the next two behind opening downloads and never cascades into the rest", () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    vi.stubGlobal("innerHeight", 700);
    vi.stubGlobal("innerWidth", 390);
    const callbacks: { cb: IntersectionObserverCallback; margin: string }[] = [];
    vi.stubGlobal("IntersectionObserver", class {
      constructor(cb: IntersectionObserverCallback, options: IntersectionObserverInit) { callbacks.push({ cb, margin: options.rootMargin || "" }); }
      observe() {} unobserve() {} disconnect() {}
    });
    const opening = document.createElement("img");
    opening.setAttribute("loading", "eager");
    opening.getBoundingClientRect = () => ({ top: 0, bottom: 340, width: 190 } as DOMRect);
    Object.defineProperty(opening, "complete", { value: false, configurable: true });
    document.body.append(opening);
    const nodes = Array.from({ length: 6 }, (_, i) => {
      const node = document.createElement("div");
      node.getBoundingClientRect = () => ({ top: 700 + Math.floor(i / 2) * 50, bottom: 1040, left: i % 2 * 195, right: i % 2 * 195 + 190 } as DOMRect);
      document.body.append(node);
      return node;
    });
    const hooks = nodes.map(node => renderHook(() => {
      const value = useMobileCardActivation(); value.ref.current = node; return value;
    }));
    const buffer = callbacks.find(o => o.margin.includes("400px"));
    act(() => { buffer?.cb(nodes.map(target => ({ target, isIntersecting: true } as unknown as IntersectionObserverEntry)), {} as IntersectionObserver); vi.advanceTimersByTime(300); });
    expect(hooks.map(h => h.result.current.active)).toEqual([false, false, false, false, false, false]);
    Object.defineProperty(opening, "complete", { value: true });
    act(() => { document.dispatchEvent(new Event("load")); vi.advanceTimersByTime(300); });
    expect(hooks.map(h => h.result.current.active)).toEqual([true, true, false, false, false, false]);
    act(() => { document.dispatchEvent(new Event("load")); vi.advanceTimersByTime(1000); });
    expect(hooks.map(h => h.result.current.active)).toEqual([true, true, false, false, false, false]);
  });
  it("does not add the mobile buffer on desktop", () => {
    const margins: string[] = [];
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    vi.stubGlobal("IntersectionObserver", class {
      constructor(_cb: IntersectionObserverCallback, options: IntersectionObserverInit) { margins.push(options.rootMargin || ""); }
      observe() {} unobserve() {} disconnect() {}
    });
    renderHook(() => { const value = useMobileCardActivation(); value.ref.current = document.createElement("div"); return value; });
    expect(margins).toEqual(["0px"]);
  });
});