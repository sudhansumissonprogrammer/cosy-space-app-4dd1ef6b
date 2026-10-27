import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const html = readFileSync("index.html", "utf8");
const script = html.match(/<script data-sb-boot-guard>([\s\S]*?)<\/script>/)?.[1];
if (!script) throw new Error("Boot guard missing");

function boot(url = "https://example.shopbanao.in/", blocked = false) {
  const errors: Array<(event: unknown) => void> = [];
  const timers: Array<() => void> = [];
  const replace = vi.fn();
  const history = { state: { preserved: true }, replaceState: vi.fn() };
  const window: { __APP_BOOTED__?: boolean; __sbBootOk?: () => void; addEventListener: (type: string, fn: (event: unknown) => void) => void } = {
    addEventListener: (_type, fn) => { errors.push(fn); },
  };
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => { if (blocked) throw new Error("blocked"); return values.get(key); },
    setItem: (key: string, value: string) => { if (blocked) throw new Error("blocked"); values.set(key, value); },
    removeItem: (key: string) => values.delete(key),
  };
  runInNewContext(script, { window, location: { href: url, replace }, history, document: { cookie: "" }, sessionStorage: storage, URL,
    setTimeout: (fn: () => void) => { timers.push(fn); return timers.length; }, clearTimeout: vi.fn(),
    fetch: () => Promise.resolve({}), Date,
  });
  return { errors, timers, replace, history, window };
}
const assetError = { target: { tagName: "SCRIPT", src: "https://example.shopbanao.in/assets/index-old.js" } };

describe("boot recovery", () => {
  it("never refreshes just because startup is slow", () => {
    const state = boot();
    state.timers.forEach((fn) => fn());
    expect(state.replace).not.toHaveBeenCalled();
  });
  it("uses just one navigation for simultaneous failed assets and fallback", async () => {
    const state = boot();
    state.errors.forEach((fn) => { fn(assetError); fn(assetError); });
    await Promise.resolve();
    state.timers.forEach((fn) => fn());
    expect(state.replace).toHaveBeenCalledTimes(1);
  });
  it("does not repeat recovery when storage is blocked and URL carries a previous attempt", () => {
    const state = boot("https://example.shopbanao.in/?__sb_heal=1793082436515", true);
    state.errors.forEach((fn) => fn(assetError));
    state.timers.forEach((fn) => fn());
    expect(state.replace).not.toHaveBeenCalled();
  });
  it("cancels a queued recovery if the app starts successfully", async () => {
    const state = boot();
    state.errors.forEach((fn) => fn(assetError));
    state.window.__APP_BOOTED__ = true;
    await Promise.resolve();
    state.timers.forEach((fn) => fn());
    expect(state.replace).not.toHaveBeenCalled();
  });
  it("cleans heal markers without deleting ad parameters or hashes", () => {
    const state = boot("https://example.shopbanao.in/?__sb_heal=1793082436515&__sh=123&utm_source=ad#details");
    state.window.__sbBootOk?.();
    expect(state.history.replaceState).toHaveBeenCalledWith(state.history.state, "", "/?utm_source=ad#details");
  });
});