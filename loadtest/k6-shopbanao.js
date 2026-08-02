/**
 * ShopBanao production load test.
 *
 *   BASE_URL=https://serdiyajewellers.shop k6 run loadtest/k6-shopbanao.js
 *   K6_SCENARIO=ramp|spike|soak|smoke  (default: smoke)
 *
 * Read-only by default. Set WRITE=1 only against a staging store — the
 * checkout scenario mints real pending orders otherwise.
 *
 * While running, sample the DB every 10s (this is where the real ceiling shows):
 *   psql -c "select state, count(*) from pg_stat_activity group by 1"
 */
import http from "k6/http";
import { check, group, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

const BASE = __ENV.BASE_URL || "https://serdiyajewellers.shop";
const SCENARIO = __ENV.K6_SCENARIO || "smoke";
const WRITE = __ENV.WRITE === "1";

const ttfb = new Trend("sb_ttfb", true);
const edgeHit = new Rate("sb_edge_cache_hit");
const originMiss = new Counter("sb_origin_miss");
const checkoutOk = new Rate("sb_checkout_ok");

const PROFILES = {
  smoke: [{ duration: "1m", target: 5 }],
  // Find the knee: step up until connections saturate.
  ramp: [
    { duration: "2m", target: 50 },
    { duration: "3m", target: 150 },
    { duration: "3m", target: 400 },
    { duration: "3m", target: 800 },
    { duration: "2m", target: 0 },
  ],
  // Viral Instagram reel / flash sale: cold cache, vertical arrival.
  spike: [
    { duration: "10s", target: 20 },
    { duration: "20s", target: 1500 },
    { duration: "2m", target: 1500 },
    { duration: "30s", target: 0 },
  ],
  // Memory-leak / KV-churn detection.
  soak: [
    { duration: "5m", target: 120 },
    { duration: "50m", target: 120 },
    { duration: "5m", target: 0 },
  ],
};

export const options = {
  scenarios: {
    shopper: {
      executor: "ramping-vus",
      exec: "shopperJourney",
      stages: PROFILES[SCENARIO] || PROFILES.smoke,
      gracefulRampDown: "30s",
    },
    // Dashboard traffic is the expensive path (213ms mean measured query).
    // Deliberately low VU count — it is meant to compete for connections.
    merchant: {
      executor: "constant-vus",
      exec: "merchantDashboard",
      vus: SCENARIO === "smoke" ? 1 : 10,
      duration: "5m",
      startTime: "30s",
    },
  },
  thresholds: {
    // Pass/fail criteria. Any breach = capacity exceeded.
    http_req_failed: ["rate<0.01"],
    "http_req_duration{kind:html}": ["p(95)<1500", "p(99)<3000"],
    "http_req_duration{kind:api}": ["p(95)<800", "p(99)<2000"],
    "http_req_duration{kind:dashboard}": ["p(95)<2500"],
    sb_edge_cache_hit: ["rate>0.85"],
    sb_checkout_ok: ["rate>0.98"],
  },
};

function get(path, kind) {
  const res = http.get(`${BASE}${path}`, {
    tags: { kind },
    headers: { "User-Agent": "k6-shopbanao-loadtest" },
  });
  ttfb.add(res.timings.waiting);
  const cf = (res.headers["Cf-Cache-Status"] || res.headers["cf-cache-status"] || "").toUpperCase();
  if (cf) {
    edgeHit.add(cf === "HIT");
    if (cf !== "HIT") originMiss.add(1);
  }
  check(res, { [`${kind} 2xx`]: (r) => r.status >= 200 && r.status < 400 });
  return res;
}

/** Landing → category → PDP → cart → checkout, with human pacing. */
export function shopperJourney() {
  group("home", () => {
    get("/", "html");
    get("/api/products", "api");
  });
  sleep(Math.random() * 3 + 1);

  group("browse", () => {
    get("/products", "html");
    get("/api/category?slug=all", "api");
  });
  sleep(Math.random() * 4 + 2);

  group("pdp", () => {
    const list = http.get(`${BASE}/api/products`, { tags: { kind: "api" } });
    let slug = null;
    try {
      const arr = list.json();
      if (Array.isArray(arr) && arr.length) slug = arr[Math.floor(Math.random() * arr.length)].slug;
    } catch (_) {}
    if (slug) {
      get(`/product/${slug}`, "html");
      get(`/api/pdp?slug=${slug}`, "api");
    }
  });
  sleep(Math.random() * 5 + 3);

  // ~30% reach checkout — matches a realistic funnel, not a synthetic 100%.
  if (Math.random() < 0.3) {
    group("checkout", () => {
      const res = get("/checkout", "html");
      checkoutOk.add(res.status < 400);
      if (WRITE) {
        // Only against staging. Real place-order writes pending rows.
        const r = http.post(`${BASE}/api/noop-checkout-probe`, "{}", {
          headers: { "Content-Type": "application/json" },
          tags: { kind: "api" },
        });
        checkoutOk.add(r.status < 500);
      }
    });
  }
  sleep(Math.random() * 2 + 1);
}

/** Merchant dashboard — the connection-hungry path. */
export function merchantDashboard() {
  group("dashboard", () => {
    get("/dashboard", "dashboard");
    get("/dashboard/orders", "dashboard");
    get("/dashboard/products", "dashboard");
  });
  sleep(5);
}

export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.["p(95)"];
  const hit = data.metrics.sb_edge_cache_hit?.values?.rate;
  return {
    stdout:
      `\nShopBanao load test (${SCENARIO})\n` +
      `  p95 duration     : ${p95 ? p95.toFixed(0) : "n/a"} ms\n` +
      `  edge cache hit   : ${hit != null ? (hit * 100).toFixed(1) + "%" : "n/a"}\n` +
      `  origin misses    : ${data.metrics.sb_origin_miss?.values?.count ?? 0}\n` +
      `  failed requests  : ${((data.metrics.http_req_failed?.values?.rate ?? 0) * 100).toFixed(2)}%\n\n` +
      `  Correlate with: psql -c "select state,count(*) from pg_stat_activity group by 1"\n` +
      `  The RPS at which connections hit 60/60 is the real capacity ceiling.\n`,
  };
}
