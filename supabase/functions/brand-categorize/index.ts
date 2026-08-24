// supabase/functions/brand-categorize/index.ts
//
// Builds "<Brand> <Type> <Gender>" categories (e.g. "Rolex Watch Men",
// "Diesel Denim Men") for catalog-synced stores and links every matching
// product into them via the multi-category join table.
//
//   • Brand is detected from the (obfuscated) product title — see
//     _shared/brandTaxonomy.ts
//   • Type + gender come from the product's SOURCE category, so a women's
//     watch can never land in a men's brand category.
//   • Generated categories are marked with display_order >= 1000 and are
//     re-sorted alphabetically on every run.
//   • Idempotent + self-healing: new products from the catalog crons get
//     picked up automatically, stale links and empty brand categories are
//     removed.
//
// Auth: `x-cron-key` matching public.cron_auth (cron), or an admin service call.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  detectBrand,
  taxonOf,
  brandCategoryName,
  slugify,
  BRAND_CAT_ORDER_BASE,
} from "../_shared/brandTaxonomy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-cron-key",
};

/** Stores that get automatic brand categorisation. */
const DEFAULT_STORES = ["hopknock", "utkalwatch"];
/** A brand/type bucket needs at least this many products to become a category. */
const MIN_GROUP = 3;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  image_url: string | null;
  created_at: string;
};

async function fetchAll<T>(
  run: (from: number, to: number) => Promise<{ data: T[] | null; error: any }>,
): Promise<T[]> {
  const out: T[] = [];
  const step = 1000;
  for (let from = 0; ; from += step) {
    const { data, error } = await run(from, from + step - 1);
    if (error) throw new Error(error.message);
    const rows = data || [];
    out.push(...rows);
    if (rows.length < step) break;
  }
  return out;
}

