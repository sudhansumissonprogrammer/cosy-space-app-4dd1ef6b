/**
 * WooCommerce REST API adapter (v3).
 */

export interface WooImage { id: number; src: string; alt?: string }
export interface WooProduct {
  id: number;
  name: string;
  slug: string;
  description?: string;
  short_description?: string;
  price?: string;
  regular_price?: string;
  sale_price?: string;
  sku?: string;
  stock_quantity?: number | null;
  status?: string;
  categories?: { id: number; name: string; slug: string }[];
  images?: WooImage[];
}

function base(host: string): string {
  const clean = host.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return `https://${clean}/wp-json/wc/v3`;
}

function authHeader(key: string, secret: string): string {
  return "Basic " + btoa(`${key}:${secret}`);
}

export async function wooFetch(
  host: string,
  key: string,
  secret: string,
  path: string,
): Promise<Response> {
  return fetch(`${base(host)}${path}`, {
    headers: {
      Authorization: authHeader(key, secret),
      "Content-Type": "application/json",
      "User-Agent": "Storivo-Migration/1.0",
    },
  });
}

async function countVia(host: string, key: string, secret: string, path: string): Promise<number> {
  const res = await wooFetch(host, key, secret, `${path}${path.includes("?") ? "&" : "?"}per_page=1`);
  if (!res.ok) throw new Error(`WooCommerce ${path} -> ${res.status} ${await res.text()}`);
  await res.text();
  const total = res.headers.get("x-wp-total") ?? res.headers.get("X-WP-Total") ?? "0";
  return Number(total);
}

export const wooCountProducts = (h: string, k: string, s: string) => countVia(h, k, s, "/products");
export const wooCountCategories = (h: string, k: string, s: string) => countVia(h, k, s, "/products/categories");
export const wooCountOrders = (h: string, k: string, s: string) => countVia(h, k, s, "/orders");
export const wooCountCustomers = (h: string, k: string, s: string) => countVia(h, k, s, "/customers");

export async function wooListProducts(
  host: string,
  key: string,
  secret: string,
  page: number,
  perPage = 50,
): Promise<{ products: WooProduct[]; hasMore: boolean }> {
  const res = await wooFetch(host, key, secret, `/products?per_page=${perPage}&page=${page}&status=any`);
  if (!res.ok) throw new Error(`WooCommerce list failed: ${res.status} ${await res.text()}`);
  const products = (await res.json()) as WooProduct[];
  const totalPages = Number(res.headers.get("x-wp-totalpages") ?? res.headers.get("X-WP-TotalPages") ?? "1");
  return { products, hasMore: page < totalPages };
}

export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .trim();
}

export function wooToStorivoProduct(p: WooProduct, storeId: string) {
  const priceNum = Number(p.regular_price || p.price || 0);
  const saleNum = p.sale_price ? Number(p.sale_price) : null;
  const [finalPrice, salePrice] =
    saleNum && saleNum > 0 && priceNum > 0 && saleNum < priceNum
      ? [priceNum, saleNum]
      : [priceNum || Number(p.price || 0), null];

  return {
    store_id: storeId,
    name: p.name,
    slug: (p.slug || "").toLowerCase().slice(0, 100) || null,
    description: stripHtml(p.description || p.short_description),
    price: finalPrice,
    sale_price: salePrice,
    sku: p.sku ?? null,
    stock_quantity: typeof p.stock_quantity === "number" ? p.stock_quantity : 0,
    category: p.categories?.[0]?.name ?? null,
    is_active: false,
    image_url: p.images?.[0]?.src ?? null,
    image_alt: p.images?.[0]?.alt || p.name,
    source_platform: "woocommerce",
    source_id: String(p.id),
  };
}

export function wooImageUrls(p: WooProduct): string[] {
  const set = new Set<string>();
  for (const img of p.images ?? []) if (img?.src) set.add(img.src);
  return Array.from(set);
}
