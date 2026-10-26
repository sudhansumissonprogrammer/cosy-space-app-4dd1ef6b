// supabase/functions/jd-catalog-sync/index.ts
//
// Catalog sync: imports NEW products from the source store
// (shodfedf.jdwebshop.com / jdwebnship API) into our catalog.
//
// Companion to `jd-stock-sync` (which only refreshes stock of products we
// already have). This function is what makes the two catalogs behave like a
// single site: anything they add shows up here automatically.
//
// How it works
//   • The source exposes a paginated "recently added" listing, 12 per page,
//     covering the WHOLE catalog (page 1 = newest). There is no bulk export.
//   • Phase `backfill` — walks pages from the stored cursor forward, a budgeted
//     number of pages per run, until it hits the end of the catalog. Then it
//     flips to `steady`.
//   • Phase `steady`  — every run re-scans the first STEADY_PAGES pages (the
//     newest arrivals) and imports anything we do not have yet.
//   • Matching: by `source_id` (their SKU) first, then by product NAME so the
//     2,615 products imported before this function existed get their
//     `source_id` backfilled instead of being duplicated.
//   • Only unknown products cost a detail request (slug, gallery, category).
//
// Safety
//   • Never deletes or overwrites existing products — insert-only.
//   • Any non-200 / timeout from the source is skipped; nothing is written.
//   • Concurrency capped at 4 with a request gap (their WAF 403s on bursts).
//   • Kill switch: stores.source_sync_enabled = false.
//   • Wall-clock budget per run so the function never times out mid-page.
//
// Auth: header `x-cron-key` matching a token in public.cron_auth.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-cron-key",
};

const SOURCE_BASE = "https://byeetjlpwzpy.jdwebnship.in/api";
const SOURCE_HASH = "360080b0b7289a6080e92018585cf114";
const SOURCE_API_KEY = "9e5a4f4b49da226ab3b1bc396020bf831cb3c14584ced963";
const SOURCE_ORIGIN = "https://shodfedf.jdwebshop.com";
/** Extra reseller storefronts on the same JD backend. The listing endpoint is
 *  tenant-scoped by Origin, so each one exposes SKUs the primary store does not
 *  carry; product detail + stock resolve on any origin, so discovery only. */
const EXTRA_ORIGINS = ["https://fashionshub.co.in"];
/** Listing pages walked per extra origin each run (their catalogs are small). */
const EXTRA_PAGES = 2;
const ASSETS = "https://assets.jdwebnship.in/";

/** Pages of the listing walked per run while backfilling. The source enforces
 *  a hard 200 requests / 15 min rolling quota shared with jd-stock-sync, so the
 *  per-run budgets stay small and the cron runs every 15 minutes. */
const PAGE_BUDGET = 10;
/** Listing pages fetched in parallel (their WAF tolerates ~6). */
const PAGE_CONCURRENCY = 2;
/** Newest pages re-scanned every run once backfill is done. */
const STEADY_PAGES = 8;
/** Deep-sweep pages walked per steady run from a rotating cursor. The newest
 *  pages alone can never recover products that were missed during backfill
 *  (listing 403s, name-match skips, supplier re-inserts), so every run also
 *  walks a moving window deeper into the catalog and wraps at the end. */
const DEEP_PAGES = 10;
/** Max new products imported in one run (each costs 1 detail request). */
const IMPORT_BUDGET = 30;
const CONCURRENCY = 3;
const REQ_GAP_MS = 100;
const REQ_TIMEOUT_MS = 12_000;
/** Stop starting new work after this many ms so the run always finishes. */
const TIME_BUDGET_MS = 105_000;


function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const headersFor = (origin: string) => ({
  "API-KEY": SOURCE_API_KEY,
  Origin: origin,
  Referer: `${origin}/`,
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
  Accept: "application/json",
});