async function categorizeStore(supabase: any, slug: string) {
  const { data: store } = await supabase
    .from("stores")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (!store) return { store: slug, skipped: "store not found" };

  const storeId = store.id as string;

  // 1. Existing categories — generated ones are display_order >= 1000.
  const { data: cats, error: catErr } = await supabase
    .from("categories")
    .select("id, name, slug, display_order, image_url")
    .eq("store_id", storeId);
  if (catErr) throw new Error(catErr.message);

  const generated = new Map<string, any>(); // name → row
  const byName = new Map<string, any>();
  for (const c of cats || []) {
    byName.set(c.name, c);
    if ((c.display_order ?? 0) >= BRAND_CAT_ORDER_BASE) generated.set(c.name, c);
  }

  // 2. All active products.
  const products = await fetchAll<ProductRow>((from, to) =>
    supabase
      .from("products")
      .select("id, name, category, image_url, created_at")
      .eq("store_id", storeId)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .range(from, to),
  );

  // 3. Extra (non-generated) category links, so a product sitting in a second
  //    source category is branded for that type too.
  const links = await fetchAll<{ product_id: string; category_id: string }>((from, to) =>
    supabase
      .from("product_categories")
      .select("product_id, category_id")
      .eq("store_id", storeId)
      .range(from, to),
  );
  const catById = new Map<string, any>((cats || []).map((c: any) => [c.id, c]));
  const extraByProduct = new Map<string, string[]>();
  for (const l of links) {
    const c = catById.get(l.category_id);
    if (!c || (c.display_order ?? 0) >= BRAND_CAT_ORDER_BASE) continue; // ignore generated
    const arr = extraByProduct.get(l.product_id) || [];
    arr.push(c.name);
    extraByProduct.set(l.product_id, arr);
  }

  // 4. Group products into brand buckets.
  const buckets = new Map<string, { ids: string[]; image: string | null }>();
  let unmatched = 0;

  for (const p of products) {
    const brand = detectBrand(p.name || "");
    if (!brand) {
      unmatched++;
      continue;
    }
    const sources = new Set<string>();
    if (p.category) sources.add(p.category);
    for (const extra of extraByProduct.get(p.id) || []) sources.add(extra);

    const targets = new Set<string>();
    for (const src of sources) {
      const tax = taxonOf(src);
      if (!tax) continue;
      targets.add(brandCategoryName(brand, tax, p.name || ""));
    }
    for (const name of targets) {
      const b = buckets.get(name) || { ids: [], image: null };
      b.ids.push(p.id);
      if (!b.image && p.image_url) b.image = p.image_url;
      buckets.set(name, b);
    }
  }

  // 5. Drop tiny buckets, sort alphabetically (character-wise).
  const keep = [...buckets.entries()]
    .filter(([, b]) => b.ids.length >= MIN_GROUP)
    .sort((a, b) => a[0].localeCompare(b[0], "en"));

  // 6. Upsert categories.
  const wantedNames = new Set(keep.map(([n]) => n));
  const catIdByName = new Map<string, string>();
  const toInsert: any[] = [];
  const toUpdate: any[] = [];

  keep.forEach(([name, b], i) => {
    const existing = byName.get(name);
    const display_order = BRAND_CAT_ORDER_BASE + i;
    if (existing) {
      catIdByName.set(name, existing.id);
      if (existing.display_order !== display_order || (!existing.image_url && b.image)) {
        toUpdate.push({ id: existing.id, display_order, image_url: existing.image_url || b.image });
      }
    } else {
      toInsert.push({
        store_id: storeId,
        name,
        slug: slugify(name),
        image_url: b.image,
        display_order,
        show_on_home: false,
      });
    }
  });

  for (let i = 0; i < toInsert.length; i += 200) {
    const chunk = toInsert.slice(i, i + 200);
    const { data, error } = await supabase.from("categories").insert(chunk).select("id, name");
    if (error) throw new Error(`category insert: ${error.message}`);
    for (const c of data || []) catIdByName.set(c.name, c.id);
  }
  for (const u of toUpdate) {
    await supabase
      .from("categories")
      .update({ display_order: u.display_order, image_url: u.image_url })
      .eq("id", u.id);
  }

  // 7. Sync links for generated categories.
  const generatedIds = new Set<string>();
  for (const [name, id] of catIdByName) {
    if (wantedNames.has(name)) generatedIds.add(id);
  }
  for (const [, c] of generated) generatedIds.add(c.id);

  const existingLinkKeys = new Set(
    links.filter((l) => generatedIds.has(l.category_id)).map((l) => `${l.product_id}:${l.category_id}`),
  );

  const wantedKeys = new Set<string>();
  const rowsToInsert: any[] = [];
  for (const [name, b] of keep) {
    const catId = catIdByName.get(name);
    if (!catId) continue;
    for (const pid of b.ids) {
      const key = `${pid}:${catId}`;
      wantedKeys.add(key);
      if (!existingLinkKeys.has(key)) {
        rowsToInsert.push({ product_id: pid, category_id: catId, store_id: storeId, is_primary: false });
      }
    }
  }

  let inserted = 0;
  for (let i = 0; i < rowsToInsert.length; i += 500) {
    const chunk = rowsToInsert.slice(i, i + 500);
    const { error } = await supabase
      .from("product_categories")
      .upsert(chunk, { onConflict: "product_id,category_id", ignoreDuplicates: true });
    if (error) throw new Error(`link insert: ${error.message}`);
    inserted += chunk.length;
  }

  // 8. Remove stale links (product renamed / de-listed / re-categorised).
  const stale = [...existingLinkKeys].filter((k) => !wantedKeys.has(k));
  let removed = 0;
  for (let i = 0; i < stale.length; i += 200) {
    const chunk = stale.slice(i, i + 200);
    for (const key of chunk) {
      const [pid, cid] = key.split(":");
      await supabase.from("product_categories").delete().eq("product_id", pid).eq("category_id", cid);
      removed++;
    }
  }

  // 9. Delete generated categories that no longer have a bucket.
  const emptyIds = [...generated.values()]
    .filter((c) => !wantedNames.has(c.name))
    .map((c) => c.id);
  if (emptyIds.length) {
    await supabase.from("categories").delete().in("id", emptyIds);
  }

  return {
    store: slug,
    products: products.length,
    brandedProducts: products.length - unmatched,
    unmatched,
    categories: keep.length,
    createdCategories: toInsert.length,
    deletedCategories: emptyIds.length,
    linksAdded: inserted,
    linksRemoved: removed,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Auth: cron key
  const cronKey = req.headers.get("x-cron-key");
  const { data: authRow } = await supabase.from("cron_auth").select("secret").limit(1).maybeSingle();
  if (!cronKey || !authRow?.secret || cronKey !== authRow.secret) {
    return json({ error: "unauthorized" }, 401);
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }
  const slugs: string[] = Array.isArray(body?.stores) && body.stores.length ? body.stores : DEFAULT_STORES;

  const results: any[] = [];
  for (const slug of slugs) {
    try {
      results.push(await categorizeStore(supabase, slug));
    } catch (e) {
      results.push({ store: slug, error: String((e as Error)?.message || e) });
    }
  }

  return json({ ok: true, results });
});
