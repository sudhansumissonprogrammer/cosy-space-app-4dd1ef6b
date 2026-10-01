# Serdiya Jewellers capacity and crash-resistance audit

## What the audit already found

- Cloudflare fronts a Render-hosted Express application, while product images are safely offloaded to Bunny CDN.
- The homepage, product pages, category pages, checkout page, and sitemap return `CF-Cache-Status: DYNAMIC`. Every first-time ad visitor therefore reaches the Render application instead of receiving cached HTML from Cloudflare.
- Public HTML responses are large (roughly 69–150 KB on catalog pages), so crawlers or repeated requests can consume origin CPU and bandwidth quickly.
- Static CSS and JavaScript have long browser caching, but Cloudflare still reports them as dynamic; first-time visitors can unnecessarily reach Render.
- No visible request throttling was found. The site also exposes its Express framework and lacks HSTS, CSP, and Permissions-Policy headers.
- Images are already well cached and are not the likely first bottleneck. The first likely failure is Render request queueing, followed by slow HTML, timeouts, and Cloudflare 5xx responses.

## Safety boundary

I will not deliberately crash the live website. A test that continues until production goes down could block genuine shoppers, trip Cloudflare protections, or affect Render and payment services. The live domain will receive only a small, read-only canary. The true breaking-point test will require a production-sized staging copy.

## Build

1. Add a Python capacity tester for public, read-only pages only.
   - Allowlist the homepage, category pages, and product pages obtained from the public sitemap.
   - Never call checkout actions, cart writes, login, admin, payment, forms, APIs, or POST requests.
   - Model realistic ad traffic with configurable users, requests per second, ramp stages, and shopper pauses.
   - Record response time percentiles, TTFB, throughput, status codes, Cloudflare cache status, Render headers, timeouts, and response sizes.

2. Add non-negotiable safety controls.
   - Recognize `serdiyajewellers.com` and `www.serdiyajewellers.com` as production.
   - Hard-cap live testing at a small canary level with no override.
   - Permit heavy ramp, spike, and soak modes only when explicitly marked staging and when the hostname is not a production hostname.
   - Stop automatically when errors exceed 1%, p95 latency exceeds three times baseline, repeated 5xx responses appear, or the target becomes unhealthy.
   - Use a distinctive test identity so Cloudflare/Render logs can separate synthetic traffic from shoppers.

3. Add staged test profiles.
   - Baseline: one user and sequential requests.
   - Production canary: low-rate, short duration, read-only.
   - Staging ramp: gradual concurrency increases to locate the first degradation point.
   - Staging spike: short ad-traffic burst after the ramp is understood.
   - Staging soak: sustained traffic to reveal memory growth, connection leaks, or slow degradation.

4. Produce a machine-readable result and a human report.
   - Save JSON/CSV measurements and a Markdown summary.
   - State the highest healthy traffic level, first failed stage, failing page type, latency and error changes, and whether responses came from Cloudflare or Render.
   - Do not invent a capacity number before measurements exist.

## Infrastructure changes to validate

These changes belong in the custom Serdiya codebase or Cloudflare/Render configuration, not this ShopBanao repository:

1. Cache anonymous `GET`/`HEAD` responses for `/`, `/product/*`, `/category/*`, static assets, and the sitemap at Cloudflare with a short TTL and stale-while-revalidate; purge when catalog content changes.
2. Never cache personalized cart, account, admin, checkout, or payment responses.
3. Add Cloudflare request limits and managed challenges for abusive catalog traffic, invalid paths, cart/checkout, login, and any expensive API.
4. Lock the Render origin so it cannot be reached by bypassing Cloudflare.
5. Disable the Express identification header and add HSTS, CSP, Permissions-Policy, and appropriate referrer/content-type/frame protections.
6. Add application limits: request timeout, body-size limit, bounded database pool, slow-query logging, graceful overload responses, and lightweight 404 handling.
7. Monitor Render CPU, memory, event-loop delay, restarts, request queueing, database connections, p95/p99 latency, Cloudflare 5xx, and cache-hit ratio during every test.

## Validation sequence

1. Run the baseline and small canary against the live site.
2. Create a staging deployment with the same Render size, database shape, Cloudflare rules, and sanitized data; disable real payments, messages, pixels, and webhooks.
3. Run ramp stages until the automatic stop condition identifies the capacity knee—without continuing to an outage.
4. Apply caching, throttling, and origin protections in the custom site.
5. Repeat the same test and compare before/after results.
6. Run a final low-rate live canary, then keep the tool for pre-ad checks.

## Required input before the heavy run

- A staging URL for the custom site that cannot send real orders, payments, WhatsApp messages, or tracking events.
- Access to the custom website repository or deployment settings is required if you want me to apply the server and Cloudflare fixes; this workspace contains ShopBanao, not that custom application.
