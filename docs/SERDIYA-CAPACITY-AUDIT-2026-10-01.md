# Serdiya Jewellers capacity audit — 2026-10-01

## Scope and safety

This audit used passive headers, public pages, the public sitemap, and a six-request sequential baseline. It did not submit forms, create carts or orders, call payment services, access accounts/admin, or attempt to interrupt the live site.

## Observed architecture

- Cloudflare fronts a Render-hosted Express application.
- Product images use Bunny CDN and have long-lived caching.
- Public HTML is rendered by the application and currently reports `CF-Cache-Status: DYNAMIC`.
- Public catalog pages are enumerable through the sitemap, as expected for search visibility.

## Confirmed findings

### High: anonymous HTML bypasses Cloudflare cache

The homepage, product/category pages, checkout page, and sitemap were observed as dynamic, without useful public HTML cache directives. Ad visitors and crawlers therefore reach Render for every HTML request. This is the most likely first capacity bottleneck.

Recommended fix: cache only anonymous `GET` and `HEAD` responses for `/`, `/product/*`, `/category/*`, and `/sitemap.xml` for a short period with stale-while-revalidate. Purge these pages after catalog changes. Never cache cart, account, admin, checkout, payment, or personalized responses.

### High: no visible request throttling

Passive requests showed no visible throttling response. Add Cloudflare managed challenges or request limits for abusive catalog traffic, invalid paths, login, cart/checkout, and expensive APIs. Limits should tolerate real ad bursts and avoid blocking legitimate shoppers behind shared mobile IPs.

### Medium: single-origin resilience

Because HTML is origin-bound, Render queueing, cold starts, memory pressure, or database waits can turn directly into slower pages and Cloudflare 5xx responses. Confirm that the Render origin cannot be reached outside Cloudflare. Configure bounded database connections, application timeouts, graceful overload responses, and autoscaling appropriate to the expected campaign peak.

### Medium: missing response hardening

Add HSTS, a tested Content Security Policy, and Permissions-Policy. Keep the existing content-type, frame, and referrer protections. Disable the `X-Powered-By: Express` response header.

### Low: expensive unmatched pages

Unknown paths return a full branded HTML page. Use a small, cacheable 404 response so scanners cannot consume full page-rendering work for arbitrary URLs.

### Healthy: image delivery

Images are already served by Bunny CDN with long caching. Image delivery is unlikely to be the first server bottleneck and should not be included in origin-capacity conclusions.

## Live baseline

Run at 2026-10-01 15:33 UTC using `baseline`:

- Six public catalog requests over 12 seconds
- Target rate: 0.5 requests/second
- Actual rate: 0.50 requests/second
- p95 total response time: 393 ms
- p95 time to first byte: 392 ms
- HTTP error rate: 0.00%
- Cloudflare edge-cache hit rate: 0.0%

This shows the site is healthy at negligible traffic. It does not establish campaign capacity. The zero edge-cache rate confirms that Render remains involved in these page views.

## Maximum production-safe canary

Run at 2026-10-01 15:41 UTC using `canary`:

- 30 public catalog requests over 30 seconds
- Two concurrent workers
- Target and actual rate: 1.00 request/second
- p95 total response time: 806 ms
- p95 time to first byte: 800 ms
- HTTP error rate: 0.00%
- Cloudflare edge-cache hit rate: 0.0%

The site remained available, but p95 latency was approximately 2.05 times the 393 ms baseline while all HTML still reached the origin. This is an early warning of variable origin response time, not a measured breaking point; the traffic rate was intentionally too low to endanger production.

## Capacity test method

Use `loadtest/python-serdiya-capacity.py`. Production is permanently limited to `baseline` and `canary`. `ramp`, `spike`, and `soak` refuse the production domain and its subdomains, with no override.

The tester automatically stops when:

- error rate exceeds 1%;
- p95 response time exceeds three times the first stage;
- three consecutive 5xx responses occur; or
- requests time out.

It writes request-level CSV, summary JSON, and a Markdown report. Its distinct user agent is `serdiya-capacity-canary/1.0 (owner-authorized; read-only)`.

## Required next step

Create a production-sized staging deployment with the same Render size, database shape, and Cloudflare behavior. Sanitize customer data and disable real orders, payments, WhatsApp, pixels, analytics, and webhooks. Then run ramp, spike, and soak while watching Render CPU/memory/restarts, event-loop delay, request queueing, database connections, p95/p99 latency, Cloudflare 5xx, and cache-hit ratio.

The measured breaking point must come from that run. It is not safe or accurate to manufacture the number by deliberately taking the live store offline.