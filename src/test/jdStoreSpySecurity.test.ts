import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const base = "extension/jd-store-spy/";

function worker() {
  let handler: ((message: unknown, sender: unknown, send: (value: unknown) => void) => boolean) | undefined;
  const fetch = vi.fn().mockResolvedValue({ json: async () => [{ host: "example.test" }] });
  runInNewContext(readFileSync(base + "background.js", "utf8"), {
    chrome: { runtime: {
      getURL: (path: string) => `chrome-extension://test/${path}`,
      onMessage: { addListener: (fn: typeof handler) => { handler = fn; } },
    } }, fetch,
  });
  return {
    fetch,
    send: (type: string) => new Promise<unknown>((resolve, reject) => {
      if (!handler) { reject(new Error("Worker did not register")); return; }
      handler({ type, path: "home/shell", origin: "https://example.test" }, {}, resolve);
    }),
  };
}

describe("credential-free JD extension", () => {
  it.each(["jd", "detect"])("rejects %s without making a credential-dependent request", async (type) => {
    const w = worker();
    expect(await w.send(type)).toEqual({ error: "API scanning is disabled; no private credentials are bundled." });
    expect(w.fetch).not.toHaveBeenCalled();
  });

  it("retains the bundled directory without a remote API call", async () => {
    const w = worker();
    expect(await w.send("directory")).toEqual([{ host: "example.test" }]);
    expect(w.fetch).toHaveBeenCalledWith("chrome-extension://test/stores.json");
    await w.send("directory");
    expect(w.fetch).toHaveBeenCalledTimes(1);
  });

  it("requests no host access or automatic page injection", () => {
    const manifest = JSON.parse(readFileSync(base + "manifest.json", "utf8"));
    expect(manifest.host_permissions ?? []).toEqual([]);
    expect(manifest.content_scripts ?? []).toEqual([]);
    expect(manifest.permissions ?? []).toEqual([]);
  });
});