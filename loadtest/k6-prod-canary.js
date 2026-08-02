/**
 * PRODUCTION-SAFE canary. Read-only, hard-capped at PROD_MAX_VUS (default 20).
 *
 *   BASE_URL=https://serdiyajewellers.shop k6 run loadtest/k6-prod-canary.js
 *   VUS=5 DURATION=5m ...
 *
 * What it does NOT do: no checkout, no order writes, no edge-function POSTs,
 * no pixel/CAPI events, no auth, no cache purges. Every request is a GET on a
 * page a normal shopper would open, at a rate far below organic traffic.
 *
 * Requests carry User-Agent "k6-shopbanao-canary" so they can be excluded from
 * analytics (see docs/LOAD-TESTING-FRAMEWORK.md §6).
 */
import { sleep } from "k6";
import { guard, get, BASE, summaryLine, PROD_MAX_VUS } from "./lib/config.js";

const VUS = Math.min(Number(__ENV.VUS || 5), PROD_MAX_VUS);

export const options = {
  scenarios: {
    canary: {
      executor: "constant-vus",
      vus: VUS,
      duration: __ENV.DURATION || "3m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{kind:html}": ["p(95)<1500"],
    "http_req_duration{kind:asset}": ["p(95)<800"],
    sb_edge_cache_hit: ["rate>0.80"],
  },
  userAgent: "k6-shopbanao-canary",
};

guard("passive");

export default function () {
  get("/", "html");
  sleep(2 + Math.random() * 2);
  get("/products", "html");
  sleep(2 + Math.random() * 3);
  get("/robots.txt", "asset");
  sleep(3 + Math.random() * 4);
}

export function handleSummary(data) {
  return { stdout: summaryLine(data, "production canary (read-only)") };
}
