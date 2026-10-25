import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { ALLOWED_AI_AGENTS } from "../../supabase/functions/_shared/robotsPolicy";

const source = readFileSync("docs/cloudflare-worker-current.js", "utf8").replace("export default {", "const workerExport = {");
function harness(warm = false) {
  const cacheCalls: string[] = [];
  const rendererCalls: Record<string, string>[] = [];
  const context = vm.createContext({
    Request, Response, Headers, URL, URLSearchParams, AbortController,
    TextEncoder, TextDecoder, console, setTimeout, clearTimeout,
    caches: { default: {
      match: async (key: Request) => { cacheCalls.push(key.url); return warm ? new Response("cached shopper shell") : undefined; },
      put: async () => {}, delete: async () => true,
    } },
    rendererCalls,
  });
  vm.runInContext(source + `
    resolveDomain = async () => "utkalwatches";
    getCustomDomainForSlug = async () => null;
    callEdgeFunction = async (name, params) => { rendererCalls.push({name, ...params}); return new Response("public result", {headers:{"Content-Type":"text/html"}}); };
    globalThis.api = { run: _handleFetch, bot: handleBot, publicRead: isPublicCrawlerRead, limited: isRateLimited };
  `, context);
  const api = context.api as {
    run: (r: Request, e: object, c: object) => Promise<Response>;
    bot: (r: Request, slug: string, url: URL, custom: boolean) => Promise<Response>;
    publicRead: (r: Request, url: URL) => boolean;
    limited: (key: string, limit: number) => boolean;
  };
  const request = (host: string, path: string, ua = "ChatGPT-User", method = "GET") => new Request(`https://${host}${path}`, { method, headers: {"User-Agent": ua, "cf-connecting-ip": "192.0.2.1"} });
  return { api, request, cacheCalls, rendererCalls, ctx: { waitUntil: () => {} } };
}

describe("Worker public AI routing", () => {
  it.each(["utkalwatch.in", "utkalwatches.shopbanao.in"])("dispatches cold public reads before shopper shell work on %s", async host => {
    for (const path of ["/", "/category/fossil", "/product/watch", "/shop?page=2", "/robots.txt", "/sitemap.xml", "/llms.txt"]) {
      const h = harness();
      const response = await h.api.run(h.request(host, path), {}, h.ctx);
      expect(response.status).toBe(200);
      expect(h.rendererCalls).toHaveLength(1);
      expect(h.rendererCalls[0].slug).toBe("utkalwatches");
      expect(h.rendererCalls[0].domain).toBe(host);
    }
  });
  it("skips warm human caches for AI public reads", async () => {
    const h = harness(true);
    const response = await h.api.run(h.request("utkalwatch.in", "/product/watch"), {}, h.ctx);
    expect(response.status).toBe(200);
    expect(h.cacheCalls.every(key => key.includes("bot-cache/search/"))).toBe(true);
  });
  it.each(ALLOWED_AI_AGENTS.filter(agent => !agent.startsWith("Meta-")))("admits %s public reads through the former 60-request cap", async agent => {
    const h = harness();
    for (let n = 0; n < 61; n++) {
      const r = h.request("utkalwatch.in", "/product/watch", agent);
      expect((await h.api.bot(r, "utkalwatches", new URL(r.url), true)).status).toBe(200);
    }
  });
  it("retains a bounded AI budget and separates tenants", async () => {
    const h = harness();
    for (let n = 0; n < 300; n++) {
      const r = h.request("utkalwatch.in", "/product/watch");
      expect((await h.api.bot(r, "utkalwatches", new URL(r.url), true)).status).toBe(200);
    }
    const r = h.request("utkalwatch.in", "/product/watch");
    expect((await h.api.bot(r, "utkalwatches", new URL(r.url), true)).status).toBe(429);
    const other = h.request("kalingajewels.com", "/product/watch");
    expect((await h.api.bot(other, "kalinga", new URL(other.url), true)).status).toBe(200);
  });
  it("does not give private routes or writes the public crawler dispatch", () => {
    const h = harness();
    for (const path of ["/account", "/checkout", "/cart", "/dashboard", "/api/orders", "/track-order?phone=123", "/order-confirmation"]) {
      const r = h.request("utkalwatch.in", path);
      expect(h.api.publicRead(r, new URL(r.url))).toBe(false);
    }
    const write = h.request("utkalwatch.in", "/product/watch", "ChatGPT-User", "POST");
    expect(h.api.publicRead(write, new URL(write.url))).toBe(false);
  });
  it("honours numeric rate budgets instead of treating 120 as a boolean", () => {
    const h = harness();
    for (let n = 0; n < 120; n++) expect(h.api.limited("numeric", 120)).toBe(false);
    expect(h.api.limited("numeric", 120)).toBe(true);
  });
  it("returns empty HEAD responses after rendering the public route", async () => {
    const h = harness();
    const response = await h.api.run(h.request("utkalwatch.in", "/product/watch", "ChatGPT-User", "HEAD"), {}, h.ctx);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(h.rendererCalls).toHaveLength(1);
  });
});