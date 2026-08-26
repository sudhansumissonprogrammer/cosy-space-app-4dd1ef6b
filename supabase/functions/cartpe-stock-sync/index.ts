// supabase/functions/cartpe-stock-sync/index.ts
//
// Periodic stock + price sync: Cartpe source store → our catalog.
//
// Mirrors `jd-stock-sync`:
//   • HOT set     — products ordered in the last 24h (always re-checked)
//   • ROTATING set — least-recently-synced products, CHUNK_SIZE per run
//   • Stock/price is only written on a valid 200 PDP parse. Any failure skips
//     the product, so a source outage can never blank the store.
//   • Kill switch: stores.source_sync_enabled = false
//   • Store scoping: stores.source_platform = 'cartpe'
//
// Auth: header `x-cron-key` matching a token in public.cron_auth.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-cron-key",
};

const CHUNK_SIZE = 450;
const CONCURRENCY = 5;
const REQ_GAP_MS = 50;
const REQ_TIMEOUT_MS = 12_000;
const TIME_BUDGET_MS = 110_000;
/** Stock number written for "In Stock" products (Cartpe never exposes counts). */
const IN_STOCK_QTY = 50;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function money(raw?: string | null): number | null {
  if (!raw) return null;
  const n = Number(String(raw).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

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

type SourceState = { inStock: boolean; price: number | null; sale: number | null; gone?: boolean };

async function fetchSourceState(url: string): Promise<SourceState | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQ_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
    });
    // 404 = the product was removed from the source catalog. Treating it as a
    // plain failure left permanently-dead items showing as buyable; mark them
    // sold out instead (never delete — the merchant may still want the row).
    if (res.status === 404 || res.status === 410) {
      return { inStock: false, price: null, sale: null, gone: true };
    }
    if (!res.ok) return null;
    const html = await res.text();
    // A valid PDP always has the product name node — otherwise it is an error
    // page / redirect and must not be trusted with stock writes.
    if (!/<h1 class="product-name">/i.test(html)) return null;

    const avail = html.match(/product-availability"[\s\S]{0,120}?<span>([^<]*)</i)?.[1] ?? "";
    if (!avail.trim()) return null;
    const inStock = !/out\s*of\s*stock|sold\s*out/i.test(avail);

    const priceDiv = html.match(/id="price_div"([\s\S]*?)<\/div>/i)?.[1] ?? "";
    const oldP = money(priceDiv.match(/class="old-price"[^>]*>\s*<span>([^<]*)</i)?.[1]);
    const spP = money(priceDiv.match(/class="special-price"[^>]*>\s*<span>([^<]*)</i)?.[1]);
    let price = oldP ?? spP;
    let sale: number | null = null;
    if (oldP && spP && spP < oldP) { price = oldP; sale = spP; }
    else if (spP) { price = spP; }

    return { inStock, price, sale };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const cronKey = req.headers.get("x-cron-key") || "";
  if (!cronKey) return json({ error: "Unauthorized" }, 401);
  const { data: authRow } = await admin.from("cron_auth").select("secret").eq("secret", cronKey).maybeSingle();
  if (!authRow) return json({ error: "Unauthorized" }, 401);

  const started = Date.now();
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const chunkSize = Math.min(1200, Math.max(50, Number((body as any)?.chunk) || CHUNK_SIZE));
  const onlyOos = (body as any)?.only_oos === true;

  const { data: stores, error: storeErr } = await admin
    .from("stores")
    .select("id, slug, custom_domain, source_base_url")
    .eq("source_sync_enabled", true)
    .eq("source_platform", "cartpe");
  if (storeErr) return json({ error: storeErr.message }, 500);
  if (!stores?.length) return json({ ok: true, stores: 0, note: "no cartpe store enabled" });

  const report: Record<string, unknown>[] = [];

  for (const store of stores) {
    const base = String(store.source_base_url || "").replace(/\/+$/, "");
    if (!base) { report.push({ store: store.slug, error: "missing source_base_url" }); continue; }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: hotOrders } = await admin
      .from("order_items")
      .select("product_id, orders!inner(store_id, created_at)")
      .eq("orders.store_id", store.id)
      .gte("orders.created_at", since)
      .limit(500);
    const hotIds = [...new Set((hotOrders || []).map((r) => (r as { product_id: string }).product_id).filter(Boolean))];

    type Row = {
      id: string; slug: string; source_path: string | null; price: number | null;
      sale_price: number | null; stock_quantity: number | null; is_active: boolean;
    };
    const targets = new Map<string, Row>();
    const cols = "id, slug, source_path, price, sale_price, stock_quantity, is_active";

    if (hotIds.length) {
      const { data: hot } = await admin
        .from("products").select(cols).eq("store_id", store.id).in("id", hotIds);
      for (const p of (hot || []) as Row[]) targets.set(p.id, p);
    }

    // Scope the rotating window before LIMIT. Legacy/manual rows without a
    // Cartpe PDP path previously occupied the oldest slots and were filtered
    // only after the query, starving real supplier products of stock checks.
    let rotQuery = admin.from("products").select(cols)
      .eq("store_id", store.id)
      .eq("source_platform", "cartpe")
      .not("source_path", "is", null);
    if (onlyOos) rotQuery = rotQuery.lte("stock_quantity", 0);
    const { data: rot, error: rotErr } = await rotQuery
      .order("source_synced_at", { ascending: true, nullsFirst: true })
      .limit(chunkSize);
    if (rotErr) { report.push({ store: store.slug, error: rotErr.message }); continue; }
    for (const p of (rot || []) as Row[]) targets.set(p.id, p);

    const list = [...targets.values()].filter((p) => !!p.source_path);

    const results = await mapLimit(list, CONCURRENCY, async (p) => {
      if (Date.now() - started > TIME_BUDGET_MS) return { p, src: null as SourceState | null };
      const src = await fetchSourceState(`${base}/${p.source_path}`);
      await new Promise((r) => setTimeout(r, REQ_GAP_MS));
      return { p, src };
    });

    let checked = 0, failed = 0, changed = 0, nowOos = 0, backInStock = 0, priceChanged = 0;
    const touchedIds: string[] = [];
    const nowIso = new Date().toISOString();

    for (const { p, src } of results) {
      touchedIds.push(p.id);
      if (!src) { failed++; continue; }
      checked++;

      const nextStock = src.inStock ? IN_STOCK_QTY : 0;
      const nextPrice = src.price ?? p.price;
      const nextSale = src.price ? src.sale : p.sale_price;

      const stockChanged = (p.stock_quantity ?? 0) !== nextStock;
      const pChanged = Number(p.price ?? 0) !== Number(nextPrice ?? 0) ||
        Number(p.sale_price ?? 0) !== Number(nextSale ?? 0);
      if (!stockChanged && !pChanged) continue;

      const { error: upErr } = await admin
        .from("products")
        .update({
          stock_quantity: nextStock,
          price: nextPrice,
          sale_price: nextSale,
          source_synced_at: nowIso,
        })
        .eq("id", p.id);
      if (upErr) { failed++; continue; }

      changed++;
      if (stockChanged && nextStock === 0) nowOos++;
      if (stockChanged && (p.stock_quantity ?? 0) === 0 && nextStock > 0) backInStock++;
      if (pChanged) priceChanged++;
    }

    for (let i = 0; i < touchedIds.length; i += 200) {
      await admin.from("products").update({ source_synced_at: nowIso }).in("id", touchedIds.slice(i, i + 200));
    }

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
      hot: hotIds.length,
      checked, failed, changed,
      now_out_of_stock: nowOos,
      back_in_stock: backInStock,
      price_changed: priceChanged,
      purged,
    });
  }

  const out = { ok: true, ms: Date.now() - started, stores: report };
  console.log("cartpe-stock-sync", JSON.stringify(out));
  return json(out);
});
