/** Public discovery permission is separate from authentication and noindex. */
export const ALLOWED_AI_AGENTS = [
  "OAI-SearchBot", "ChatGPT-User", "GPTBot", "PerplexityBot", "Perplexity-User",
  "Claude-SearchBot", "Claude-User", "ClaudeBot", "Claude-Web", "anthropic-ai",
  "Google-Extended", "GoogleOther", "Applebot-Extended", "Amazonbot", "DuckAssistBot",
  "Meta-ExternalAgent", "Meta-ExternalFetcher", "Bytespider", "cohere-ai",
  "cohere-training-data-crawler", "CCBot",
] as const;

export const BLOCKED_SCRAPERS = [
  "AhrefsBot", "SemrushBot", "MJ12bot", "DotBot", "PetalBot", "BLEXBot",
  "DataForSeoBot", "SeznamBot", "Diffbot", "ImagesiftBot", "Omgilibot", "Omgili",
] as const;

export const PRIVATE_CRAWL_PATHS = [
  "/dashboard", "/admin", "/staff", "/internal", "/ops", "/console", "/manage",
  "/login", "/signup", "/logout", "/reset-password", "/verify", "/oauth", "/callback",
  "/checkout", "/cart", "/account", "/wishlist", "/auth", "/api/", "/webhooks/",
  "/search", "/track-order", "/order-confirmation",
] as const;

export function buildRobotsTxt(baseUrl: string): string {
  const base = new URL(baseUrl).origin;
  // Consecutive agents share one group: explicit agents inherit these restrictions.
  const publicAgents = [...ALLOWED_AI_AGENTS, "Googlebot", "Bingbot", "DuckDuckBot",
    "Slurp", "YandexBot", "Applebot", "Twitterbot", "facebookexternalhit",
    "FacebookBot", "LinkedInBot", "WhatsApp", "*"];
  return `# ${new URL(base).hostname} - public search and AI crawler access\n` +
    "# AI search, user retrieval and named AI training crawlers are allowed.\n" +
    "# Robots rules are not authentication or an indexing guarantee.\n\n" +
    publicAgents.map(agent => `User-agent: ${agent}`).join("\n") + "\nAllow: /\n" +
    PRIVATE_CRAWL_PATHS.map(path => `Disallow: ${path}`).join("\n") + "\n\n" +
    BLOCKED_SCRAPERS.map(agent => `User-agent: ${agent}\nDisallow: /`).join("\n\n") +
    `\n\nSitemap: ${base}/sitemap.xml\n`;
}