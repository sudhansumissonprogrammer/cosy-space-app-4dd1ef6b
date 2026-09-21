/**
 * Shopify Admin REST adapter.
 */

export interface ShopifyImage {
  id: number;
  src: string;
  alt?: string | null;
}
export interface ShopifyVariant {
  id: number;
  price: string;
  compare_at_price?: string | null;
  sku?: string | null;
  inventory_quantity?: number;
  title?: string;
  available?: boolean;
}
export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html?: string | null;
  vendor?: string;
  product_type?: string;
  status?: string;
  images?: ShopifyImage[];
  image?: ShopifyImage | null;
  variants?: ShopifyVariant[];
  tags?: string | string[];
}

function normHost(url: string): string {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/\/.*/, "")
    .trim();
}

export async function shopifyFetch(
  host: string,
  token: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = `https://${normHost(host)}/admin/api/2024-10${path}`;
  return fetch(url, {
    ...init,
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
}

export async function shopifyCountProducts(
  host: string,
  token: string,
): Promise<number> {
  const res = await shopifyFetch(host, token, "/products/count.json");
  if (!res.ok)
    throw new Error(`Shopify count failed: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return Number(j.count ?? 0);
}

export async function shopifyCountCollections(
  host: string,
  token: string,
): Promise<number> {
  try {
    const r1 = await shopifyFetch(
      host,
      token,
      "/custom_collections/count.json",
    );
    const r2 = await shopifyFetch(host, token, "/smart_collections/count.json");
    const j1 = r1.ok ? await r1.json() : { count: 0 };
    const j2 = r2.ok ? await r2.json() : { count: 0 };
    return Number(j1.count ?? 0) + Number(j2.count ?? 0);
  } catch {
    return 0;
  }
}

export async function shopifyCountOrders(
  host: string,
  token: string,
): Promise<number> {
  const res = await shopifyFetch(host, token, "/orders/count.json?status=any");
  if (!res.ok) return 0;
  const j = await res.json();
  return Number(j.count ?? 0);
}

export async function shopifyCountCustomers(
  host: string,
  token: string,
): Promise<number> {
  const res = await shopifyFetch(host, token, "/customers/count.json");
  if (!res.ok) return 0;
  const j = await res.json();
  return Number(j.count ?? 0);
}

export async function shopifyListProducts(
  host: string,
  token: string,
  sinceId: number,
  limit = 50,
): Promise<{ products: ShopifyProduct[]; nextSinceId: number | null }> {
  const res = await shopifyFetch(
    host,
    token,
    `/products.json?limit=${limit}&since_id=${sinceId}`,
  );
  if (!res.ok)
    throw new Error(`Shopify list failed: ${res.status} ${await res.text()}`);
  const j = await res.json();
  const products = (j.products ?? []) as ShopifyProduct[];
  const nextSinceId =
    products.length === limit ? products[products.length - 1].id : null;
  return { products, nextSinceId };
}

export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/(p|div|h[1-6]|li|ul|ol)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&#x27;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

export function firstVariant(p: ShopifyProduct): ShopifyVariant | undefined {
  return p.variants?.[0];
}

export function shopifyToStorivoProduct(p: ShopifyProduct, storeId: string) {
  const v = firstVariant(p);
  const price = v ? Number(v.price ?? 0) : 0;
  const compare = v?.compare_at_price ? Number(v.compare_at_price) : null;
  const [finalPrice, salePrice] =
    compare && compare > price ? [compare, price] : [price, null];

  return {
    store_id: storeId,
    name: p.title,
    slug: (p.handle || "").toLowerCase().slice(0, 100) || null,
    description: stripHtml(p.body_html),
    price: finalPrice,
    sale_price: salePrice,
    sku: v?.sku ?? null,
    stock_quantity: v?.inventory_quantity ?? (v?.available ? 1 : 0),
    category: p.product_type ?? null,
    is_active: false,
    image_url: p.image?.src ?? p.images?.[0]?.src ?? null,
    image_alt: p.image?.alt ?? p.title,
    source_platform: "shopify",
    source_id: String(p.id),
  };
}

export function shopifyImageUrls(p: ShopifyProduct): string[] {
  const set = new Set<string>();
  if (p.image?.src) set.add(p.image.src);
  for (const img of p.images ?? []) if (img?.src) set.add(img.src);
  return Array.from(set);
}
