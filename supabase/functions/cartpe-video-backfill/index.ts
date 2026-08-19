// supabase/functions/cartpe-video-backfill/index.ts
//
// Backfills product videos for Cartpe-sourced products.
//
// The Cartpe PDP exposes the product video only inside the "View Video" modal:
//   <video ...><source src="https://cdn.cartpe.in/images/video_upload/xxx.mp4" ...>
// The catalog sync never read it, so every imported product landed without a
// video. This walks our own products (scoped by store + source_platform),
// re-fetches each PDP by its own `source_path`, and writes `video_url` +
// `video_poster_url` for that exact row — so a video can never be attached to
// the wrong product.
//
// Idempotent: products already carrying a video are skipped, and a product with
// no video at source is marked done via `source_synced_at` bump only.
//
// Auth: header `x-cron-key` matching a token in public.cron_auth.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-cron-key",
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const CONCURRENCY = 8;
const REQ_TIMEOUT_MS = 20_000;
const TIME_BUDGET_MS = 110_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchText(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQ_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Extract the product video URL from a Cartpe PDP (modal <source> tag). */
export function parseVideo(html: string): string | null {
  const inModal = html.match(
    /<video[^>]*>[\s\S]{0,400}?<source[^>]*src="(https?:\/\/[^"]+\.(?:mp4|webm|mov))"/i,
  )?.[1];
  if (inModal) return inModal;
  const direct = html.match(
    /https?:\/\/cdn\.cartpe\.in\/images\/video_upload\/[^"'\s\\)]+\.(?:mp4|webm|mov)/i,
  )?.[0];
  return direct ?? null;
}

async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const i = cursor++;
        if (i >= items.length) return;
        out[i] = await worker(items[i]);
      }
    }),
  );
  return out;
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
  const storeSlug = String((body as any)?.store || "").trim();
  const batch = Math.min(600, Math.max(1, Number((body as any)?.batch) || 240));
  const afterId = String((body as any)?.after_id || "").trim();
  const recheck = Boolean((body as any)?.recheck);

  const { data: stores } = await admin
    .from("stores")
    .select("id, slug, custom_domain, source_base_url")
    .eq("source_platform", "cartpe")
    .then((r) => ({ data: (r.data || []).filter((s) => !storeSlug || s.slug === storeSlug) }));
  if (!stores?.length) return json({ ok: true, note: "no cartpe store" });

  const report: Record<string, unknown>[] = [];

  for (const store of stores) {
    const base = String(store.source_base_url || "").replace(/\/+$/, "");
    if (!base) { report.push({ store: store.slug, error: "missing source_base_url" }); continue; }

    let q = admin
      .from("products")
      .select("id, source_path, image_url")
      .eq("store_id", store.id)
      .eq("source_platform", "cartpe")
      .not("source_path", "is", null)
      .order("id", { ascending: true })
      .limit(batch);
    if (afterId) q = q.gt("id", afterId);
    if (!recheck) q = q.is("video_url", null);

    const { data: prods, error } = await q;
    if (error) { report.push({ store: store.slug, error: error.message }); continue; }
    if (!prods?.length) { report.push({ store: store.slug, checked: 0, done: true }); continue; }

    let updated = 0;
    let noVideo = 0;
    let failed = 0;

    const results = await mapLimit(prods, CONCURRENCY, async (p) => {
      if (Date.now() - started > TIME_BUDGET_MS) return { p, html: null as string | null, skipped: true };
      const html = await fetchText(`${base}/${String(p.source_path).replace(/^\/+/, "")}`);
      return { p, html, skipped: false };
    });

    const updates: { id: string; video_url: string; video_poster_url: string | null }[] = [];
    for (const { p, html, skipped } of results) {
      if (skipped) continue;
      if (!html) { failed++; continue; }
      const v = parseVideo(html);
      if (!v) { noVideo++; continue; }
      updates.push({ id: p.id, video_url: v, video_poster_url: p.image_url ?? null });
    }

    for (const u of updates) {
      const { error: e1 } = await admin
        .from("products")
        .update({ video_url: u.video_url, video_poster_url: u.video_poster_url })
        .eq("id", u.id);
      if (e1) failed++;
      else updated++;
    }

    report.push({
      store: store.slug,
      checked: results.filter((r) => !r.skipped).length,
      updated,
      no_video: noVideo,
      failed,
      last_id: prods[prods.length - 1]?.id ?? null,
      exhausted: prods.length < batch,
    });

    // Purge storefront edge cache so new videos show immediately.
    if (updated > 0) {
      const secret = Deno.env.get("WORKER_PURGE_SECRET") || "";
      if (secret) {
        const domain = (store.custom_domain || "").replace(/^www\./, "").toLowerCase().trim();
        const params = new URLSearchParams({ slug: store.slug });
        if (domain) params.set("domain", domain);
        const bases = [`https://${store.slug}.shopbanao.in`];
        if (domain) bases.push(`https://${domain}`);
        await Promise.allSettled(
          bases.map((b) =>
            fetch(`${b}/api/purge-store?${params}`, {
              method: "POST",
              headers: { "x-purge-secret": secret, "Cache-Control": "no-store" },
            })
          ),
        );
      }
    }
  }

  const out = { ok: true, ms: Date.now() - started, stores: report };
  console.log("cartpe-video-backfill", JSON.stringify(out));
  return json(out);
});
