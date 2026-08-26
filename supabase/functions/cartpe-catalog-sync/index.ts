// supabase/functions/cartpe-catalog-sync/index.ts
//
// Catalog sync: imports NEW products from a Cartpe storefront
// (e.g. https://thewristlife.cartpe.in) into our catalog.
//
// Companion to `cartpe-stock-sync` (which only refreshes stock/prices of
// products we already have).
//
// How it works
//   • Cartpe has no API. `/allproduct.html` renders the first 24 products and
//     exposes a `web_token`; `/allproductoadmore` (POST) returns the next 24
//     as an HTML fragment for any `getresult` offset. That pair covers the
//     WHOLE catalog, so we walk it page by page (24/page).
//   • Phase `backfill` — walks pages from the stored cursor forward, a budgeted
//     number of pages per run, until it hits the end. Then flips to `steady`.
//   • Phase `steady`  — re-scans the first STEADY_PAGES pages (newest arrivals)
//     each run and imports anything we do not have yet.
//   • Matching: by `source_id` (Cartpe product id from the `-lpiNNNN-` slug)
//     first, then by product NAME, so nothing is ever duplicated.
//   • Only unknown products cost a PDP request (gallery, category, stock).
//
// Safety
//   • Insert-only: never deletes or overwrites existing products.
//   • Any non-200 / parse failure is skipped; nothing is written for it.
//   • Concurrency capped with a request gap.
//   • Kill switch: stores.source_sync_enabled = false.
//   • Store scoping: only stores with source_platform = 'cartpe'.
//   • Wall-clock budget per run so the function never times out mid-page.
//
// Auth: header `x-cron-key` matching a token in public.cron_auth.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-cron-key",
};

const PAGE_SIZE = 24;
/** Listing pages walked per run while backfilling. */
const PAGE_BUDGET = 40;
/** Newest pages re-scanned every run once backfill is done. */
const STEADY_PAGES = 12;
/** Max new products imported per run (each costs one PDP request). */
const IMPORT_BUDGET = 260;
const CONCURRENCY = 4;
const REQ_GAP_MS = 60;
const REQ_TIMEOUT_MS = 15_000;
/** Stop starting new work after this many ms so the run always finishes. */
const TIME_BUDGET_MS = 105_000;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function slugify(s: string) {
  return String(s)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "item";
}

const norm = (s: string) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

function decodeEntities(s: string) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

async function fetchText(
  url: string,
  init: RequestInit & { cookie?: string; referer?: string } = {},
): Promise<{ text: string; setCookie: string | null } | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQ_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,*/*",
        ...(init.cookie ? { Cookie: init.cookie } : {}),
        ...(init.referer ? { Referer: init.referer } : {}),
        ...(init.headers || {}),
      },
    });
    if (!res.ok) return null;
    return { text: await res.text(), setCookie: res.headers.get("set-cookie") };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

type Candidate = {
  sourceId: string;
  sourceSlug: string;
  path: string;
  name: string;
  image: string | null;
  price: number | null;
  sale: number | null;
};

/** Parse the product tiles out of a listing / load-more HTML fragment. */
function parseListing(html: string): Candidate[] {
  const out: Candidate[] = [];
  const blocks = html.split(/<div class="product-item /).slice(1);
  for (const block of blocks) {
    // Cartpe migrated product slugs from `-lpiNNN-` to `-npiNNN-`; matching only
    // the legacy prefix made every new product invisible to the importer.
    const href = block.match(/href="(https?:\/\/[^"]*?\/([a-z0-9-]+)-[ln]pi(\d+)-[a-z0-9-]+\.html)[^"]*"/i);
    if (!href) continue;
    const sourceId = href[3];
    const sourceSlug = href[2];
    let path = "";
    try {
      path = new URL(href[1]).pathname.replace(/^\//, "");
    } catch {
      continue;
    }
    const title =
      block.match(/class="product-item-link"[^>]*>([^<]+)</i)?.[1] ??
      block.match(/title="([^"]+)"/i)?.[1] ??
      "";
    const name = decodeEntities(title);
    if (!name) continue;
    const image = block.match(/class="product-image-photo"[^>]*src="([^"]+)"/i)?.[1] ?? null;
    const oldP = money(block.match(/class="old-price"[^>]*>([^<]*)</i)?.[1]);
    const spP = money(block.match(/class="special-price"[^>]*>([^<]*)</i)?.[1]);
    let price = oldP ?? spP;
    let sale: number | null = null;
    if (oldP && spP && spP < oldP) { price = oldP; sale = spP; }
    else if (spP) { price = spP; }
    out.push({ sourceId, sourceSlug, path, name, image, price, sale });
  }
  return out;
}

