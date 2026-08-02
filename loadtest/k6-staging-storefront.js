/**
 * STAGING ONLY — destructive storefront ramp. Finds the knee of the read path.
 *
 *   TARGET_ENV=staging BASE_URL=https://staging.shopbanao.dev \
 *   K6_SCENARIO=step k6 run loadtest/k6-staging-storefront.js
 *
 * Profiles: smoke | ramp | step | spike | soak  (see lib/config.js)
 * Refuses to start against any production host.
 */
import http from "k6/http";
import { group, sleep } from "k6";
import { Rate } from "k6/metrics";
import { guard, get, BASE, PROFILES, SCENARIO, summaryLine } from "./lib/config.js";

const pdpFound = new Rate("sb_pdp_resolved");
const STORE_SLUG = __ENV.STORE_SLUG || "";
const prefix = STORE_SLUG ? `/store/${STORE_SLUG}` : "";

export const options = {
  scenarios: {
    shopper: {
      executor: "ramping-vus",
      exec: "shopperJourney",
      stages: PROFILES[SCENARIO] || PROFILES.smoke,
      gracefulRampDown: "30s",
    },
    // Dashboard is the connection-hungry path; deliberately low VUs so it
    // competes with shopper traffic for the same 60 Postgres connections.
    merchant: {
      executor: "constant-vus",
      exec: "merchantDashboard",
      vus: SCENARIO === "smoke" ? 1 : Number(__ENV.MERCHANT_VUS || 10),
      duration: __ENV.MERCHANT_DURATION || "5m",
      startTime: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{kind:html}": ["p(95)<1500", "p(99)<3000"],
    "http_req_duration{kind:api}": ["p(95)<800", "p(99)<2000"],
    "http_req_duration{kind:dashboard}": ["p(95)<2500"],
    sb_edge_cache_hit: ["rate>0.85"],
  },
};

guard("destructive");

export function shopperJourney() {
  group("home", () => {
    get(`${prefix}/`, "html");
  });
  sleep(Math.random() * 3 + 1);

  group("browse", () => {
    get(`${prefix}/products`, "html");
  });
  sleep(Math.random() * 4 + 2);

  group("pdp", () => {
    const slug = pickProductSlug();
    pdpFound.add(!!slug);
    if (slug) get(`${prefix}/product/${slug}`, "html");
  });
  sleep(Math.random() * 5 + 3);

  group("cart", () => {
    get(`${prefix}/cart`, "html");
  });
  sleep(Math.random() * 2 + 1);
}

export function merchantDashboard() {
  group("dashboard", () => {
    get("/dashboard", "dashboard");
    get("/dashboard/orders", "dashboard");
    get("/dashboard/products", "dashboard");
  });
  sleep(5);
}

/** Reads the seeded slug list produced by loadtest/data/seed-staging.sql. */
const SLUGS = (__ENV.PRODUCT_SLUGS || "").split(",").filter(Boolean);
function pickProductSlug() {
  if (SLUGS.length) return SLUGS[Math.floor(Math.random() * SLUGS.length)];
  const res = http.get(`${BASE}/sitemap.xml`, { tags: { kind: "api" } });
  const m = /\/product\/([a-z0-9-]+)/i.exec(res.body || "");
  return m ? m[1] : null;
}

export function handleSummary(data) {
  return { stdout: summaryLine(data, "staging storefront ramp") };
}
