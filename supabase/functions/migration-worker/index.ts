/**
 * migration-worker — Processes one page of the oldest running/pending job.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  shopifyListProducts,
  shopifyToStorivoProduct,
  shopifyImageUrls,
} from "../_shared/migration/shopify.ts";
import {
  wooListProducts,
  wooToStorivoProduct,
  wooImageUrls,
  type WooProduct,
} from "../_shared/migration/woocommerce.ts";
import {
  discoverProductUrls,
  scrapeProduct,
  scrapedToStorivoProduct,
} from "../_shared/migration/generic.ts";
import { mirrorImageToR2, extFromUrl } from "../_shared/migration/r2.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const PAGE_SIZE = 50;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    let jobId: string | null = null;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      jobId = body.job_id || null;
    }
    let job: any = null;
    if (jobId) {
      const { data } = await admin.from("migration_jobs").select("*").eq("id", jobId).maybeSingle();
      job = data;
    } else {
      const { data } = await admin
        .from("migration_jobs")
        .select("*")
        .in("status", ["pending", "running"])
        .order("created_at", { ascending: true })
        .limit(1);
      job = data?.[0] ?? null;
    }
    if (!job) return json({ ok: true, idle: true });

    await admin
      .from("migration_jobs")
      .update({ status: "running", started_at: job.started_at ?? new Date().toISOString() })
      .eq("id", job.id);

    const platform = String(job.source_platform);
    const creds = (job.credentials ?? {}) as Record<string, string>;
    const host = String(job.source_url).replace(/^https?:\/\//, "").replace(/\/.*/, "");
    const entities: string[] = Array.isArray(job.entities) ? job.entities : ["products"];
    const wantCategories = entities.includes("categories");

    const { data: storeRow } = await admin
      .from("stores")
      .select("currency")
      .eq("id", job.store_id)
      .maybeSingle();
    const storeCurrency = (storeRow as any)?.currency || "INR";

    let normalizedRows: Array<{ row: any; sourceId: string; images: string[]; categoryName: string | null }> = [];
    let nextCursor: Record<string, unknown> = { ...(job.cursor ?? {}) };
    let hasMore = false;

    try {
      if (platform === "shopify") {
        const token = creds.access_token;
        if (!token) throw new Error("Missing Shopify access_token");
        const sinceId = Number((job.cursor as any)?.products_since_id ?? 0);
        const page = await shopifyListProducts(host, token, sinceId, PAGE_SIZE);
        normalizedRows = page.products.map((p) => {
          const row = shopifyToStorivoProduct(p, job.store_id);
          return {
            row,
            sourceId: String(p.id),
            images: shopifyImageUrls(p),
            categoryName: row.category ?? null,
          };
        });
        nextCursor = { ...nextCursor, products_since_id: page.nextSinceId ?? sinceId };
        hasMore = page.nextSinceId !== null;
      } else if (platform === "woocommerce") {
        const key = creds.consumer_key;
        const secret = creds.consumer_secret;
        if (!key || !secret) throw new Error("Missing WooCommerce consumer_key/consumer_secret");
        const page = Number((job.cursor as any)?.woo_page ?? 1);
        const res = await wooListProducts(host, key, secret, page, PAGE_SIZE);
        normalizedRows = res.products.map((p: WooProduct) => {
          const row = wooToStorivoProduct(p, job.store_id);
          return {
            row,
            sourceId: String(p.id),
            images: wooImageUrls(p),
            categoryName: row.category ?? null,
          };
        });
        nextCursor = { ...nextCursor, woo_page: page + 1 };
        hasMore = res.hasMore;
      } else if (platform === "generic" || platform === "dukaan") {
        let urls = (job.cursor as any)?.urls as string[] | undefined;
        if (!urls) {
          urls = await discoverProductUrls(String(job.source_url), 500);
          if (!urls.length) throw new Error("No product URLs discovered from sitemap");
        }
        const offset = Number((job.cursor as any)?.offset ?? 0);
        const slice = urls.slice(offset, offset + 20);
        for (const u of slice) {
          try {
            const sp = await scrapeProduct(u);
            if (sp) {
              const row = scrapedToStorivoProduct(sp, job.store_id, platform);
              normalizedRows.push({
                row,
                sourceId: u,
                images: sp.image_urls ?? (sp.image_url ? [sp.image_url] : []),
                categoryName: row.category ?? null,
              });
            }
          } catch (err) {
            await appendError(admin, job.id, `scrape ${u}: ${err instanceof Error ? err.message : err}`);
          }
        }
        const nextOffset = offset + slice.length;
        nextCursor = { ...nextCursor, urls, offset: nextOffset };
        hasMore = nextOffset < urls.length;
      } else {
        throw new Error(`Platform ${platform} not supported`);
      }
    } catch (err) {
      await appendError(admin, job.id, err instanceof Error ? err.message : String(err));
      const { data: current } = await admin
        .from("migration_jobs")
        .select("error_log, progress")
        .eq("id", job.id)
        .single();
      const totalDone = Number((current?.progress as any)?.products?.done ?? 0);
      if (totalDone === 0 && (current?.error_log as any[])?.length >= 3) {
        await admin.from("migration_jobs").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", job.id);
      }
      return json({ ok: false, error: "list failed" });
    }

    const progress = (job.progress as any) ?? {};
    const productsDone = Number(progress.products?.done ?? 0);
    const productsFailed = Number(progress.products?.failed ?? 0);
    const categoriesDone = Number(progress.categories?.done ?? 0);
    let done = 0, failed = 0;
    let categoriesCreated = 0;

    const categoryIdByName = new Map<string, string>();
    async function ensureCategory(name: string | null): Promise<string | null> {
      if (!name || !wantCategories) return null;
      const clean = name.trim().slice(0, 100);
      if (!clean) return null;
      if (categoryIdByName.has(clean)) return categoryIdByName.get(clean)!;
      const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "category";
      const { data: existing } = await admin
        .from("categories")
        .select("id")
        .eq("store_id", job.store_id)
        .eq("slug", slug)
        .maybeSingle();
      if (existing?.id) {
        categoryIdByName.set(clean, existing.id);
        return existing.id;
      }
      const { data: inserted, error: insErr } = await admin
        .from("categories")
        .insert({ store_id: job.store_id, name: clean, slug })
        .select("id")
        .single();
      if (insErr) {
        const { data: retry } = await admin
          .from("categories")
          .select("id")
          .eq("store_id", job.store_id)
          .eq("slug", slug)
          .maybeSingle();
        if (retry?.id) {
          categoryIdByName.set(clean, retry.id);
          return retry.id;
        }
        await appendError(admin, job.id, `category "${clean}": ${insErr.message}`);
        return null;
      }
      categoriesCreated++;
      categoryIdByName.set(clean, inserted.id);
      return inserted.id;
    }

    for (const { row, sourceId, images, categoryName } of normalizedRows) {
      try {
        await ensureCategory(categoryName);
        row.currency = storeCurrency;

        if (row.image_url) {
          const ext = extFromUrl(row.image_url, "jpg");
          const safeId = sourceId.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 60);
          const key = `product-images/migrated/${job.store_id}/${safeId}-800w.${ext}`;
          const mirrored = await mirrorImageToR2(row.image_url, key);
          if (mirrored) row.image_url = mirrored;
        }

        const upsert = await admin
          .from("products")
          .upsert(row, { onConflict: "store_id,source_platform,source_id" })
          .select("id")
          .single();

        let productId: string | null = null;
        if (upsert.error) {
          if (upsert.error.code === "23505") {
            const safeId = sourceId.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 30);
            const retry = await admin
              .from("products")
              .upsert({ ...row, slug: `${row.slug || "product"}-${safeId}` }, {
                onConflict: "store_id,source_platform,source_id",
              })
              .select("id")
              .single();
            if (retry.error) throw retry.error;
            await recordMap(admin, job.id, "product", sourceId, retry.data.id, "ok");
            productId = retry.data.id;
          } else {
            throw upsert.error;
          }
        } else {
          await recordMap(admin, job.id, "product", sourceId, upsert.data.id, "ok");
          productId = upsert.data.id;
        }

        if (productId && images && images.length > 1) {
          await admin.from("product_images").delete().eq("product_id", productId);
          const gallery = images.slice(0, 8);
          const rows: any[] = [];
          for (let i = 0; i < gallery.length; i++) {
            let url = gallery[i];
            try {
              const ext = extFromUrl(url, "jpg");
              const safeId = sourceId.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 60);
              const key = `product-images/migrated/${job.store_id}/${safeId}-${i}-800w.${ext}`;
              const mirrored = await mirrorImageToR2(url, key);
              if (mirrored) url = mirrored;
            } catch { /* best-effort */ }
            rows.push({
              product_id: productId,
              image_url: url,
              display_order: i,
              image_alt: row.image_alt ?? row.name,
            });
          }
          if (rows.length) {
            const { error: imgErr } = await admin.from("product_images").insert(rows);
            if (imgErr) await appendError(admin, job.id, `gallery ${sourceId}: ${imgErr.message}`);
          }
        }
        done++;
      } catch (err) {
        failed++;
        await recordMap(admin, job.id, "product", sourceId, null, "failed", err instanceof Error ? err.message : String(err));
      }
    }

    const newProgress = {
      ...progress,
      products: {
        done: productsDone + done,
        failed: productsFailed + failed,
      },
      categories: { done: categoriesDone + categoriesCreated },
    };

    await admin
      .from("migration_jobs")
      .update({
        progress: newProgress,
        cursor: nextCursor,
        status: hasMore ? "running" : "completed",
        completed_at: hasMore ? null : new Date().toISOString(),
        ...(hasMore ? {} : { credentials: {} }),
      })
      .eq("id", job.id);

    if (hasMore) {
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/migration-worker`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ job_id: job.id }),
      }).catch(() => {});
    }

    return json({ ok: true, done, failed, hasMore });
  } catch (err) {
    console.error("[migration-worker] fatal:", err);
    return json({ ok: false, error: err instanceof Error ? err.message : "Unknown" }, 500);
  }
});

async function recordMap(
  admin: ReturnType<typeof createClient>,
  jobId: string,
  entityType: string,
  sourceId: string,
  targetId: string | null,
  status: "ok" | "skipped" | "failed",
  error?: string,
) {
  await admin.from("migration_source_map").upsert(
    { job_id: jobId, entity_type: entityType, source_id: sourceId, target_id: targetId, status, error: error ?? null },
    { onConflict: "job_id,entity_type,source_id" },
  );
}

async function appendError(admin: any, jobId: string, msg: string) {
  const { data } = await admin.from("migration_jobs").select("error_log").eq("id", jobId).single();
  const log = Array.isArray(data?.error_log) ? data.error_log : [];
  log.push({ at: new Date().toISOString(), msg });
  await admin.from("migration_jobs").update({ error_log: log.slice(-20) }).eq("id", jobId);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
