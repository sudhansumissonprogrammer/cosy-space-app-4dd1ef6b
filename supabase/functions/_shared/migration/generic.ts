/**
 * Generic sitemap + JSON-LD scraper.
 * Works for Dukaan, Shopdeck, custom coded stores — anything that exposes a
 * sitemap.xml and Schema.org Product JSON-LD (or Open Graph product metadata).
 */
import {
  assertSafePublicUrl,
  readLimitedText,
  safeFetch,
} from "./safe-fetch.ts";

function root(url: string): string {
  const parsed = assertSafePublicUrl(url);
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function absolutize(maybeRelative: string, pageUrl: string): string {
  try {
    return new URL(maybeRelative, pageUrl).toString();
  } catch {
    return maybeRelative;
  }
}

async function fetchText(url: string, timeoutMs = 15_000): Promise<string> {
  const allowedHost = assertSafePublicUrl(url).hostname;
  const res = await safeFetch(
    url,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; StorivoMigration/1.0; +https://shopbanao.in)",
        Accept: "text/html,application/xhtml+xml,application/xml,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    },
    { timeoutMs, maxBytes: 5 * 1024 * 1024, allowedHost },
  );
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return readLimitedText(res, 5 * 1024 * 1024);
}

function extractLocs(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(xml))) out.push(m[1].trim());
  return out;
}

export async function discoverProductUrls(
  siteUrl: string,
  limit = 500,
): Promise<string[]> {
  const base = root(siteUrl);
  const candidates = [
    `${base}/sitemap.xml`,
    `${base}/sitemap_index.xml`,
    `${base}/sitemap-products.xml`,
    `${base}/product-sitemap.xml`,
    `${base}/wp-sitemap-posts-product-1.xml`,
    `${base}/sitemap-product.xml`,
    `${base}/sitemaps/products.xml`,
    `${base}/sitemap-products-1.xml`,
    `${base}/sitemap/products.xml`,
  ];

  try {
    const robots = await fetchText(`${base}/robots.txt`, 8_000);
    for (const line of robots.split(/\r?\n/)) {
      const m = line.match(/^\s*sitemap\s*:\s*(\S+)/i);
      if (m) {
        const abs = absolutize(m[1], base);
        if (abs.startsWith("http") && !candidates.includes(abs))
          candidates.push(abs);
      }
    }
  } catch {
    /* no robots — fine */
  }

  const collected = new Set<string>();
  const productPatterns = [
    /\/product\//i,
    /\/products\//i,
    /\/p\//i,
    /\/item\//i,
    /\/shop\//i,
    /\/store\//i,
    /\/collections\/[^/]+\/products\//i,
    /\/catalogue\//i,
    /\/catalog\//i,
  ];
  const excludePatterns = [
    /\/(about|about-us|contact|contact-us|faq|help|support)(\/|$)/i,
    /\/(privacy|privacy-policy|terms|terms-and-conditions|terms-of-service|refund|refund-policy|return|return-policy|shipping|shipping-policy|cookie|cookies)(\/|$)/i,
    /\/(cart|checkout|account|login|register|signup|sign-in|sign-up|wishlist|orders|profile)(\/|$)/i,
    /\/(search|blog|blogs|posts|articles|news|pages|policies|featured|collections?|categories|category|tags?)(\/|$|\?)/i,
    /\/(sitemap|robots)/i,
    /\.(pdf|jpg|jpeg|png|webp|gif|svg|xml|txt|css|js|json)(\?|$)/i,
  ];
  const isProductish = (u: string): boolean => {
    if (excludePatterns.some((p) => p.test(u))) return false;
    if (productPatterns.some((p) => p.test(u))) return true;
    try {
      const pn = new URL(u).pathname.replace(/\/+$/, "");
      const segments = pn.split("/").filter(Boolean);
      const last = pn.split("/").pop() || "";
      if (segments.length >= 3 && !last.includes(".") && last.length >= 4)
        return true;
    } catch {
      /* ignore */
    }
    return false;
  };

  const visited = new Set<string>();
  async function walkSitemap(smUrl: string, depth: number): Promise<void> {
    if (visited.has(smUrl) || collected.size >= limit || depth > 2) return;
    visited.add(smUrl);
    let xml: string;
    try {
      xml = await fetchText(smUrl);
    } catch {
      return;
    }
    const locs = extractLocs(xml);
    const subSitemaps = locs.filter((u) => /\.xml(\?|$)/i.test(u));
    const pageUrls = locs.filter((u) => !/\.xml(\?|$)/i.test(u));
    for (const u of pageUrls) {
      if (isProductish(u)) collected.add(u);
      if (collected.size >= limit) return;
    }
    for (const sub of subSitemaps.slice(0, 30)) {
      if (collected.size >= limit) return;
      if (
        /product|shop|item|collection|store/i.test(sub) ||
        subSitemaps.length <= 5
      ) {
        await walkSitemap(sub, depth + 1);
      }
    }
  }

  for (const smUrl of candidates) {
    if (collected.size >= limit) break;
    await walkSitemap(smUrl, 0);
  }

  if (collected.size === 0) {
    try {
      const home = await fetchText(base);
      const hostBase = new URL(base).host;
      const anchorRe = /<a[^>]+href=["']([^"']+)["']/gi;
      let m;
      while ((m = anchorRe.exec(home))) {
        const href = m[1];
        if (!href || href.startsWith("#") || href.startsWith("mailto:"))
          continue;
        const abs = absolutize(href, base);
        try {
          const u = new URL(abs);
          if (u.host !== hostBase) continue;
          if (isProductish(abs)) collected.add(abs.split("#")[0].split("?")[0]);
          if (collected.size >= Math.min(limit, 100)) break;
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* give up quietly */
    }
  }

  return Array.from(collected).slice(0, limit);
}

export interface ScrapedProduct {
  source_id: string;
  name: string;
  slug: string | null;
  description: string;
  price: number;
  sale_price: number | null;
  sku: string | null;
  image_url: string | null;
  image_alt: string;
  category: string | null;
  image_urls: string[];
  currency: string | null;
  availability: string | null;
}

function extractJsonLd(html: string): any[] {
  const out: any[] = [];
  const re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (Array.isArray(parsed)) out.push(...parsed);
      else if (parsed["@graph"]) out.push(...parsed["@graph"]);
      else out.push(parsed);
    } catch {
      /* ignore malformed */
    }
  }
  return out;
}

