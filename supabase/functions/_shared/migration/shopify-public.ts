import { readLimitedText, safeFetch } from "./safe-fetch.ts";
import type { ShopifyProduct } from "./shopify.ts";

export interface ShopifyPublicCollection {
  id: number;
  title: string;
  handle: string;
  description?: string | null;
  image?: { src?: string | null; alt?: string | null } | null;
}

function publicRoot(siteUrl: string): string {
  const parsed = new URL(siteUrl);
  return `${parsed.protocol}//${parsed.host}`;
}

async function fetchPublicJson<T>(siteUrl: string, path: string): Promise<T> {
  const root = publicRoot(siteUrl);
  const host = new URL(root).hostname;
  const response = await safeFetch(
    `${root}${path}`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ShopBanaoMigration/1.0; +https://shopbanao.in)",
        Accept: "application/json",
      },
    },
    { timeoutMs: 20_000, maxBytes: 8 * 1024 * 1024, allowedHost: host },
  );
  if (!response.ok)
    throw new Error(`Shopify public catalogue returned ${response.status}`);
  return JSON.parse(await readLimitedText(response, 8 * 1024 * 1024)) as T;
}

export async function shopifyPublicProducts(
  siteUrl: string,
): Promise<ShopifyProduct[]> {
  const result = await fetchPublicJson<{ products?: ShopifyProduct[] }>(
    siteUrl,
    "/products.json?limit=250",
  );
  return Array.isArray(result.products) ? result.products.slice(0, 250) : [];
}

export async function shopifyPublicCollections(
  siteUrl: string,
): Promise<ShopifyPublicCollection[]> {
  const result = await fetchPublicJson<{
    collections?: ShopifyPublicCollection[];
  }>(siteUrl, "/collections.json?limit=250");
  return Array.isArray(result.collections)
    ? result.collections.slice(0, 250)
    : [];
}

export async function shopifyPublicCollectionProductIds(
  siteUrl: string,
  handle: string,
): Promise<string[]> {
  const safeHandle = encodeURIComponent(handle);
  const result = await fetchPublicJson<{ products?: ShopifyProduct[] }>(
    siteUrl,
    `/collections/${safeHandle}/products.json?limit=250`,
  );
  return Array.isArray(result.products)
    ? result.products.map((product) => String(product.id))
    : [];
}

export async function inspectShopifyPublicCatalogue(siteUrl: string) {
  const [products, collections] = await Promise.all([
    shopifyPublicProducts(siteUrl),
    shopifyPublicCollections(siteUrl).catch(
      () => [] as ShopifyPublicCollection[],
    ),
  ]);
  if (!products.length)
    throw new Error("No public Shopify products were found");
  return { products, collections };
}