type Detail = {
  name: string;
  category: string | null;
  images: string[];
  cover: string | null;
  price: number | null;
  sale: number | null;
  inStock: boolean;
  video: string | null;
};

function parseDetail(html: string): Detail | null {
  const name = decodeEntities(html.match(/<h1 class="product-name">([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  if (!name) return null;
  const category = decodeEntities(
    html.match(/<h1 class="product-name">[\s\S]*?<h2>([\s\S]*?)<\/h2>/i)?.[1] ?? "",
  ) || null;

  const priceDiv = html.match(/id="price_div"([\s\S]*?)<\/div>/i)?.[1] ?? "";
  const oldP = money(priceDiv.match(/class="old-price"[^>]*>\s*<span>([^<]*)</i)?.[1]);
  const spP = money(priceDiv.match(/class="special-price"[^>]*>\s*<span>([^<]*)</i)?.[1]);
  let price = oldP ?? spP;
  let sale: number | null = null;
  if (oldP && spP && spP < oldP) { price = oldP; sale = spP; }
  else if (spP) { price = spP; }

  const avail = html.match(/product-availability"[\s\S]{0,120}?<span>([^<]*)</i)?.[1] ?? "";
  const inStock = !/out\s*of\s*stock|sold\s*out/i.test(avail);

  const gallery: string[] = [];
  const seen = new Set<string>();
  const main = html.match(/class="main-image product-preview-image"[\s\S]*?<img src="([^"]+)"/i)?.[1];
  if (main && !/no_image/i.test(main)) { gallery.push(main); seen.add(main); }
  const re = /data-image="(https:\/\/[^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const u = m[1];
    if (seen.has(u) || /no_image/i.test(u)) continue;
    seen.add(u);
    gallery.push(u);
  }

  // Product video lives in the "View Video" modal at the bottom of the PDP.
  const video =
    html.match(/<video[^>]*>[\s\S]{0,400}?<source[^>]*src="(https?:\/\/[^"]+\.(?:mp4|webm|mov))"/i)?.[1] ??
    html.match(/https?:\/\/cdn\.cartpe\.in\/images\/video_upload\/[^"'\s\\)]+\.(?:mp4|webm|mov)/i)?.[0] ??
    null;

  return { name, category, images: gallery.slice(0, 10), cover: gallery[0] ?? null, price, sale, inStock, video };
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
  const pageBudget = Math.min(120, Math.max(1, Number((body as any)?.pages) || PAGE_BUDGET));
  const importBudget = Math.min(600, Math.max(1, Number((body as any)?.import_budget) || IMPORT_BUDGET));

  const { data: stores, error: storeErr } = await admin
    .from("stores")
    .select("id, slug, currency, custom_domain, source_base_url")
    .eq("source_sync_enabled", true)
    .eq("source_platform", "cartpe");
  if (storeErr) return json({ error: storeErr.message }, 500);
  if (!stores?.length) return json({ ok: true, stores: 0, note: "no cartpe store enabled" });

  const report: Record<string, unknown>[] = [];

  for (const store of stores) {
    const base = String(store.source_base_url || "").replace(/\/+$/, "");
    if (!base) { report.push({ store: store.slug, error: "missing source_base_url" }); continue; }

    // ── Bootstrap: web_token + session cookie ────────────────────────────
    const boot = await fetchText(`${base}/allproduct.html`);
    if (!boot) { report.push({ store: store.slug, error: "bootstrap failed" }); continue; }
    const webToken = boot.text.match(/web_token\s*=\s*"([a-f0-9]{32,})"/i)?.[1] ?? "";
    const cookie = (boot.setCookie || "").split(",").map((c) => c.split(";")[0].trim()).filter(Boolean).join("; ");
    if (!webToken) { report.push({ store: store.slug, error: "web_token not found" }); continue; }
    const totalAtSource = Number(boot.text.match(/total_result_cnt"?>?\s*([0-9]+)/i)?.[1] || 0) || null;

    // ── State ────────────────────────────────────────────────────────────
    const { data: stateRow } = await admin
      .from("jd_sync_state")
      .select("phase, page_cursor, imported_total")
      .eq("store_id", store.id)
      .maybeSingle();
    const phase = (stateRow?.phase as string) || "backfill";
    const startPage = Math.max(1, Number(stateRow?.page_cursor) || 1);

    // ── Categories at source → make sure ours exist ──────────────────────
    const catByName = new Map<string, string>();
    const { data: existingCats } = await admin
      .from("categories").select("id, name").eq("store_id", store.id);
    for (const c of existingCats || []) catByName.set(norm(c.name), c.id);

    const catSlugs: string[] = [];
    const catPage = await fetchText(`${base}/allcategory.html`, { cookie });
    if (catPage) {
      const blocks = catPage.text.split(/<a class="category-block"/).slice(1);
      let order = 1;
      for (const b of blocks) {
        const href = b.match(/href="https?:\/\/[^"]*?\/([^"\/]+)\.html"/i)?.[1];
        if (href && !catSlugs.includes(href)) catSlugs.push(href);
        const img = b.match(/<img src="([^"]+)"/i)?.[1] ?? null;
        const title = decodeEntities(b.match(/class="category-title"[^>]*>([\s\S]*?)<\/div>/i)?.[1]?.replace(/<[^>]+>/g, " ") ?? "");
        if (!title) continue;
        const key = norm(title);
        if (catByName.has(key)) { order++; continue; }

        const { data: newCat } = await admin
          .from("categories")
          .insert({
            store_id: store.id,
            name: title,
            slug: slugify(title),
            image_url: img && !/no_image/i.test(img) ? img : null,
            display_order: order,
            show_on_home: true,
          })
          .select("id")
          .maybeSingle();
        if (newCat?.id) catByName.set(key, newCat.id);
        order++;
      }
    }

    // ── Walk listing pages ───────────────────────────────────────────────
    // The global /allproduct feed stops early (~2.6k), so we page through each
    // category feed (/store_product_loadmore, 12 per page) — their union is the
    // complete catalog. Pages are indexed globally across categories so the
    // stored cursor can resume anywhere.
    const CAT_PAGE = 12;
    const segments: { slug: string; pages: number }[] = [];
    for (const cslug of catSlugs) {
      const first = await fetchText(`${base}/${cslug}.html`, { cookie });
      if (!first) continue;
      const total = Number(first.text.match(/total_result_cnt"?>?\s*([0-9]+)/i)?.[1] || 0);
      if (!total) continue;
      segments.push({ slug: cslug, pages: Math.ceil(total / CAT_PAGE) });
    }
    const totalPages = segments.reduce((a, s) => a + s.pages, 0);

    const locate = (globalPage: number) => {
      let n = globalPage;
      for (const s of segments) {
        if (n <= s.pages) return { slug: s.slug, offset: (n - 1) * CAT_PAGE };
        n -= s.pages;
      }
      return null;
    };

    const pagesToWalk = phase === "backfill" ? pageBudget : STEADY_PAGES;
    const found = new Map<string, Candidate>();
    let page = startPage;

    let pagesWalked = 0;
    let reachedEnd = false;
    let listErrors = 0;

    while (
      pagesWalked < pagesToWalk &&
      Date.now() - started < TIME_BUDGET_MS &&
      found.size < importBudget
    ) {
      const loc = locate(page);
      if (!loc) { reachedEnd = true; break; }
      const form = new URLSearchParams({
        getresult: String(loc.offset),
        category_slug: loc.slug,
        searchkeyword: "",
        orderby: "",
        min_price: "",
        max_price: "",
        size_ids: "",
        variant_status: "0",
        web_token: webToken,
      });
      const res = await fetchText(`${base}/store_product_loadmore`, {
        method: "POST",
        cookie,
        referer: `${base}/${loc.slug}.html`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: form.toString(),
      });
      const html = res?.text ?? null;
      if (html == null) { listErrors++; page++; pagesWalked++; await new Promise((r) => setTimeout(r, 250)); continue; }

      for (const it of parseListing(html)) if (!found.has(it.sourceId)) found.set(it.sourceId, it);
      page++;
      pagesWalked++;
      if (page > totalPages) { reachedEnd = true; break; }
      await new Promise((r) => setTimeout(r, REQ_GAP_MS));
    }


    // ── Filter out what we already have ──────────────────────────────────
    const ids = [...found.keys()];
    const knownIds = new Set<string>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await admin
        .from("products").select("id, source_id")
        .eq("store_id", store.id).in("source_id", ids.slice(i, i + 200));
      for (const r of data || []) if (r.source_id) knownIds.add(String(r.source_id));
    }
    // PostgREST caps each response (commonly at 1,000 rows), even when a
    // larger limit is requested. Page the full catalog so products beyond the
    // first response are not mistaken for new and retried on every cron run.
    const allNames: { name: string; slug: string }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin
        .from("products")
        .select("name, slug")
        .eq("store_id", store.id)
        .range(from, from + 999);
      if (error) break;
      allNames.push(...((data || []) as { name: string; slug: string }[]));
      if (!data || data.length < 1000) break;
    }
    const knownName = new Set(allNames.map((r) => norm(r.name)));
    const knownSlug = new Set(allNames.map((r) => r.slug));

    const candidates = [...found.values()]
      .filter((c) => !knownIds.has(c.sourceId))
      .filter((c) => !knownName.has(norm(c.name)))
      .slice(0, importBudget);


    // ── PDP details for the new ones ─────────────────────────────────────
    const detailed = await mapLimit(candidates, CONCURRENCY, async (c) => {
      if (Date.now() - started > TIME_BUDGET_MS + 20_000) return { c, d: null as Detail | null };
      const res = await fetchText(`${base}/${c.path}`, { cookie, referer: `${base}/allproduct.html` });
      await new Promise((r) => setTimeout(r, REQ_GAP_MS));
      return { c, d: res ? parseDetail(res.text) : null };
    });

    // ── Build rows ───────────────────────────────────────────────────────
    const rows: Record<string, unknown>[] = [];
    const galleries: Record<string, string[]> = {};
    let detailFails = 0;
    for (const { c, d } of detailed) {
      if (!d) detailFails++;
      const name = d?.name || c.name;
      const baseSlug = (c.sourceSlug || slugify(name)).slice(0, 70);
      let slug = baseSlug;
      if (knownSlug.has(slug)) slug = `${baseSlug}-${c.sourceId}`;
      let guard = 2;
      while (knownSlug.has(slug) && guard < 12) slug = `${baseSlug}-${c.sourceId}-${guard++}`;
      if (knownSlug.has(slug)) continue;
      knownSlug.add(slug);


      const price = d?.price ?? c.price ?? 0;
      const sale = d?.sale ?? c.sale ?? null;
      const cover = d?.cover || c.image || null;
      const categoryName = d?.category || null;
      if (categoryName && !catByName.has(norm(categoryName))) {
        const { data: newCat } = await admin
          .from("categories")
          .insert({
            store_id: store.id, name: categoryName, slug: slugify(categoryName),
            display_order: 99, show_on_home: true,
          })
          .select("id").maybeSingle();
        if (newCat?.id) catByName.set(norm(categoryName), newCat.id);
      }

      rows.push({
        store_id: store.id,
        name,
        slug,
        description: null,
        price,
        sale_price: sale,
        currency: store.currency || "INR",
        stock_quantity: d ? (d.inStock ? 50 : 0) : 0,
        is_active: true,
        image_url: cover,
        image_alt: name,
        video_url: d?.video ?? null,
        video_poster_url: d?.video ? cover : null,
        category: categoryName,
        source_id: c.sourceId,
        source_path: c.path,
        source_platform: "cartpe",
        source_synced_at: new Date().toISOString(),
      });
      galleries[slug] = (d?.images || []).filter(Boolean).slice(0, 8);
    }

    // ── Insert ───────────────────────────────────────────────────────────
    let imported = 0;
    const imgRows: Record<string, unknown>[] = [];
    const collect = (data: { id: string; slug: string; name: string }[] | null) => {
      for (const p of data || []) {
        (galleries[p.slug] || []).forEach((u, j) => {
          imgRows.push({ product_id: p.id, image_url: u, display_order: j, image_alt: p.name });
        });
      }
      imported += data?.length || 0;
    };
    for (let i = 0; i < rows.length; i += 50) {
      const chunk = rows.slice(i, i + 50);
      const { data, error } = await admin.from("products").insert(chunk).select("id, slug, name");
      if (!error) { collect(data as never); continue; }
      // One bad row must not drop the whole chunk — retry row by row.
      console.error("cartpe-catalog-sync chunk insert", error.message);
      for (const row of chunk) {
        const { data: one, error: e1 } = await admin
          .from("products").insert(row).select("id, slug, name");
        if (e1) console.error("cartpe-catalog-sync row insert", row.slug, e1.message);
        else collect(one as never);
      }
    }

    for (let i = 0; i < imgRows.length; i += 200) {
      await admin.from("product_images").insert(imgRows.slice(i, i + 200));
    }

    // ── Advance cursor / phase ───────────────────────────────────────────
    // Completeness is measured against products we imported FROM cartpe only.
    // Counting every product (manual imports, hand-added items) inflated the
    // total and made a grown source catalog look already-synced.
    const { count: ourCount } = await admin
      .from("products").select("id", { count: "exact", head: true })
      .eq("store_id", store.id).eq("source_platform", "cartpe");
    let nextPhase = phase;
    let nextCursor = 1;
    if (phase === "backfill") {
      if (reachedEnd) {
        const complete = totalAtSource ? (ourCount || 0) >= totalAtSource - 5 : true;
        nextPhase = complete ? "steady" : "backfill";
        nextCursor = 1;
      } else nextCursor = page;
    } else {
      // Steady rotates a small window across the WHOLE page space, so every
      // category gets re-checked over time instead of only the first pages.
      nextCursor = reachedEnd || (totalPages && page > totalPages) ? 1 : page;
      // Source grew beyond what we hold → go back to a full backfill walk.
      if (totalAtSource && (ourCount || 0) < totalAtSource - 5) {
        nextPhase = "backfill";
        nextCursor = 1;
      }
    }




    const result = {
      phase,
      next_phase: nextPhase,
      from_page: startPage,
      pages_walked: pagesWalked,
      list_errors: listErrors,
      seen: found.size,
      candidates: candidates.length,
      detail_failures: detailFails,
      imported,
      images: imgRows.length,
      reached_end: reachedEnd,
      total_at_source: totalAtSource,
    };

    await admin.from("jd_sync_state").upsert({
      store_id: store.id,
      phase: nextPhase,
      page_cursor: nextCursor,
      last_run_at: new Date().toISOString(),
      last_result: result,
      imported_total: (Number(stateRow?.imported_total) || 0) + imported,
      updated_at: new Date().toISOString(),
    }, { onConflict: "store_id" });

    // ── Purge storefront edge cache when the catalog changed ─────────────
    let purged = false;
    if (imported > 0) {
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

    report.push({ store: store.slug, ...result, purged });
  }

  const out = { ok: true, ms: Date.now() - started, stores: report };
  console.log("cartpe-catalog-sync", JSON.stringify(out));
  return json(out);
});
