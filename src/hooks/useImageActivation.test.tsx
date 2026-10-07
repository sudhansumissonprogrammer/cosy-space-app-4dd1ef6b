import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useImageActivation } from "./useImageActivation";

describe("image activation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("activates priority photos immediately", () => {
    const { result } = renderHook(() => useImageActivation(true));
    expect(result.current.active).toBe(true);
  });

  it("keeps offscreen photos inactive until their frame intersects", () => {
    let notify: IntersectionObserverCallback | undefined;
    const disconnect = vi.fn();
    const observe = vi.fn();
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit) {
        notify = callback;
        expect(options.rootMargin).toBe("0px");
      }
      observe = observe;
      disconnect = disconnect;
    });
    const { result, rerender } = renderHook(({ priority }) => useImageActivation(priority), {
      initialProps: { priority: true },
    });
    // A mounted frame exists before the non-priority observer effect runs.
    act(() => { result.current.ref.current = document.createElement("div"); });
    // Use a fresh hook to model a non-priority frame with a mounted ref.
    const frame = document.createElement("div");
    const { result: deferred } = renderHook(() => {
      const value = useImageActivation();
      value.ref.current = frame;
      return value;
    });
    expect(deferred.current.active).toBe(false);
    expect(observe).toHaveBeenCalledWith(frame);
    act(() => notify?.([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(deferred.current.active).toBe(false);
    act(() => notify?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(deferred.current.active).toBe(true);
    expect(disconnect).toHaveBeenCalled();
    rerender({ priority: true });
  });

  it("falls back safely when IntersectionObserver is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    delete (window as unknown as Record<string, unknown>).IntersectionObserver;
    const { result } = renderHook(() => {
      const value = useImageActivation();
      value.ref.current = document.createElement("div");
      return value;
    });
    expect(result.current.active).toBe(true);
  });
});