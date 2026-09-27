const TRACKING_KEYS = /^(utm_.+|fbclid|gclid|srsltid|ref|referrer|source)$/i;

function cleanUrl(value) {
  try {
    const url = new URL(value, location.href);
    [...url.searchParams.keys()].forEach((key) => {
      if (TRACKING_KEYS.test(key)) url.searchParams.delete(key);
    });
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function numberFrom(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = String(value || "").replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function first(...values) {
  return values.flat(Infinity).find((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function parseJsonScripts() {
  const values = [];
  document.querySelectorAll('script[type="application/ld+json"], script#__NEXT_DATA__').forEach((script) => {
    try { values.push(JSON.parse(script.textContent || "null")); } catch { /* schema drift */ }
  });
  return values;
}

function findProducts(value, found = [], seen = new WeakSet()) {
  if (!value || typeof value !== "object") return found;
  if (seen.has(value)) return found;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item) => findProducts(item, found, seen));
    return found;
  }
  const keys = Object.keys(value);
  const score = ["name", "title", "price", "images", "image", "product_id", "productId", "description"]
    .filter((key) => keys.includes(key)).length;
  if (score >= 3) found.push(value);
  Object.values(value).forEach((item) => findProducts(item, found, seen));
  return found;
}

function imageValues(value) {
  const out = [];
  const visit = (entry) => {
    if (!entry) return;
    if (typeof entry === "string" && /^https:\/\//i.test(entry) && /\.(jpe?g|png|webp)(?:\?|$)/i.test(entry)) out.push(entry);
    else if (Array.isArray(entry)) entry.forEach(visit);
    else if (typeof entry === "object") [entry.url, entry.src, entry.image_url, entry.imageUrl, entry.original].forEach(visit);
  };
  visit(value);
  return out;
}

function videoValues(value) {
  const out = [];
  const visit = (entry) => {
    if (!entry) return;
    if (typeof entry === "string" && /^https:\/\//i.test(entry) && /\.(mp4|webm)(?:\?|$)/i.test(entry)) out.push(entry);
    else if (Array.isArray(entry)) entry.forEach(visit);
    else if (typeof entry === "object") Object.values(entry).forEach(visit);
  };
  visit(value);
  return out;
}

function extract() {
  if (!/(^|\.)meesho\.com$/i.test(location.hostname) || !/\/p\/[a-z0-9]+/i.test(location.pathname)) {
    throw new Error("Open a Meesho product page first.");
  }
  const scripts = parseJsonScripts();
  const candidates = scripts.flatMap((value) => findProducts(value));
  const product = candidates.sort((a, b) => imageValues(b.images || b.image).length - imageValues(a.images || a.image).length)[0] || {};
  const jsonLd = scripts.flatMap((value) => Array.isArray(value) ? value : [value]).find((value) => value?.["@type"] === "Product") || {};
  const canonical = document.querySelector('link[rel="canonical"]')?.href || location.href;
  const sourceId = location.pathname.match(/\/p\/([a-z0-9]+)/i)?.[1] || String(first(product.product_id, product.productId, product.id, ""));
  const name = String(first(jsonLd.name, document.querySelector('meta[property="og:title"]')?.content, product.name, product.title, document.title) || "").replace(/\s*\|\s*Meesho\s*$/i, "").trim();
  const offer = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers || {};
  const selling = numberFrom(first(product.discounted_price, product.discountedPrice, product.selling_price, product.sellingPrice, product.price, offer.price));
  const mrp = numberFrom(first(product.original_price, product.originalPrice, product.mrp, product.max_retail_price, selling));
  const description = String(first(product.description, product.product_description, jsonLd.description, document.querySelector('meta[name="description"]')?.content, "") || "").trim();
  const rawImages = [
    ...imageValues(first(product.images, product.image, product.product_images, [])),
    ...imageValues(jsonLd.image),
    document.querySelector('meta[property="og:image"]')?.content,
  ].filter(Boolean);
  const images = [...new Set(rawImages.map(cleanUrl).filter((url) => /^https:\/\//i.test(url)))].slice(0, 12);
  const domVideos = [...document.querySelectorAll("video")].flatMap((video) => [video.currentSrc, video.src, video.querySelector("source")?.src]).filter(Boolean);
  const videos = [...new Set([...videoValues(product), ...domVideos].map(cleanUrl).filter(Boolean))].slice(0, 2);
  const missing = [];
  if (!name) missing.push("name");
  if (!selling || selling <= 0) missing.push("price");
  if (!images.length) missing.push("photos");
  return {
    source_id: sourceId,
    source_url: cleanUrl(canonical),
    name,
    selling_price: selling,
    original_price: mrp && selling && mrp >= selling ? mrp : selling,
    description,
    images,
    videos,
    captured_at: new Date().toISOString(),
    missing,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "EXTRACT_MEESHO") return;
  try { sendResponse({ ok: true, product: extract() }); }
  catch (error) { sendResponse({ ok: false, error: error instanceof Error ? error.message : "Could not read this page." }); }
});