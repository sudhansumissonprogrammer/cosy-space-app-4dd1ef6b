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
  inspectShopifyPublicCatalogue,
  shopifyPublicCollectionProductIds,
  type ShopifyPublicCollection,
} from "../_shared/migration/shopify-public.ts";
import {
  wooListProducts,
  wooToStorivoProduct,
  wooImageUrls,
  type WooProduct,
} from "../_shared/migration/woocommerce.ts";
import {
  discoverProductUrls,
  inspectPublicSite,
  scrapePublicPage,
  scrapeProduct,
  scrapedToStorivoProduct,
} from "../_shared/migration/generic.ts";
import { mirrorImageToR2, extFromUrl } from "../_shared/migration/r2.ts";
import { assertSafePublicUrl } from "../_shared/migration/safe-fetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const PAGE_SIZE = 50;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (
    !serviceKey ||
    req.headers.get("Authorization") !== `Bearer ${serviceKey}`
  ) {
    return json({ error: "Unauthorized" }, 401);
  }

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
    const { data: claimedId, error: claimError } = await admin.rpc(
      "claim_migration_job",
      { _job_id: jobId },
    );
    if (claimError) throw claimError;
    if (!claimedId) return json({ ok: true, idle: true });
    const { data: job } = await admin
      .from("migration_jobs")
      .select("*")
      .eq("id", claimedId)
      .maybeSingle();
    if (!job) return json({ ok: true, idle: true });
    if (job.cancel_requested) return json({ ok: true, cancelled: true });

    const platform = String(job.source_platform);
    const creds = (job.credentials ?? {}) as Record<string, string>;
    const sourceUrl = assertSafePublicUrl(String(job.source_url));
    const host = sourceUrl.hostname;
    const entities: string[] = Array.isArray(job.entities)
      ? job.entities
      : ["products"];
    const wantCategories = entities.includes("categories");
    // Stores made by the WhatsApp agent go live immediately (no dashboard review step),
    // and never adopt the source site's logo — it may be a platform/other brand logo.
    const { data: waSession } = await admin.from("wa_onboarding_sessions")
      .select("phone").eq("store_id", job.store_id).maybeSingle();
    const publishLive = !!waSession;

    if (
      !(job.cursor as any)?.site_profile_done &&
      (platform === "generic" ||
        platform === "dukaan" ||
        platform === "shopify-public")
    ) {
      try {
        const profile = await inspectPublicSite(String(job.source_url));
        const storePatch: Record<string, string> = {};
        if (profile.description) storePatch.description = profile.description;
        if (profile.logo_url && !publishLive) {
          const mirrored = await mirrorImageToR2(
            profile.logo_url,
            `store-logos/migrated/${job.store_id}/logo.${extFromUrl(profile.logo_url)}`,
          );
          if (mirrored) storePatch.logo_url = mirrored;
        }
        if (profile.hero_url) {
          const mirrored = await mirrorImageToR2(
            profile.hero_url,
            `store-banners/migrated/${job.store_id}/hero.${extFromUrl(profile.hero_url)}`,
          );
          if (mirrored) storePatch.banner_url = mirrored;
        }
        if (Object.keys(storePatch).length)
          await admin.from("stores").update(storePatch).eq("id", job.store_id);
        let pagesDone = 0;
        for (const page of profile.pages) {
          const content = await scrapePublicPage(page.url).catch(() => null);
          if (!content) continue;
          const slug =
            page.type === "about" ? "about-us" : `${page.type}-policy`;
          const { data: existingPage } = await admin
            .from("store_pages")
            .select("id")
            .eq("store_id", job.store_id)
            .eq("page_type", page.type)
            .maybeSingle();
          const pagePayload = {
            store_id: job.store_id,
            page_type: page.type,
            title: page.title,
            slug,
            content,
            is_active: publishLive,
          };
          const pageResult = existingPage?.id
            ? await admin
                .from("store_pages")
                .update(pagePayload)
                .eq("id", existingPage.id)
            : await admin.from("store_pages").insert(pagePayload);
          if (!pageResult.error) pagesDone++;
        }
        job.progress = {
          ...(job.progress || {}),
          pages: {
            done: pagesDone,
            failed: Math.max(0, profile.pages.length - pagesDone),
          },
        };
      } catch (profileError) {
        await appendError(
          admin,
          job.id,
          `site profile: ${profileError instanceof Error ? profileError.message : profileError}`,
        );
      }
      job.cursor = { ...(job.cursor || {}), site_profile_done: true };
    }

    const { data: storeRow } = await admin
      .from("stores")
      .select("currency")
      .eq("id", job.store_id)
      .maybeSingle();
    const storeCurrency = (storeRow as any)?.currency || "INR";

    let normalizedRows: Array<{
      row: any;
      sourceId: string;
      images: string[];
      categoryNames: string[];
      variants: any[];
    }> = [];
    let nextCursor: Record<string, unknown> = { ...(job.cursor ?? {}) };
    let hasMore = false;
    const categoryImageByName = new Map<string, string>();
    const categorySlugByName = new Map<string, string>();

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
            categoryNames: row.category ? [row.category] : [],
            variants: p.variants ?? [],
          };
        });
        nextCursor = {
          ...nextCursor,
          products_since_id: page.nextSinceId ?? sinceId,
        };
        hasMore = page.nextSinceId !== null;
      } else if (platform === "woocommerce") {
        const key = creds.consumer_key;
        const secret = creds.consumer_secret;
        if (!key || !secret)
          throw new Error("Missing WooCommerce consumer_key/consumer_secret");
        const page = Number((job.cursor as any)?.woo_page ?? 1);
        const res = await wooListProducts(host, key, secret, page, PAGE_SIZE);
        normalizedRows = res.products.map((p: WooProduct) => {
          const row = wooToStorivoProduct(p, job.store_id);
          return {
            row,
            sourceId: String(p.id),
            images: wooImageUrls(p),
            categoryNames: row.category ? [row.category] : [],
            variants: [],
          };
        });
        nextCursor = { ...nextCursor, woo_page: page + 1 };
        hasMore = res.hasMore;
      } else if (platform === "shopify-public") {
        let products = (job.cursor as any)?.shopify_products as
          any[] | undefined;
        let collections = (job.cursor as any)?.shopify_collections as
          ShopifyPublicCollection[] | undefined;
        let memberships = (job.cursor as any)?.shopify_memberships as
          Record<string, string[]> | undefined;
        if (!products || !collections || !memberships) {
          const catalogue = await inspectShopifyPublicCatalogue(
            String(job.source_url),
          );
          products = catalogue.products;
          collections = catalogue.collections;
          memberships = {};
          for (const collection of collections) {
            if (collection.image?.src)
              categoryImageByName.set(collection.title, collection.image.src);
            if (collection.handle)
              categorySlugByName.set(collection.title, collection.handle);
            const productIds = await shopifyPublicCollectionProductIds(
              String(job.source_url),
              collection.handle,
            ).catch(() => [] as string[]);
            for (const productId of productIds) {
              memberships[productId] = Array.from(
                new Set([...(memberships[productId] ?? []), collection.title]),
              );
            }
          }
        }
        const offset = Number((job.cursor as any)?.offset ?? 0);
        for (const collection of collections) {
          if (collection.image?.src)
            categoryImageByName.set(collection.title, collection.image.src);
          if (collection.handle)
            categorySlugByName.set(collection.title, collection.handle);
        }
        const slice = products.slice(offset, offset + 2);
        normalizedRows = slice.map((product) => {
          const row = shopifyToStorivoProduct(product, job.store_id);
          const categoryNames =
            memberships?.[String(product.id)] ??
            (row.category ? [row.category] : []);
          return {
            row,
            sourceId: String(product.id),
            images: shopifyImageUrls(product),
            categoryNames,
            variants: product.variants ?? [],
          };
        });
        const nextOffset = offset + slice.length;
        nextCursor = {
          ...nextCursor,
          shopify_products: products,
          shopify_collections: collections,
          shopify_memberships: memberships,
          offset: nextOffset,
          site_profile_done: true,
        };
        hasMore = nextOffset < products.length;
      } else if (platform === "generic" || platform === "dukaan") {
        let urls = (job.cursor as any)?.urls as string[] | undefined;
        if (!urls) {
          urls = await discoverProductUrls(String(job.source_url), 500);
          if (!urls.length)
            throw new Error("No product URLs discovered from sitemap");
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
                categoryNames: row.category ? [row.category] : [],
                variants: [],
              });
            }
          } catch (err) {
            await appendError(
              admin,
              job.id,
              `scrape ${u}: ${err instanceof Error ? err.message : err}`,
            );
          }
        }
        const nextOffset = offset + slice.length;
        nextCursor = {
          ...nextCursor,
          urls,
          offset: nextOffset,
          site_profile_done: true,
        };
        hasMore = nextOffset < urls.length;
      } else {
        throw new Error(`Platform ${platform} not supported`);
      }
    } catch (err) {
      await appendError(
        admin,
        job.id,
        err instanceof Error ? err.message : String(err),
      );
      const { data: current } = await admin
        .from("migration_jobs")
        .select("error_log, progress")
        .eq("id", job.id)
        .single();
      const totalDone = Number((current?.progress as any)?.products?.done ?? 0);
      if (
        (totalDone === 0 && (current?.error_log as any[])?.length >= 3) ||
        Number(job.attempt_count || 0) >= 20
      ) {
        await admin
          .from("migration_jobs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            credentials: {},
            lease_until: null,
          })
          .eq("id", job.id);
      } else {
        await admin
          .from("migration_jobs")
          .update({ lease_until: null })
          .eq("id", job.id);
        scheduleWorker(job.id, 2_000);
      }
      return json({ ok: false, error: "list failed" });
    }

    const progress = (job.progress as any) ?? {};
    const productsDone = Number(progress.products?.done ?? 0);
    const productsFailed = Number(progress.products?.failed ?? 0);
    const categoriesDone = Number(progress.categories?.done ?? 0);
    let done = 0,
      failed = 0;
    let categoriesCreated = 0;

    const categoryIdByName = new Map<string, string>();
    async function ensureCategory(name: string | null): Promise<string | null> {
      if (!name || !wantCategories) return null;
      const clean = name.trim().slice(0, 100);
      if (!clean) return null;
      const cachedId = categoryIdByName.get(clean);
      if (cachedId) return cachedId;
      const preferredSlug = categorySlugByName.get(name || "");
      const slug =
        (preferredSlug || clean)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 80) || "category";
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
      let categoryImage = categoryImageByName.get(name || "") ?? null;
      if (categoryImage) {
        const mirrored = await mirrorImageToR2(
          categoryImage,
          `category-images/migrated/${job.store_id}/${slug}.${extFromUrl(categoryImage)}`,
        );
        if (mirrored) categoryImage = mirrored;
      }
      const { data: inserted, error: insErr } = await admin
        .from("categories")
        .insert({
          store_id: job.store_id,
          name: clean,
          slug,
          image_url: categoryImage,
          show_on_home: publishLive,
          is_hidden: !publishLive,
        })
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
        await appendError(
          admin,
          job.id,
          `category "${clean}": ${insErr.message}`,
        );
        return null;
      }
      categoriesCreated++;
      categoryIdByName.set(clean, inserted.id);
      return inserted.id;
    }

    for (let rowIndex = 0; rowIndex < normalizedRows.length; rowIndex++) {
      const { row, sourceId, images, categoryNames, variants } =
        normalizedRows[rowIndex];
      try {
        if (rowIndex % 5 === 0) {
          const { data: state } = await admin
            .from("migration_jobs")
            .select("cancel_requested")
            .eq("id", job.id)
            .single();
          if (state?.cancel_requested)
            return json({ ok: true, cancelled: true });
          await admin
            .from("migration_jobs")
            .update({
              lease_until: new Date(Date.now() + 90_000).toISOString(),
            })
            .eq("id", job.id)
            .eq("cancel_requested", false);
        }
        const categoryIds = (
          await Promise.all(categoryNames.map((name) => ensureCategory(name)))
        ).filter((id): id is string => Boolean(id));
        row.currency = storeCurrency;
        row.is_active = publishLive;

        const uniqueImages = Array.from(
          new Set(
            (images?.length
              ? images
              : row.image_url
                ? [row.image_url]
                : []
            ).filter(Boolean),
          ),
        ).slice(0, 8);
        const safeId = sourceId.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 60);
        const mirroredImages = await Promise.all(
          uniqueImages.map(async (url, index) => {
            const key = `product-images/migrated/${job.store_id}/${safeId}-${index}-800w.${extFromUrl(url, "jpg")}`;
            return (await mirrorImageToR2(url, key)) || url;
          }),
        );
        if (mirroredImages[0]) row.image_url = mirroredImages[0];

        if (categoryIds.length && row.image_url) {
          await admin
            .from("categories")
            .update({ image_url: row.image_url })
            .in("id", categoryIds)
            .is("image_url", null);
        }

        let productId: string | null = null;
        const { data: existingProduct } = await admin
          .from("products")
          .select("id")
          .eq("store_id", job.store_id)
          .eq("source_platform", row.source_platform)
          .eq("source_id", row.source_id)
          .maybeSingle();
        if (existingProduct?.id) {
          const { error: updateError } = await admin
            .from("products")
            .update(row)
            .eq("id", existingProduct.id);
          if (updateError) throw updateError;
          productId = existingProduct.id;
        } else {
          const inserted = await admin
            .from("products")
            .insert(row)
            .select("id")
            .single();
          if (inserted.error) {
            if (inserted.error.code === "23505") {
              const safeId = sourceId
                .replace(/[^a-zA-Z0-9]/g, "-")
                .slice(0, 30);
              const retry = await admin
                .from("products")
                .insert({ ...row, slug: `${row.slug || "product"}-${safeId}` })
                .select("id")
                .single();
              if (retry.error) throw retry.error;
              productId = retry.data.id;
            } else {
              throw inserted.error;
            }
          } else {
            productId = inserted.data.id;
          }
        }
        await recordMap(admin, job.id, "product", sourceId, productId, "ok");

        if (productId && categoryIds.length) {
          await admin.from("product_categories").upsert(
            categoryIds.map((categoryId) => ({
              product_id: productId,
              category_id: categoryId,
              store_id: job.store_id,
            })),
            { onConflict: "product_id,category_id" },
          );
        }

        if (productId && variants.length > 1) {
          await admin
            .from("product_variants")
            .delete()
            .eq("product_id", productId);
          const variantRows = variants
            .slice(0, 100)
            .map((variant: any, index: number) => ({
              product_id: productId,
              name: String(variant.title || `Option ${index + 1}`).slice(
                0,
                150,
              ),
              sku: variant.sku ? String(variant.sku).slice(0, 100) : null,
              price: Number.isFinite(Number(variant.price))
                ? Number(variant.price)
                : null,
              stock_quantity: Number.isFinite(
                Number(variant.inventory_quantity),
              )
                ? Math.max(0, Number(variant.inventory_quantity))
                : variant.available
                  ? 1
                  : 0,
              is_active: variant.available !== false,
              display_order: index,
            }));
          const { error: variantError } = await admin
            .from("product_variants")
            .insert(variantRows);
          if (variantError)
            await appendError(
              admin,
              job.id,
              `variants ${sourceId}: ${variantError.message}`,
            );
        }

        if (productId && mirroredImages.length > 1) {
          await admin
            .from("product_images")
            .delete()
            .eq("product_id", productId);
          const rows = mirroredImages.map((url, i) => ({
            product_id: productId,
            image_url: url,
            display_order: i,
            image_alt: row.image_alt ?? row.name,
          }));
          if (rows.length) {
            const { error: imgErr } = await admin
              .from("product_images")
              .insert(rows);
            if (imgErr)
              await appendError(
                admin,
                job.id,
                `gallery ${sourceId}: ${imgErr.message}`,
              );
          }
        }
        done++;
      } catch (err) {
        failed++;
        await recordMap(
          admin,
          job.id,
          "product",
          sourceId,
          null,
          "failed",
          err instanceof Error ? err.message : String(err),
        );
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

    // A sitemap can contain plausible product links while every product page is
    // blocked or unparseable. Never report such a job as a successful import.
    const emptyImport = !hasMore && productsDone + done === 0 && entities.includes("products");
    if (emptyImport) {
      await appendError(admin, job.id, "No products could be extracted from this website. The site may block automated access or omit product data.");
    }
    await admin
      .from("migration_jobs")
      .update({
        progress: newProgress,
        cursor: nextCursor,
        status: hasMore ? "running" : emptyImport ? "failed" : "completed",
        completed_at: hasMore ? null : new Date().toISOString(),
        lease_until: null,
        ...(hasMore ? {} : { credentials: {} }),
      })
      .eq("id", job.id)
      .eq("cancel_requested", false);

    if (hasMore) {
      scheduleWorker(job.id, 250);
    }

    return json({ ok: true, done, failed, hasMore });
  } catch (err) {
    console.error("[migration-worker] fatal:", err);
    return json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown" },
      500,
    );
  }
});

function scheduleWorker(jobId: string, delayMs: number) {
  const work = new Promise<void>((resolve) => setTimeout(resolve, delayMs)).then(async () => {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/migration-worker`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ job_id: jobId }),
    });
  }).catch((error) => console.error("[migration-worker] continuation failed", error));
  // @ts-ignore EdgeRuntime is supplied by the hosted function runtime
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work);
}

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
    {
      job_id: jobId,
      entity_type: entityType,
      source_id: sourceId,
      target_id: targetId,
      status,
      error: error ?? null,
    },
    { onConflict: "job_id,entity_type,source_id" },
  );
}

async function appendError(admin: any, jobId: string, msg: string) {
  const { data } = await admin
    .from("migration_jobs")
    .select("error_log")
    .eq("id", jobId)
    .single();
  const log = Array.isArray(data?.error_log) ? data.error_log : [];
  log.push({ at: new Date().toISOString(), msg });
  await admin
    .from("migration_jobs")
    .update({ error_log: log.slice(-20) })
    .eq("id", jobId);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
