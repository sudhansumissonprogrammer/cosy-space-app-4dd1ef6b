import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useImageActivation } from "./useImageActivation";

describe("image activation", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

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
      unobserve = vi.fn();
      disconnect = disconnect;
    });
    const frame = document.createElement("div");
    const { result: deferred } = renderHook(() => {
      const value = useImageActivation();
      value.ref.current = frame;
      return value;
    });
    expect(deferred.current.active).toBe(false);
    expect(observe).toHaveBeenCalledWith(frame);
    act(() => notify?.([{ target: frame, isIntersecting: false } as unknown as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(deferred.current.active).toBe(false);
    act(() => notify?.([{ target: frame, isIntersecting: true } as unknown as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(deferred.current.active).toBe(true);
    expect(disconnect).toHaveBeenCalled();
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

  it("arms the next-row buffer only after scrolling and retains activation", () => {
    const observers: { notify: IntersectionObserverCallback; margin: string; observe: ReturnType<typeof vi.fn> }[] = [];
    vi.stubGlobal("scrollY", 0);
    vi.stubGlobal("IntersectionObserver", class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      constructor(notify: IntersectionObserverCallback, options: IntersectionObserverInit) {
        observers.push({ notify, margin: options.rootMargin || "", observe: this.observe });
      }
    });
    const frame = document.createElement("div");
    const { result, unmount } = renderHook(() => {
      const value = useImageActivation(false, { rootMargin: "600px 0px", afterScroll: true });
      value.ref.current = frame;
      return value;
    });
    const ahead = observers.find(o => o.margin === "600px 0px");
    expect(ahead?.observe).not.toHaveBeenCalled();
    expect(result.current.active).toBe(false);
    vi.stubGlobal("scrollY", 100);
    act(() => window.dispatchEvent(new Event("scroll")));
    expect(ahead?.observe).toHaveBeenCalledWith(frame);
    act(() => ahead?.notify([{ target: frame, isIntersecting: true } as unknown as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(result.current.active).toBe(true);
    act(() => window.dispatchEvent(new Event("scroll")));
    expect(result.current.active).toBe(true);
    unmount();
  });

  it("shares an observer between offscreen frames", () => {
    const construct = vi.fn();
    vi.stubGlobal("IntersectionObserver", class {
      constructor() { construct(); }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    });
    const mount = () => renderHook(() => {
      const value = useImageActivation();
      value.ref.current = document.createElement("div");
      return value;
    });
    const first = mount();
    const second = mount();
    expect(construct).toHaveBeenCalledTimes(1);
    first.unmount();
    second.unmount();
  });
});