import { readFileSync } from "node:fs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

const html = readFileSync("index.html", "utf8");
const start = html.indexOf("window.__sfInjectImgPreloads__=function(products){");
const end = html.indexOf("\n        };", start) + "\n        };".length;
const bootstrap = html.slice(start, end);
const photo = "https://cdn.shopbanao.in/product-images/store/1791307529627-photo-1200w.webp";

function preload(path: string, photos: string[]) {
  history.replaceState(null, "", path);
  window.eval(bootstrap);
  (window as unknown as { __sfInjectImgPreloads__: (rows: { image_url: string }[]) => void }).__sfInjectImgPreloads__(photos.map(image_url => ({ image_url })));
  return Array.from(document.querySelectorAll<HTMLLinkElement>("link[data-sf-img-pre]")).map(link => link.href);
}

beforeEach(() => document.querySelectorAll("link[data-sf-img-pre]").forEach(node => node.remove()));
afterEach(() => history.replaceState(null, "", "/"));

describe("route-aware opening photo hints", () => {
  it("preloads one canonical PDP photo, not the gallery", () => {
    expect(preload("/product/test", [photo, photo.replace("photo", "other")])).toEqual([photo]);
  });
  it("preloads at most two matching modern category card files", () => {
    expect(preload("/category/test", [photo, photo.replace("photo", "other"), photo.replace("photo", "third")])).toEqual([photo.replace("1200w", "800w"), photo.replace("photo", "other").replace("1200w", "800w")]);
  });
  it("preserves old card families", () => {
    const legacy = photo.replace("1791307529627", "1790747948999");
    expect(preload("/store/demo/category/test", [legacy])).toEqual([legacy.replace("1200w", "400w")]);
  });
  it("does not prepare arbitrary homepage or saved catalog photos", () => {
    expect(preload("/", [photo])).toEqual([]);
    expect(preload("/store/demo", [photo])).toEqual([]);
  });
  it("never invents tiny siblings or alter raw imports", () => {
    const raw = "https://cdn.shopbanao.in/product-images/migrated/raw.avif";
    expect(preload("/category/test", [raw, photo.replace("1791307529627-photo", "unknown")])).toEqual([raw, photo.replace("1791307529627-photo", "unknown")]);
  });
});