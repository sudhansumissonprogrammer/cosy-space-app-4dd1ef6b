/**
 * STAGING ONLY — isolates Edge Function + Postgres RPC throughput, bypassing
 * the Cloudflare cache entirely. This is where the real ceiling lives.
 *
 *   TARGET_ENV=staging SUPABASE_URL=... SUPABASE_ANON_KEY=... STORE_SLUG=... \
 *   K6_SCENARIO=step k6 run loadtest/k6-staging-edge-functions.js
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";
import { guard, PROFILES, SCENARIO, summaryLine } from "./lib/config.js";

const SUPABASE_URL = (__ENV.SUPABASE_URL || "").replace(/\/$/, "");
const ANON = __ENV.SUPABASE_ANON_KEY || "";
const STORE_SLUG = __ENV.STORE_SLUG || "demo";

const rpcDur = new Trend("sb_rpc_ms", true);
const rpcOk = new Rate("sb_rpc_ok");

export const options = {
  scenarios: {
    rpc: { executor: "ramping-vus", stages: PROFILES[SCENARIO] || PROFILES.smoke, gracefulRampDown: "20s" },
  },
  thresholds: {
    sb_rpc_ok: ["rate>0.99"],
    "sb_rpc_ms{rpc:get_storefront_shell}": ["p(95)<400"],
    "sb_rpc_ms{rpc:get_storefront_products_page}": ["p(95)<600"],
    http_req_failed: ["rate<0.01"],
  },
};

guard("destructive");
if (!SUPABASE_URL || !ANON) throw new Error("Set SUPABASE_URL and SUPABASE_ANON_KEY (staging).");

const headers = {
  "Content-Type": "application/json",
  apikey: ANON,
  Authorization: `Bearer ${ANON}`,
};

function rpc(name, args) {
  const res = http.post(`${SUPABASE_URL}/rest/v1/rpc/${name}`, JSON.stringify(args), {
    headers,
    tags: { kind: "rpc", rpc: name },
  });
  rpcDur.add(res.timings.duration, { rpc: name });
  const ok = res.status === 200;
  rpcOk.add(ok, { rpc: name });
  check(res, { [`${name} 200`]: () => ok });
  return res;
}

export default function () {
  rpc("get_storefront_shell", { _slug: STORE_SLUG, _with_pages: false });
  rpc("get_storefront_products_page", { _slug: STORE_SLUG, _category: null, _sort: "newest", _page: 1, _limit: 24 });
  rpc("get_store_public", { _slug: STORE_SLUG });
  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  return { stdout: summaryLine(data, "staging edge functions + RPCs") };
}
