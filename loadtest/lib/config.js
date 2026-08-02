/**
 * Shared config + production safety guard for all ShopBanao k6 scripts.
 *
 * SAFETY MODEL
 * ------------
 * Every script declares an intent: "destructive" or "passive".
 *  - destructive → refuses to run unless TARGET_ENV=staging AND the host is
 *    NOT a known production host. There is no override flag by design.
 *  - passive     → allowed on production, but hard-capped at PROD_MAX_VUS.
 *
 * Usage:
 *   import { BASE, guard, get, ttfb, edgeHit, originMiss } from "./lib/config.js";
 *   guard("destructive");
 */
import http from "k6/http";
import { check } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";
import exec from "k6/execution";

export const BASE = (__ENV.BASE_URL || "http://localhost:8080").replace(/\/$/, "");
export const TARGET_ENV = (__ENV.TARGET_ENV || "").toLowerCase();
export const SCENARIO = __ENV.K6_SCENARIO || "smoke";

/** Hosts that must never receive destructive load. Extend as domains are added. */
export const PRODUCTION_HOSTS = [
  "shopbanao.in",
  "www.shopbanao.in",
  "cosy-space-app.lovable.app",
  "serdiyajewellers.shop",
  "imitationworld.in",
];

/** Absolute ceiling for anything pointed at production. */
export const PROD_MAX_VUS = Number(__ENV.PROD_MAX_VUS || 20);

export const ttfb = new Trend("sb_ttfb", true);
export const edgeHit = new Rate("sb_edge_cache_hit");
export const originMiss = new Counter("sb_origin_miss");
export const errorRate = new Rate("sb_errors");

function hostOf(url) {
  const m = /^https?:\/\/([^/:]+)/i.exec(url);
  return m ? m[1].toLowerCase() : "";
}

export function isProductionTarget(url = BASE) {
  const h = hostOf(url);
  return PRODUCTION_HOSTS.some((p) => h === p || h.endsWith("." + p));
}

/**
 * Call at module scope in every script.
 * @param {"destructive"|"passive"} intent
 */
export function guard(intent) {
  const prod = isProductionTarget();

  if (intent === "destructive") {
    if (prod) {
      throw new Error(
        `REFUSED: ${BASE} is a production host. Destructive load tests run on staging only. ` +
          `Clone prod → staging (docs/LOAD-TESTING-FRAMEWORK.md §4) and re-point BASE_URL.`,
      );
    }
    if (TARGET_ENV !== "staging") {
      throw new Error(
        "REFUSED: set TARGET_ENV=staging to acknowledge this is a non-production target.",
      );
    }
  }

  if (intent === "passive" && prod) {
    const vus = exec.test.options.scenarios
      ? Object.values(exec.test.options.scenarios).reduce(
          (m, s) => Math.max(m, s.vus || s.maxVUs || (s.stages || []).reduce((a, b) => Math.max(a, b.target), 0)),
          0,
        )
      : 0;
    if (vus > PROD_MAX_VUS) {
      throw new Error(
        `REFUSED: ${vus} VUs exceeds PROD_MAX_VUS=${PROD_MAX_VUS} for a production target.`,
      );
    }
  }
  return { prod, intent };
}

export function get(path, kind, params = {}) {
  const res = http.get(`${BASE}${path}`, {
    tags: { kind },
    headers: { "User-Agent": "k6-shopbanao-loadtest", ...(params.headers || {}) },
    ...params,
  });
  ttfb.add(res.timings.waiting, { kind });
  const cf = (res.headers["Cf-Cache-Status"] || res.headers["cf-cache-status"] || "").toUpperCase();
  if (cf) {
    edgeHit.add(cf === "HIT", { kind });
    if (cf !== "HIT") originMiss.add(1, { kind });
  }
  const ok = res.status >= 200 && res.status < 400;
  errorRate.add(!ok, { kind });
  check(res, { [`${kind} 2xx/3xx`]: () => ok });
  return res;
}

/** Ramp profiles used by destructive (staging) scripts. */
export const PROFILES = {
  smoke: [{ duration: "1m", target: 5 }],
  ramp: [
    { duration: "2m", target: 50 },
    { duration: "3m", target: 150 },
    { duration: "3m", target: 400 },
    { duration: "3m", target: 800 },
    { duration: "2m", target: 0 },
  ],
  // Step-load: designed to find the knee precisely; hold each step 3m so
  // Postgres connection saturation has time to express itself.
  step: [
    { duration: "1m", target: 25 },
    { duration: "3m", target: 25 },
    { duration: "1m", target: 100 },
    { duration: "3m", target: 100 },
    { duration: "1m", target: 250 },
    { duration: "3m", target: 250 },
    { duration: "1m", target: 500 },
    { duration: "3m", target: 500 },
    { duration: "1m", target: 1000 },
    { duration: "3m", target: 1000 },
    { duration: "2m", target: 0 },
  ],
  spike: [
    { duration: "10s", target: 20 },
    { duration: "20s", target: 1500 },
    { duration: "2m", target: 1500 },
    { duration: "30s", target: 0 },
  ],
  soak: [
    { duration: "5m", target: 120 },
    { duration: "50m", target: 120 },
    { duration: "5m", target: 0 },
  ],
};

export function summaryLine(data, label) {
  const m = data.metrics;
  const p = (k, s) => m[k]?.values?.[s];
  return (
    `\nShopBanao — ${label} (${SCENARIO}) → ${BASE}\n` +
    `  p50 / p95 / p99  : ${(p("http_req_duration", "med") || 0).toFixed(0)} / ` +
    `${(p("http_req_duration", "p(95)") || 0).toFixed(0)} / ` +
    `${(p("http_req_duration", "p(99)") || 0).toFixed(0)} ms\n` +
    `  TTFB p95         : ${(p("sb_ttfb", "p(95)") || 0).toFixed(0)} ms\n` +
    `  edge cache hit   : ${p("sb_edge_cache_hit", "rate") != null ? (p("sb_edge_cache_hit", "rate") * 100).toFixed(1) + "%" : "n/a"}\n` +
    `  origin misses    : ${p("sb_origin_miss", "count") ?? 0}\n` +
    `  req/s            : ${(p("http_reqs", "rate") || 0).toFixed(1)}\n` +
    `  failed requests  : ${((p("http_req_failed", "rate") ?? 0) * 100).toFixed(2)}%\n\n` +
    `  Correlate with loadtest/sql/monitoring.sql sampled by loadtest/scripts/sample-db.sh\n`
  );
}
