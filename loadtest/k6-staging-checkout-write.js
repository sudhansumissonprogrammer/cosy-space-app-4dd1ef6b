/**
 * STAGING ONLY — write-path load. Exercises the real order pipeline:
 * checkout token → place-order → payment status polling.
 *
 *   TARGET_ENV=staging BASE_URL=https://staging.shopbanao.dev \
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... STORE_ID=... PRODUCT_ID=... \
 *   K6_SCENARIO=ramp k6 run loadtest/k6-staging-checkout-write.js
 *
 * This mints REAL pending orders and REAL rows in the target database.
 * It refuses to run against production for exactly that reason.
 * Payment gateway must be in sandbox mode on staging — verify before running.
 */
import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";
import { guard, PROFILES, SCENARIO, summaryLine } from "./lib/config.js";

const SUPABASE_URL = (__ENV.SUPABASE_URL || "").replace(/\/$/, "");
const ANON = __ENV.SUPABASE_ANON_KEY || "";
const STORE_ID = __ENV.STORE_ID || "";
const PRODUCT_ID = __ENV.PRODUCT_ID || "";

const placeOk = new Rate("sb_place_order_ok");
const placeDur = new Trend("sb_place_order_ms", true);
const statusOk = new Rate("sb_order_status_ok");

export const options = {
  scenarios: {
    checkout: {
      executor: "ramping-vus",
      stages: PROFILES[SCENARIO] || PROFILES.smoke,
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    sb_place_order_ok: ["rate>0.98"],
    sb_place_order_ms: ["p(95)<2500", "p(99)<5000"],
    http_req_failed: ["rate<0.02"],
  },
};

guard("destructive");

if (!SUPABASE_URL || !ANON || !STORE_ID || !PRODUCT_ID) {
  throw new Error("Set SUPABASE_URL, SUPABASE_ANON_KEY, STORE_ID and PRODUCT_ID (staging values).");
}

const fnHeaders = {
  "Content-Type": "application/json",
  apikey: ANON,
  Authorization: `Bearer ${ANON}`,
};

/** Synthetic phone numbers in a reserved block so they never collide with real leads. */
function syntheticPhone() {
  const n = 100000 + Math.floor(Math.random() * 899999);
  return `90000${String(n).slice(0, 5)}`;
}

export default function () {
  const phone = syntheticPhone();

  group("place-order", () => {
    const body = JSON.stringify({
      store_id: STORE_ID,
      customer_name: `LoadTest ${__VU}-${__ITER}`,
      customer_phone: phone,
      customer_address: "LOADTEST — do not ship",
      customer_city: "Jaipur",
      customer_state: "Rajasthan",
      customer_pincode: "302001",
      payment_method: "cod",
      items: [{ product_id: PRODUCT_ID, quantity: 1 }],
      source: "k6-loadtest",
    });
    const res = http.post(`${SUPABASE_URL}/functions/v1/place-order`, body, {
      headers: fnHeaders,
      tags: { kind: "edgefn", fn: "place-order" },
    });
    placeDur.add(res.timings.duration);
    const ok = res.status === 200;
    placeOk.add(ok);
    check(res, { "place-order 200": () => ok });

    if (ok) {
      let orderId = null;
      try {
        orderId = res.json("order_id") || res.json("order.id");
      } catch (_) {}
      if (orderId) {
        sleep(1);
        const st = http.post(
          `${SUPABASE_URL}/functions/v1/order-payment-status`,
          JSON.stringify({ order_id: orderId }),
          { headers: fnHeaders, tags: { kind: "edgefn", fn: "order-payment-status" } },
        );
        statusOk.add(st.status === 200);
      }
    }
  });

  sleep(Math.random() * 4 + 2);
}

export function handleSummary(data) {
  return {
    stdout:
      summaryLine(data, "staging checkout write path") +
      `  Cleanup: psql -f loadtest/data/cleanup-staging.sql\n`,
  };
}