function findProductNode(nodes: any[]): any | null {
  for (const n of nodes) {
    const t = n?.["@type"];
    if (t === "Product" || (Array.isArray(t) && t.includes("Product")))
      return n;
  }
  return null;
}

function metaContent(
  html: string,
  prop: string,
  attr: "property" | "name" = "property",
): string | null {
  const re = new RegExp(
    `<meta[^>]+${attr}=["']${prop}["'][^>]*content=["']([^"']+)["']`,
    "i",
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]*${attr}=["']${prop}["']`,
    "i",
  );
  return html.match(re)?.[1] ?? html.match(alt)?.[1] ?? null;
}

function stripTags(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface PublicSiteProfile {
  platform: "shopify" | "woocommerce" | "dukaan" | "generic";
  title: string | null;
  description: string | null;
  logo_url: string | null;
  hero_url: string | null;
  pages: Array<{
    type: "about" | "contact" | "privacy" | "terms" | "shipping" | "returns";
    title: string;
    url: string;
  }>;
}

export async function inspectPublicSite(
  siteUrl: string,
): Promise<PublicSiteProfile> {
  const base = root(siteUrl);
  const html = await fetchText(base, 15_000);
  const lower = html.toLowerCase();
  const platform: PublicSiteProfile["platform"] =
    lower.includes("cdn.shopify.com") || lower.includes("shopify.theme")
      ? "shopify"
      : lower.includes("woocommerce") ||
          lower.includes("wp-content/plugins/woocommerce")
        ? "woocommerce"
        : lower.includes("dukaan")
          ? "dukaan"
          : "generic";
  const title =
    metaContent(html, "og:site_name") ||
    metaContent(html, "og:title") ||
    stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "") ||
    null;
  const description =
    metaContent(html, "og:description") ||
    metaContent(html, "description", "name");
  const logoMatch =
    html.match(
      /<img[^>]+(?:class|id)=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["']/i,
    ) ||
    html.match(
      /<img[^>]+src=["']([^"']+)["'][^>]+(?:class|id)=["'][^"']*logo/i,
    ) ||
    html.match(/<img[^>]+src=["']([^"']*logo[^"']*)["']/i);
  const definitions: Array<
    [PublicSiteProfile["pages"][number]["type"], string, RegExp]
  > = [
    ["about", "About Us", /\/(about|about-us)(\/|$)/i],
    ["contact", "Contact", /\/(contact|contact-us)(\/|$)/i],
    ["privacy", "Privacy Policy", /\/(privacy|privacy-policy)(\/|$)/i],
    [
      "terms",
      "Terms",
      /\/(terms|terms-and-conditions|terms-of-service)(\/|$)/i,
    ],
    ["shipping", "Shipping Policy", /\/(shipping|shipping-policy)(\/|$)/i],
    [
      "returns",
      "Returns Policy",
      /\/(returns?|refund|refund-policy|return-policy)(\/|$)/i,
    ],
  ];
  const pages: PublicSiteProfile["pages"] = [];
  const anchorRe = /<a[^>]+href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRe.exec(html)) && pages.length < definitions.length) {
    const absolute = absolutize(match[1], base).split("#")[0];
    try {
      if (new URL(absolute).hostname !== new URL(base).hostname) continue;
      const page = definitions.find(
        ([type, , pattern]) =>
          pattern.test(new URL(absolute).pathname) &&
          !pages.some((p) => p.type === type),
      );
      if (page) pages.push({ type: page[0], title: page[1], url: absolute });
    } catch {
      /* ignore malformed links */
    }
  }
  if (platform === "shopify") {
    const policies: Array<
      [PublicSiteProfile["pages"][number]["type"], string, string]
    > = [
      ["privacy", "Privacy Policy", "/policies/privacy-policy"],
      ["terms", "Terms", "/policies/terms-of-service"],
      ["shipping", "Shipping Policy", "/policies/shipping-policy"],
      ["returns", "Returns Policy", "/policies/refund-policy"],
    ];
    for (const [type, pageTitle, path] of policies) {
      if (!pages.some((page) => page.type === type)) {
        pages.push({ type, title: pageTitle, url: absolutize(path, base) });
      }
    }
  }
  const logoUrl = logoMatch?.[1] ? absolutize(logoMatch[1], base) : null;
  const hero =
    metaContent(html, "og:image:secure_url") || metaContent(html, "og:image");
  const heroUrl = hero ? absolutize(hero, base) : null;
  return {
    platform,
    title: title?.slice(0, 200) || null,
    description: description?.slice(0, 500) || null,
    logo_url: logoUrl,
    hero_url: heroUrl && heroUrl !== logoUrl ? heroUrl : null,
    pages,
  };
}

export async function scrapePublicPage(url: string): Promise<string | null> {
  const html = await fetchText(url, 15_000);
  const main =
    html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] ||
    html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1] ||
    html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ||
    "";
  const text = stripTags(main).slice(0, 12_000);
  return text.length >= 40 ? text : null;
}

