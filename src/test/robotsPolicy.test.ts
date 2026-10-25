import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ALLOWED_AI_AGENTS, buildRobotsTxt, PRIVATE_CRAWL_PATHS } from "../../supabase/functions/_shared/robotsPolicy";

const worker = readFileSync("docs/cloudflare-worker-current.js", "utf8");
function workerRegex(name: string) {
  const match = worker.match(new RegExp(`const ${name}\\s*=\\s*(/[^\\n]+/[a-z]*);`));
  if (!match) throw new Error(`Missing ${name}`);
  const expression = match[1];
  const lastSlash = expression.lastIndexOf("/");
  return new RegExp(expression.slice(1, lastSlash), expression.slice(lastSlash + 1));
}

describe("universal AI crawler access", () => {
  it.each(ALLOWED_AI_AGENTS)("allows %s through the Worker block list", agent => {
    expect(workerRegex("BLOCKED_BOT_REGEX").test(agent)).toBe(false);
    expect(workerRegex("AI_CRAWLER_REGEX").test(agent) || workerRegex("SOCIAL_BOT_REGEX").test(agent)).toBe(true);
  });
  it("keeps scraping blocks and Meta access intact", () => {
    expect(workerRegex("BLOCKED_BOT_REGEX").test("AhrefsBot")).toBe(true);
    expect(workerRegex("BLOCKED_BOT_REGEX").test("Meta-ExternalFetcher")).toBe(false);
    expect(workerRegex("BLOCKED_BOT_REGEX").test("FacebookBot")).toBe(false);
  });
  it("shares private-route restrictions with every allowed agent", () => {
    const groups = buildRobotsTxt("https://utkalwatch.in").split(/\n\n/);
    for (const agent of ALLOWED_AI_AGENTS) {
      const group = groups.find(value => value.split("\n").includes(`User-agent: ${agent}`));
      expect(group).toContain("Allow: /");
      for (const path of PRIVATE_CRAWL_PATHS) expect(group).toContain(`Disallow: ${path}`);
    }
  });
  it("uses the correct store sitemap without cross-tenant links", () => {
    const robots = buildRobotsTxt("https://utkalwatch.in");
    expect(robots).toContain("Sitemap: https://utkalwatch.in/sitemap.xml");
    expect(robots).not.toContain("https://shopbanao.in");
  });
  it("keeps the platform static policy in sync", () => {
    expect(readFileSync("public/robots.txt", "utf8")).toBe(buildRobotsTxt("https://shopbanao.in"));
  });
});