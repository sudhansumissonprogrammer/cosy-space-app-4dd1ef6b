// supabase/functions/jd-stock-sync/index.ts
//
// Periodic stock sync: source store (shodfedf.jdwebshop.com) → our catalog.
//
// Design (no realtime, no checkout-time check — by product decision):
//   • Runs every 15 min via pg_cron.
//   • Each run refreshes:
//       1. HOT set  — products ordered/viewed in the last 24h (always checked)
//       2. ROTATING set — the least-recently-synced products (oldest
//          `source_synced_at` first), CHUNK_SIZE per run. With ~2.6k products
//          and 900/run, every product is refreshed at least every ~45 min.
//   • Matching is by `slug` — our slugs are identical to the source's.
//
// Safety rules (important):
//   • Stock is ONLY written on a valid 200 response with a numeric quantity.
//     Any 403 / timeout / parse error → product is skipped entirely, so a
//     source outage can never blank the store.
//   • Concurrency capped at 6 (their WAF 403s above ~10 parallel).
//   • `source_synced_at` is only bumped for products we actually verified,
//     so failures naturally retry on the next run.
//   • Writes stock_quantity + is_active (delisted) ONLY. Prices untouched.
//   • Kill switch: stores.source_sync_enabled = false stops everything.
//
// Auth: requires header `x-cron-key` matching the token in public.cron_auth.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-cron-key",
};

const SOURCE_BASE = "https://byeetjlpwzpy.jdwebnship.in/api";
const SOURCE_HASH = "360080b0b7289a6080e92018585cf114";
const SOURCE_API_KEY = "9e5a4f4b49da226ab3b1bc396020bf831cb3c14584ced963";
const SOURCE_ORIGIN = "https://shodfedf.jdwebshop.com";

/** Products per run. The source enforces a HARD rolling quota of 200 requests
 *  per 15-minute window (`x-ratelimit-limit: 200`, reset ~900s), shared with
 *  the catalog sync. At the previous 1000/run every window was burned in the
 *  first run and ~all later lookups came back 403 → stock updates went dark.
 *  150/run at a 5-minute cron rotates the ~15k jdwebship catalog in ~9h while
 *  failures stay harmless (403/timeout → product skipped, never zeroed). */
const CHUNK_SIZE = 150;
const CONCURRENCY = 2;
/** Lookups per throttle-check batch. */
const THROTTLE_BATCH = 30;
/** Abort the run when a batch fails above this rate — the supplier quota is
 *  exhausted, so the remaining products keep their old timestamp and are
 *  retried first next run instead of being burned on guaranteed 403s. */
const THROTTLE_ABORT_RATE = 0.6;
/** Failed lookups are pushed back only this far (minutes) instead of a whole
 *  rotation, so throttled products get re-checked quickly. */
const RETRY_BACKOFF_MIN = 240;

/** Minimum gap between requests inside one worker — politeness throttle. */
const REQ_GAP_MS = 250;
/** Max throttled lookups retried in the slow second pass (time budget). */
const MAX_RETRY = 10;
const REQ_TIMEOUT_MS = 12_000;
/** Products with source quantity <= this are treated as sold out. */
const OOS_THRESHOLD = 0;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface SourceStock {
  quantity: number;
  delisted: boolean;
}

/**
 * `key` is the source SKU (`products.source_id`) when we have it — the stable
 * identifier — otherwise the slug, which the source also accepts.
 */
async function fetchSourceStock(key: string): Promise<SourceStock | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQ_TIMEOUT_MS);
  try {
    const res = await fetch(`${SOURCE_BASE}/products/${SOURCE_HASH}/${encodeURIComponent(key)}`, {
      headers: {
        "API-KEY": SOURCE_API_KEY,
        Origin: SOURCE_ORIGIN,
        Referer: `${SOURCE_ORIGIN}/`,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        Accept: "application/json",
      },
      signal: ctrl.signal,
    });
    if (!res.ok) return null; // 403 / 404 / 5xx → skip, never zero stock
    const body = await res.json().catch(() => null);
    if (!body) return null;
    const p = (body.data ?? body)?.product ?? body.data ?? body;
    if (!p || typeof p !== "object") return null;

    const rec = p as Record<string, unknown>;
    const rawQty = rec.quantity;
    const qty = typeof rawQty === "number" ? rawQty : Number(rawQty);
    const variations = Array.isArray(rec.variations) ? (rec.variations as Record<string, unknown>[]) : [];
    const varStock = variations.reduce(
      (s, v) => s + Math.max(0, Math.floor(Number(v?.stock) || 0)),
      0,
    );
    // Size/variant products always report parent quantity 0 — the real stock is
    // the sum of the variation rows. Without this every variant product would
    // be flipped to "Sold Out".
    if (!Number.isFinite(qty) && variations.length === 0) return null;

    const inStock = Number(rec.in_stock ?? 1);
    const status = Number(rec.product_status ?? 1);
    const effective = Math.max(Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0, varStock);

    return {
      quantity: inStock === 0 ? 0 : effective,
      delisted: status !== 1,
    };
  } catch {
    return null; // network error / timeout → skip
  } finally {
    clearTimeout(t);
  }
}

