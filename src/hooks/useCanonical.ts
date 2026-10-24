import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { discoveryPage } from "@/lib/catalogueDiscovery";

/**
 * Maintains a single <link rel="canonical"> tag in <head> for the current
 * page. Updates on navigation so Googlebot's JS-rendering pass always sees
 * the correct canonical (the Cloudflare Worker only sets it on the first
 * HTML response; SPA navigation never updates it otherwise).
 *
 * Pass an absolute URL (e.g. `https://brand.shopbanao.in/shop`) or a relative
 * path; relative paths are resolved against the current origin at write time.
 */
export function useCanonical(url: string | null | undefined) {
  const { search } = useLocation();
  useEffect(() => {
    if (!url) return;
    let href = /^https?:\/\//i.test(url)
      ? url
      : `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;

    const target = new URL(href);
    const page = discoveryPage(new URLSearchParams(search).get("page"));
    if (/\/(category\/[^/]+|shop|best-sellers)\/?$/.test(target.pathname)) {
      target.search = "";
      if (page !== null && page > 1) target.searchParams.set("page", String(page));
      href = target.href;
    }
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = href;

    // Mirror to og:url so social previews stay in sync with the canonical.
    let og = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (!og) {
      og = document.createElement("meta");
      og.setAttribute("property", "og:url");
      document.head.appendChild(og);
    }
    og.content = href;
    // Leave the tag in place until the next route writes its own value.
    // Restoring a previous URL here races the next route's mount effects.
  }, [url, search]);
}
