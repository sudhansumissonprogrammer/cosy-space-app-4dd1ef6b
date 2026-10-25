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
    globalThis.api = { run: _handleFetch, bot: handleBot, publicRead: isPublicCrawlerRead, limited: isRateLimited, utility: protectUtilitySearchResponse, utilityPath: isUtilitySearchPath };
  `, context);
  const api = context.api as {
    run: (r: Request, e: object, c: object) => Promise<Response>;
    bot: (r: Request, slug: string, url: URL, custom: boolean) => Promise<Response>;
    publicRead: (r: Request, url: URL) => boolean;
    limited: (key: string, limit: number) => boolean;
    utility: (r: Request, response: Response) => Promise<Response>;
    utilityPath: (path: string) => boolean;
  };
  const request = (host: string, path: string, ua = "ChatGPT-User", method = "GET", accept = "text/html") => new Request(`https://${host}${path}`, { method, headers: {"User-Agent": ua, "cf-connecting-ip": "192.0.2.1", Accept: accept} });
  return { api, request, cacheCalls, rendererCalls, ctx: { waitUntil: () => {} } };
}

describe("Worker public AI routing", () => {
  it.each(["Googlebot", "ChatGPT-User", "Mozilla/5.0"])("protects utility shell metadata for %s without altering application data", async agent => {
    const h = harness(true);
    for (const path of ["/track-order?phone=123", "/checkout?coupon=SAVE50", "/cart", "/account", "/search?q=watch", "/wishlist", "/store/utkalwatches/order-confirmation?order=123"]) {
      const request = h.request("utkalwatch.in", path, agent);
      const shell = new Response('<html><head><meta name="robots" content="index,follow"><link rel="canonical" href="https://utkalwatch.in/"><meta property="og:url" content="https://utkalwatch.in/"><script type="application/ld+json">{"@type":"Product"}</script></head><body><script id="app-data">{"cart":"keep"}</script><div id="root"></div></body></html>', { headers: { "Content-Type": "text/html", "Cache-Control": "public,max-age=14400" } });
      const response = await h.api.utility(request, shell);
      const html = await response.text();
      expect(response.headers.get("X-Robots-Tag")).toBe("noindex, follow");
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(html).toContain(`href="https://utkalwatch.in${new URL(request.url).pathname}"`);
      expect(html).not.toContain('content="index,follow"');
      expect(html).not.toContain('application/ld+json');
      expect(html).toContain('<script id="app-data">{"cart":"keep"}</script>');
      expect(request.url).toBe(`https://utkalwatch.in${path}`);
    }
  });
  it("keeps public product pages outside the utility response policy", async () => {
    const h = harness();
    const original = new Response("product", { headers: { "Cache-Control": "public,max-age=3600" } });
    expect(await h.api.utility(h.request("utkalwatch.in", "/product/watch"), original)).toBe(original);
    expect(h.api.utilityPath("/searchlight-watch")).toBe(false);
  });
  it("returns an empty noindex utility HEAD response", async () => {
    const h = harness();
    const response = await h.api.utility(h.request("utkalwatch.in", "/track-order?phone=123", "Googlebot", "HEAD"), new Response("shell"));
    expect(await response.text()).toBe("");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, follow");
  });
  it("negotiates Markdown for ordinary agents and separates representation cache keys", async () => {
    const h = harness();
    const r = h.request("utkalwatch.in", "/product/watch", "Mozilla/5.0", "GET", "text/markdown");
    const response = await h.api.run(r, {}, h.ctx);
    expect(response.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
    expect(response.headers.get("Vary")).toBe("Accept");
    expect(h.rendererCalls[0].format).toBe("markdown");
    expect(h.cacheCalls[0]).toContain("format=markdown");
    const html = await h.api.run(h.request("utkalwatch.in", "/product/watch"), {}, h.ctx);
    expect(html.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(h.cacheCalls.at(-1)).toContain("format=html");
  });
  it("does not negotiate private pages for a Markdown request", () => {
    const h = harness();
    const r = h.request("utkalwatch.in", "/account", "Mozilla/5.0", "GET", "text/markdown");
    expect(h.api.publicRead(r, new URL(r.url))).toBe(false);
  });
  it.each(["utkalwatch.in", "utkalwatches.shopbanao.in"])("dispatches cold public reads before shopper shell work on %s", async host => {
    for (const path of ["/", "/category/fossil", "/product/watch", "/shop?page=2", "/robots.txt", "/sitemap.xml", "/llms.txt"]) {
      const h = harness();
      const response = await h.api.run(h.request(host, path), {}, h.ctx);
      expect(response.status).toBe(200);
      expect(h.rendererCalls).toHaveLength(1);
      expect(h.rendererCalls[0].slug).toBe("utkalwatches");
      const expectedDomain = h.rendererCalls[0].name === "bot-render" && host.endsWith(".shopbanao.in") ? "" : host;
      expect(h.rendererCalls[0].domain).toBe(expectedDomain);
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