function slugFromUrl(u: string): string | null {
  try {
    const p = new URL(u).pathname.replace(/\/+$/, "");
    const last = p.split("/").filter(Boolean).pop();
    return last ? last.slice(0, 100).toLowerCase() : null;
  } catch {
    return null;
  }
}

function parsePrice(v: any): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function extractCategoryFromBreadcrumb(nodes: any[]): string | null {
  for (const n of nodes) {
    const t = n?.["@type"];
    if (
      t === "BreadcrumbList" ||
      (Array.isArray(t) && t.includes("BreadcrumbList"))
    ) {
      const items = Array.isArray(n.itemListElement) ? n.itemListElement : [];
      const cat = items.length >= 2 ? items[items.length - 2] : null;
      const name = cat?.name || cat?.item?.name;
      if (typeof name === "string" && name.trim())
        return name.trim().slice(0, 100);
    }
  }
  return null;
}

function extractCategoryFromNode(node: any): string | null {
  const c = node?.category;
  if (!c) return null;
  if (typeof c === "string") return c.slice(0, 100);
  if (Array.isArray(c) && c.length) {
    const first = c[0];
    if (typeof first === "string") return first.slice(0, 100);
    if (first?.name) return String(first.name).slice(0, 100);
  }
  if (c?.name) return String(c.name).slice(0, 100);
  return null;
}