/** Runs `worker` over `items` with a fixed concurrency ceiling. */
async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await worker(items[i]);
    }
  });
  await Promise.all(runners);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // ── Auth: shared cron key ────────────────────────────────────────────────
  const cronKey = req.headers.get("x-cron-key") || "";
  if (!cronKey) return json({ error: "Unauthorized" }, 401);
  const { data: authRow } = await admin.from("cron_auth").select("secret").eq("secret", cronKey).maybeSingle();
  if (!authRow) return json({ error: "Unauthorized" }, 401);

  const started = Date.now();
  const body = await req.json().catch(() => ({}));
  const chunkSize = Math.min(1500, Math.max(50, Number(body?.chunk) || CHUNK_SIZE));
  const onlyOos = body?.only_oos === true;

  // ── Which stores are synced? ─────────────────────────────────────────────
  const { data: stores, error: storeErr } = await admin
    .from("stores")
    .select("id, slug, custom_domain")
    .eq("source_sync_enabled", true)
    .or("source_platform.is.null,source_platform.eq.jdwebship");
  if (storeErr) return json({ error: storeErr.message }, 500);
  if (!stores?.length) return json({ ok: true, stores: 0, note: "no store has source_sync_enabled" });

  const report: Record<string, unknown>[] = [];

  for (const store of stores) {
    // 1) HOT set — anything ordered in the last 24h for this store.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: hotOrders } = await admin
      .from("order_items")
      .select("product_id, orders!inner(store_id, created_at)")
      .eq("orders.store_id", store.id)
      .gte("orders.created_at", since)
      .limit(500);
    const hotIds = [...new Set((hotOrders || []).map((r) => (r as { product_id: string }).product_id).filter(Boolean))];

    const targets = new Map<string, { id: string; slug: string; source_id: string | null; stock_quantity: number; is_active: boolean }>();

    if (hotIds.length) {
      const { data: hot } = await admin
        .from("products")
        .select("id, slug, source_id, stock_quantity, is_active")
        .eq("store_id", store.id)
        .in("id", hotIds);
      for (const p of hot || []) targets.set(p.id, p as never);
    }

    // 2) ROTATING set — least-recently-synced first (NULLs first).
    //    Scoped to jdwebship rows BEFORE the LIMIT: manual/other-source rows
    //    used to occupy the oldest slots and starve real supplier products.
    //    `only_oos` targets currently sold-out rows instead, used to re-verify
    //    products after a matching bug wrongly zeroed them.
    let rotQuery = admin
      .from("products")
      .select("id, slug, source_id, stock_quantity, is_active")
      .eq("store_id", store.id)
      .eq("source_platform", "jdwebship");
    if (onlyOos) rotQuery = rotQuery.lte("stock_quantity", 0);
    const { data: rot, error: rotErr } = await rotQuery
      .order("source_synced_at", { ascending: true, nullsFirst: true })
      .limit(chunkSize);
    if (rotErr) {
      report.push({ store: store.slug, error: rotErr.message });
      continue;
    }
    for (const p of rot || []) targets.set(p.id, p as never);

    const list = [...targets.values()].filter((p) => !!(p.source_id || p.slug));

    // 3) Fetch source stock with capped concurrency + throttle.
    //    Batched so a throttled window (their 200 req / 15 min quota is shared
    //    with jd-catalog-sync) can abort the run early instead of burning the
    //    whole chunk on 403s — products left untouched keep their old
    //    source_synced_at and are retried first on the very next run.
    const results: { p: typeof list[number]; src: SourceStock | null }[] = [];
    let throttled = false;
    for (let i = 0; i < list.length; i += THROTTLE_BATCH) {
      const batch = list.slice(i, i + THROTTLE_BATCH);
      const out = await mapLimit(batch, CONCURRENCY, async (p) => {
        const src = await fetchSourceStock(p.source_id || p.slug);
        await new Promise((r) => setTimeout(r, REQ_GAP_MS));
        return { p, src };
      });
      results.push(...out);
      const batchFailed = out.filter((r) => !r.src).length;
      if (batchFailed / out.length > THROTTLE_ABORT_RATE) { throttled = true; break; }
    }

    // 3b) One retry pass for throttled lookups (403s come in bursts), run
    // slowly and sequentially so we never make the throttling worse.
    let retried = 0;
    for (const row of results) {
      if (row.src || retried >= MAX_RETRY) continue;
      retried++;
      await new Promise((r) => setTimeout(r, 200));
      row.src = await fetchSourceStock(row.p.source_id || row.p.slug);
    }

    // 4) Apply — only verified rows.
    let checked = 0, failed = 0, changed = 0, nowOos = 0, backInStock = 0, delisted = 0;
    const okIds: string[] = [];
    const failIds: string[] = [];
    const nowIso = new Date().toISOString();
    // Failed lookups still move forward, otherwise permanently-404 products
    // (removed at source) clog the rotation. But they are only pushed back
    // PARTIALLY: a throttled product must not wait a whole rotation with stale
    // stock, so it re-enters the queue after RETRY_BACKOFF_MIN minutes.
    const retryIso = new Date(Date.now() - RETRY_BACKOFF_MIN * 60_000).toISOString();

    for (const { p, src } of results) {
      if (!src) { failed++; failIds.push(p.id); continue; }
      checked++;
      okIds.push(p.id);

      // Delisted / unavailable at source → keep the product visible but Sold
      // Out, so it reappears automatically the moment the source restocks it.
      const nextStock = src.delisted || src.quantity <= OOS_THRESHOLD ? 0 : src.quantity;
      // Utkal Watches hides sold-out supplier watches; they reappear on restock.
      const nextActive = store.slug === "utkalwatches" ? nextStock > 0 : true;


      const stockChanged = (p.stock_quantity ?? 0) !== nextStock;
      const activeChanged = p.is_active !== nextActive;
      if (!stockChanged && !activeChanged) continue;

      const { error: upErr } = await admin
        .from("products")
        .update({ stock_quantity: nextStock, is_active: nextActive, source_synced_at: nowIso })
        .eq("id", p.id);
      if (upErr) { failed++; continue; }

      changed++;
      if (stockChanged && nextStock === 0) nowOos++;
      if (stockChanged && (p.stock_quantity ?? 0) === 0 && nextStock > 0) backInStock++;
      if (activeChanged && !nextActive) delisted++;
    }

    // Bump the sync timestamp (batched): verified rows to now, failed rows to a
    // shorter backoff so the rotation moves forward without hiding stale stock.
    for (const [ids, stamp] of [[okIds, nowIso], [failIds, retryIso]] as const) {
      for (let i = 0; i < ids.length; i += 200) {
        await admin
          .from("products")
          .update({ source_synced_at: stamp })
          .in("id", ids.slice(i, i + 200));
      }
    }



    // 5) Purge the storefront edge cache only when something actually changed.
    let purged = false;
    if (changed > 0) {
      const secret = Deno.env.get("WORKER_PURGE_SECRET") || "";
      if (secret) {
        const domain = (store.custom_domain || "").replace(/^www\./, "").toLowerCase().trim();
        const params = new URLSearchParams({ slug: store.slug });
        if (domain) params.set("domain", domain);
        const bases = [`https://${store.slug}.shopbanao.in`];
        if (domain) bases.push(`https://${domain}`);
        const res = await Promise.allSettled(
          bases.map((b) =>
            fetch(`${b}/api/purge-store?${params}`, {
              method: "POST",
              headers: { "x-purge-secret": secret, "Cache-Control": "no-store" },
            })
          ),
        );
        purged = res.some((r) => r.status === "fulfilled" && r.value.ok);
      }
    }

    report.push({
      store: store.slug,
      targeted: list.length,
      attempted: results.length,
      throttled,
      hot: hotIds.length,
      checked,
      failed,
      changed,
      now_out_of_stock: nowOos,
      back_in_stock: backInStock,
      delisted,
      purged,
    });
  }

  const out = { ok: true, ms: Date.now() - started, stores: report };
  console.log("jd-stock-sync", JSON.stringify(out));
  return json(out);
});