async function srcFetch(path: string, origin: string = SOURCE_ORIGIN): Promise<any | null> {
  // The wholesaler applies a rolling burst limit shared by catalog and stock
  // requests. Retry throttled/transient responses with backoff; returning null
  // after one 403 previously made valid in-stock products look permanently
  // absent from the import walk.
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), REQ_TIMEOUT_MS);
    try {
      const res = await fetch(`${SOURCE_BASE}/${path}`, { headers: headersFor(origin), signal: ctrl.signal });
      if (res.ok) return await res.json().catch(() => null);
      if (![403, 429, 500, 502, 503, 504].includes(res.status)) return null;
    } catch {
      // Retry timeout/network failures below.
    } finally {
      clearTimeout(t);
    }
    await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
  }
  return null;
}

interface ListItem {
  id: string;
  name: string;
  quantity: number;
  sourcePage?: number;
  /** Page this item came from during the steady-phase deep sweep. */
  deepPage?: number;
}

async function fetchListPage(page: number, origin: string = SOURCE_ORIGIN): Promise<ListItem[] | null> {
  // The source renamed this route (old `products/v2/recent` now 404s), which
  // silently stopped every catalog import. Try the current retailer route
  // first and keep the legacy one as a fallback in case they revert.
  let body = await srcFetch(`products/v2/retailer/recent?sortBy=recently_added&page=${page}`, origin);
  if (!Array.isArray(body?.data)) {
    body = await srcFetch(`products/v2/recent?sortBy=recently_added&page=${page}`, origin);
  }
  const data = body?.data;
  if (!Array.isArray(data)) return null;
  return data
    .filter((p: any) => p && p.id && p.name)
    .map((p: any) => ({ id: String(p.id), name: String(p.name), quantity: Number(p.quantity) || 0 }));
}

async function fetchDetail(sku: string): Promise<any | null> {
  const body = await srcFetch(`products/${SOURCE_HASH}/${encodeURIComponent(sku)}`);
  const p = body?.data;
  if (!p || typeof p !== "object" || !p.slug) return null;
  return p;
}

async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const i = cursor++;
        if (i >= items.length) return;
        out[i] = await worker(items[i]);
        await new Promise((r) => setTimeout(r, REQ_GAP_MS));
      }
    }),
  );
  return out;
}

const assetUrl = (p?: string | null): string | null => {
  if (!p) return null;
  const s = String(p).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return ASSETS + s.replace(/^\/+/, "");
};