export async function scrapeProduct(
  url: string,
): Promise<ScrapedProduct | null> {
  const html = await fetchText(url, 20_000);

  const nodes = extractJsonLd(html);
  const node = findProductNode(nodes);

  let name =
    node?.name ||
    metaContent(html, "og:title") ||
    metaContent(html, "title", "name") ||
    "";
  let description =
    (typeof node?.description === "string" ? node.description : "") ||
    metaContent(html, "og:description") ||
    metaContent(html, "description", "name") ||
    "";
  let image: string | null =
    (typeof node?.image === "string"
      ? node.image
      : Array.isArray(node?.image)
        ? typeof node.image[0] === "string"
          ? node.image[0]
          : node.image[0]?.url
        : node?.image?.url) ||
    metaContent(html, "og:image") ||
    metaContent(html, "twitter:image", "name") ||
    null;
  if (image) image = absolutize(image, url);

  const galleryRaw: string[] = [];
  const nodeImg = node?.image;
  if (typeof nodeImg === "string") galleryRaw.push(nodeImg);
  else if (Array.isArray(nodeImg)) {
    for (const it of nodeImg) {
      if (typeof it === "string") galleryRaw.push(it);
      else if (it?.url) galleryRaw.push(String(it.url));
    }
  } else if (nodeImg?.url) {
    galleryRaw.push(String(nodeImg.url));
  }
  if (image) galleryRaw.push(image);
  const image_urls = Array.from(
    new Set(galleryRaw.map((u) => absolutize(u, url))),
  ).filter(Boolean);

  let price = 0;
  let salePrice: number | null = null;
  const offer = Array.isArray(node?.offers) ? node.offers[0] : node?.offers;
  let currency: string | null = null;
  let availability: string | null = null;
  if (offer) {
    price = parsePrice(offer.price ?? offer.lowPrice ?? offer.highPrice);
    if (offer.priceSpecification?.price)
      price = parsePrice(offer.priceSpecification.price);
    if (offer.priceSpecification?.strikethroughPrice) {
      const strike = parsePrice(offer.priceSpecification.strikethroughPrice);
      if (strike > price) {
        salePrice = price;
        price = strike;
      }
    }
    currency =
      String(
        offer.priceCurrency || offer.priceSpecification?.priceCurrency || "",
      ).toUpperCase() || null;
    availability =
      typeof offer.availability === "string" ? offer.availability : null;
  } else {
    const og =
      metaContent(html, "product:price:amount") ||
      metaContent(html, "og:price:amount");
    price = parsePrice(og);
  }

  const sku = node?.sku ? String(node.sku) : null;
  const category =
    extractCategoryFromNode(node) ?? extractCategoryFromBreadcrumb(nodes);

  if (!name) {
    name = (html.match(/<title>([^<]+)<\/title>/i)?.[1] || "").trim();
  }

  if (!name || (!image && !price)) return null;

  return {
    source_id: url,
    name: name.slice(0, 250),
    slug: slugFromUrl(url),
    description: description.replace(/\s+/g, " ").trim().slice(0, 4000),
    price,
    sale_price: salePrice,
    sku,
    image_url: image,
    image_alt: name,
    category,
    image_urls,
    currency,
    availability,
  };
}

export function scrapedToStorivoProduct(
  p: ScrapedProduct,
  storeId: string,
  platform: string,
) {
  return {
    store_id: storeId,
    name: p.name,
    slug: p.slug,
    description: p.description,
    price: p.price,
    sale_price: p.sale_price,
    sku: p.sku,
    stock_quantity: /instock/i.test(p.availability || "") ? 1 : 0,
    category: p.category,
    is_active: false,
    image_url: p.image_url,
    image_alt: p.image_alt,
    source_platform: platform,
    source_id: p.source_id,
  };
}