const videoAssetUrl = (p?: string | null): string | null => {
  const raw = assetUrl(p);
  if (!raw) return null;
  const start = Math.max(raw.lastIndexOf("https://"), raw.lastIndexOf("http://"));
  const normalized = start > 0 ? raw.slice(start) : raw;
  try {
    const parsed = new URL(normalized);
    return /\.(mp4|m4v|mov|webm)$/i.test(parsed.pathname) ? parsed.toString() : null;
  } catch {
    return null;
  }
};

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90) || "product";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cronKey = req.headers.get("x-cron-key") || "";
  if (!cronKey) return json({ error: "Unauthorized" }, 401);
  const { data: authRow } = await admin.from("cron_auth").select("secret").eq("secret", cronKey).maybeSingle();
  if (!authRow) return json({ error: "Unauthorized" }, 401);

  const started = Date.now();
  const body = await req.json().catch(() => ({}));
  /** `reset` restarts a full catalog walk from page 1. */
  const reset = body?.reset === true;
  const pageBudget = Math.min(200, Math.max(1, Number(body?.pages) || PAGE_BUDGET));
  const importBudget = Math.min(1200, Math.max(10, Number(body?.limit) || IMPORT_BUDGET));

  const { data: stores, error: storeErr } = await admin
    .from("stores")
    .select("id, slug, custom_domain, currency")
    .eq("source_sync_enabled", true)
    .or("source_platform.is.null,source_platform.eq.jdwebship");
  if (storeErr) return json({ error: storeErr.message }, 500);
  if (!stores?.length) return json({ ok: true, stores: 0, note: "no store has source_sync_enabled" });

  // Source sub-category map (id → name), fetched once per run.
  const catBody = await srcFetch("products/categories");
  const subCats = new Map<number, { name: string; image: string | null }>();
  for (const c of catBody?.data?.sub_categories || []) {
    if (c?.sub_category_id != null && c?.sub_category_name) {
      subCats.set(Number(c.sub_category_id), {
        name: String(c.sub_category_name),
        image: assetUrl(c.sub_category_image),
      });
    }
  }

  const report: Record<string, unknown>[] = [];

  for (const store of stores) {
    // ── State ────────────────────────────────────────────────────────────
    const { data: stateRow } = await admin
      .from("jd_sync_state")
      .select("*")
      .eq("store_id", store.id)
      .maybeSingle();

    let phase: string = reset ? "backfill" : (stateRow?.phase || "backfill");
    let cursor: number = reset ? 1 : Math.max(1, Number(stateRow?.page_cursor) || 1);
    if (!stateRow) {
      await admin.from("jd_sync_state").insert({ store_id: store.id, phase, page_cursor: cursor });
    }

    // ── Existing catalog index (source_id + normalised name) ─────────────
    const knownSku = new Set<string>();
    const byName = new Map<string, { id: string; source_id: string | null }>();
    const knownSlug = new Set<string>();
    {
      const PAGE = 1000;
      for (let off = 0; ; off += PAGE) {
        const { data, error } = await admin
          .from("products")
          .select("id, name, slug, source_id")
          .eq("store_id", store.id)
          .range(off, off + PAGE - 1);
        if (error) break;
        for (const p of data || []) {
          if (p.source_id) knownSku.add(p.source_id);
          if (p.slug) knownSlug.add(p.slug);
          const k = norm(p.name || "");
          if (k && !byName.has(k)) byName.set(k, { id: p.id, source_id: p.source_id });
        }
        if (!data || data.length < PAGE) break;
      }
    }

    // ── Existing categories ──────────────────────────────────────────────
    const catByName = new Map<string, string>();
    {
      const { data } = await admin.from("categories").select("id, name").eq("store_id", store.id);
      for (const c of data || []) catByName.set(norm(c.name), c.id);
    }

    // ── Walk listing pages ───────────────────────────────────────────────
    const startPage = phase === "steady" ? 1 : cursor;
    const maxPages = phase === "steady" ? STEADY_PAGES : pageBudget;

    const candidates: ListItem[] = [];
    const linked: { productId: string; sku: string }[] = [];
    let pagesWalked = 0;
    let reachedEnd = false;
    let listErrors = 0;
    // Earliest page that was not processed completely. Never advance beyond
    // this page: transient listing/detail/write failures must be retried.
    let retryFromPage: number | null = null;
    let page = startPage;

    outer: while (pagesWalked < maxPages) {
      if (Date.now() - started > TIME_BUDGET_MS) break;
      // Fetch a slice of listing pages in parallel — sequential paging could
      // not keep up with a 1,200+ page catalog inside one run's time budget.
      const slice: number[] = [];
      for (let k = 0; k < PAGE_CONCURRENCY && pagesWalked + k < maxPages; k++) slice.push(page + k);
      const pages = await Promise.all(slice.map((n) => fetchListPage(n)));

      for (let k = 0; k < pages.length; k++) {
        const items = pages[k];
        page++;
        pagesWalked++;
        if (items === null) {
          listErrors++;
          const failedPage = slice[k];
          retryFromPage = retryFromPage == null ? failedPage : Math.min(retryFromPage, failedPage);
          continue; // transient throttle — retry this page on the next run
        }
        if (items.length === 0) {
          reachedEnd = true;
          break outer;
        }
        for (const it of items) {
          if (knownSku.has(it.id)) continue;
          const key = norm(it.name);
          const match = byName.get(key);
          // Only adopt a legacy row that has no source_id yet. The source ships
          // many distinct products under an identical name — treating a name hit
          // on an ALREADY-linked row as "known" silently skipped those imports
          // (catalog was stuck at ~26% coverage).
          if (match && !match.source_id) {
            linked.push({ productId: match.id, sku: it.id });
            knownSku.add(it.id);
            byName.delete(key); // one legacy row can adopt only one SKU
            continue;
          }
          candidates.push({ ...it, sourcePage: slice[k] });
        }
      }

      if (candidates.length >= importBudget) break;
      await new Promise((r) => setTimeout(r, REQ_GAP_MS));
    }
    if (candidates.length > importBudget) {
      // Overshoot: rewind the cursor over the last slice so the dropped
      // products are re-walked next run instead of being skipped forever.
      candidates.length = importBudget;
      const firstDroppedPage = candidates[candidates.length - 1]?.sourcePage;
      if (firstDroppedPage != null) {
        retryFromPage = retryFromPage == null ? firstDroppedPage : Math.min(retryFromPage, firstDroppedPage);
      }
    }

    // ── Discovery pass over sibling reseller storefronts ─────────────────
    // Same backend + same catalog hash, but the listing endpoint is scoped by
    // Origin, so each sibling exposes SKUs the primary store never lists.
    // Detail + stock lookups work on the default origin, so this is purely a
    // discovery walk with its own per-origin page cursor.
    const extraCursor: Record<string, number> =
      (stateRow?.extra_cursor && typeof stateRow.extra_cursor === "object")
        ? { ...(stateRow.extra_cursor as Record<string, number>) }
        : {};

    // ── Deep sweep (steady phase only) ───────────────────────────────────
    // Steady runs re-scan only the newest STEADY_PAGES pages, so any product
    // deeper in the catalog that never made it in during backfill stayed
    // invisible forever. A rotating cursor walks DEEP_PAGES pages per run and
    // wraps at the end of the catalog, so the whole source list is re-checked
    // continuously (~1,200 pages / 10 per run at a 15-min cron ≈ daily).
    let deepCursor = Math.max(1, Number(extraCursor.__deep) || 1);
    let deepPagesWalked = 0;
    let deepFound = 0;
    if (phase === "steady") {
      for (let n = 0; n < DEEP_PAGES; n++) {
        if (candidates.length >= importBudget) break;
        if (Date.now() - started > TIME_BUDGET_MS) break;
        const items = await fetchListPage(deepCursor);
        if (items === null) break; // throttled — retry the same page next run
        deepPagesWalked++;
        if (items.length === 0) { deepCursor = 1; break; } // past the end → wrap
        for (const it of items) {
          if (knownSku.has(it.id)) continue;
          const key = norm(it.name);
          const match = byName.get(key);
          if (match && !match.source_id) {
            linked.push({ productId: match.id, sku: it.id });
            knownSku.add(it.id);
            byName.delete(key);
            continue;
          }
          knownSku.add(it.id);
          candidates.push({ ...it, deepPage: deepCursor });
          deepFound++;
        }
        deepCursor++;
        await new Promise((r) => setTimeout(r, REQ_GAP_MS));
      }
    }
    extraCursor.__deep = deepCursor;



    for (const origin of EXTRA_ORIGINS) {
      if (candidates.length >= importBudget) break;
      if (Date.now() - started > TIME_BUDGET_MS) break;
      let p = Math.max(1, Number(extraCursor[origin]) || 1);
      for (let n = 0; n < EXTRA_PAGES; n++) {
        if (candidates.length >= importBudget) break;
        if (Date.now() - started > TIME_BUDGET_MS) break;
        const items = await fetchListPage(p, origin);
        if (items === null) break; // transient throttle — retry same page next run
        if (items.length === 0) { p = 1; break; } // wrapped around; restart next run
        for (const it of items) {
          if (knownSku.has(it.id)) continue;
          const key = norm(it.name);
          const match = byName.get(key);
          if (match && !match.source_id) {
            linked.push({ productId: match.id, sku: it.id });
            knownSku.add(it.id);
            byName.delete(key);
            continue;
          }
          knownSku.add(it.id); // dedupe against the primary walk within this run
          candidates.push({ ...it });
        }
        p++;
        await new Promise((r) => setTimeout(r, REQ_GAP_MS));
      }
      extraCursor[origin] = p;
    }


    // ── Backfill source_id on pre-existing rows ──────────────────────────
    for (const l of linked) {
      await admin.from("products").update({ source_id: l.sku, source_platform: "jdwebship" }).eq("id", l.productId);
    }

    // ── Fetch details for genuinely new products ─────────────────────────
    // Watches only: non-watch SKUs are remembered so they are never re-fetched.
    const skip = new Set<string>(Array.isArray((stateRow?.extra_cursor as any)?.__skip) ? (stateRow!.extra_cursor as any).__skip : []);
    for (let i = candidates.length - 1; i >= 0; i--) if (skip.has(candidates[i].id)) candidates.splice(i, 1);
    const detailResults = await mapLimit(candidates, CONCURRENCY, async (candidate) => ({
      candidate,
      detail: await fetchDetail(candidate.id),
    }));
    const isWatch = (d: any) => /watch/i.test(subCats.get(Number(d.sub_category_id))?.name || "");
    for (const r of detailResults) {
      if (r.detail && !isWatch(r.detail)) { skip.add(String(r.detail.id)); r.detail = null; r.candidate.sourcePage = undefined; r.candidate.deepPage = undefined; }
    }
    (extraCursor as any).__skip = [...skip].slice(-20000);
    const details: any[] = [];
    for (const result of detailResults) {
      if (result.detail) {
        details.push(result.detail);
      } else if (result.candidate.sourcePage != null) {
        retryFromPage = retryFromPage == null
          ? result.candidate.sourcePage
          : Math.min(retryFromPage, result.candidate.sourcePage);
      } else if (result.candidate.deepPage != null) {
        // A throttled detail lookup must not make the deep sweep skip past
        // that page — rewind the rotating cursor so it is walked again.
        deepCursor = Math.min(deepCursor, result.candidate.deepPage);
        extraCursor.__deep = deepCursor;
      }

    }

    // ── Create any missing categories ────────────────────────────────────
    for (const d of details) {
      const sc = subCats.get(Number(d.sub_category_id));
      if (!sc) continue;
      const key = norm(sc.name);
      if (catByName.has(key)) continue;
      const { data: newCat } = await admin
        .from("categories")
        .insert({
          store_id: store.id,
          name: sc.name,
          slug: slugify(sc.name),
          image_url: sc.image,
          display_order: 99,
          show_on_home: true,
        })
        .select("id")
        .maybeSingle();
      if (newCat?.id) catByName.set(key, newCat.id);
    }

    // ── Build product rows ───────────────────────────────────────────────
    const rows: any[] = [];
    const galleries: Record<string, string[]> = {};
    for (const d of details) {
      let slug = String(d.slug);
      if (knownSlug.has(slug)) slug = `${slug}-${String(d.id).slice(-6).toLowerCase()}`;
      if (knownSlug.has(slug)) continue;
      knownSlug.add(slug);

      const old = num(d.old_price);
      const fin = num(d.final_price);
      const price = old && fin && old > fin ? old : (fin ?? old ?? 0);
      const sale = old && fin && old > fin ? fin : null;
      // Variation products report parent `quantity: 0` while the real stock
      // lives on each variation row — take the larger of the two or every
      // size-based product would land as "Sold Out".
      const varStock = (Array.isArray(d.variations) ? d.variations : [])
        .reduce((s: number, v: any) => s + Math.max(0, Math.floor(Number(v?.stock) || 0)), 0);
      const parentQty = Math.max(0, Math.floor(Number(d.quantity) || 0));
      const delisted = Number(d.product_status ?? 1) !== 1;
      // Unavailable / disabled at source → import anyway, listed as Sold Out.
      // Stock sync puts it back the moment the source restocks it.
      const qty = Number(d.in_stock) === 0 || delisted ? 0 : Math.max(parentQty, varStock);

      const sc = subCats.get(Number(d.sub_category_id));

      rows.push({
        store_id: store.id,
        name: String(d.name || d.alternate_name || "").trim(),
        slug,
        description: d.description ? String(d.description) : null,
        price,
        sale_price: sale,
        currency: store.currency || "INR",
        stock_quantity: qty,
        is_active: true,
        image_url: assetUrl(d.cover_image),
        image_alt: String(d.name || ""),
        category: sc?.name ?? null,
        video_url: videoAssetUrl(d.video),
        source_id: String(d.id),
        source_platform: "jdwebship",
        source_synced_at: new Date().toISOString(),
      });
      galleries[slug] = (Array.isArray(d.images) ? d.images : [])
        .map((im: any) => assetUrl(im?.image))
        .filter(Boolean)
        .slice(0, 8) as string[];
    }

    // ── Insert ───────────────────────────────────────────────────────────
    let imported = 0;
    const imgRows: any[] = [];
    for (let i = 0; i < rows.length; i += 50) {
      const chunk = rows.slice(i, i + 50);
      const { data, error } = await admin.from("products").insert(chunk).select("id, slug, name");
      if (error) {
        console.error("jd-catalog-sync insert", error.message);
        // Rows are ordered like `details`; retrying the whole scanned range is
        // safe because successful source IDs are indexed on the next run.
        retryFromPage = retryFromPage == null ? startPage : Math.min(retryFromPage, startPage);
        continue;
      }
      imported += data?.length || 0;
      for (const p of data || []) {
        (galleries[p.slug] || []).forEach((u, j) => {
          imgRows.push({ product_id: p.id, image_url: u, display_order: j, image_alt: p.name });
        });
      }
    }
    for (let i = 0; i < imgRows.length; i += 200) {
      await admin.from("product_images").insert(imgRows.slice(i, i + 200));
    }
    // Supplier added-date order + brand categories by product name.
    if (imported > 0 || linked.length > 0) {
      const { error: orgErr } = await admin.rpc("jd_organize_watch_catalog", { _store_id: store.id });
      if (orgErr) console.error("jd organize", orgErr.message);
    }

    // ── Advance cursor / phase ───────────────────────────────────────────
    let nextPhase = phase;
    let nextCursor = cursor;
    if (phase === "backfill") {
      if (reachedEnd && retryFromPage == null) {
        nextPhase = "steady";
        nextCursor = 1;
      } else {
        nextCursor = retryFromPage == null ? page : Math.min(page, retryFromPage);
      }
    } else {
      nextCursor = 1;
    }

    const result = {
      phase,
      next_phase: nextPhase,
      from_page: startPage,
      pages_walked: pagesWalked,
      deep_pages_walked: deepPagesWalked,
      deep_cursor: deepCursor,
      deep_found: deepFound,
      list_errors: listErrors,
      candidates: candidates.length,
      details_ok: details.length,
      linked_existing: linked.length,
      imported,
      images: imgRows.length,
      reached_end: reachedEnd,
      retry_from_page: retryFromPage,
    };

    await admin
      .from("jd_sync_state")
      .upsert({
        store_id: store.id,
        phase: nextPhase,
        page_cursor: nextCursor,
        extra_cursor: extraCursor,
        last_run_at: new Date().toISOString(),
        last_result: result,
        imported_total: (Number(stateRow?.imported_total) || 0) + imported,
        updated_at: new Date().toISOString(),
      }, { onConflict: "store_id" });

    // ── Purge storefront cache when the catalog actually changed ─────────
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
  console.log("jd-catalog-sync", JSON.stringify(out));
  return json(out);
});
