import { useEffect } from "react";

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
  useEffect(() => {
    if (!url) return;
    const href = /^https?:\/\//i.test(url)
      ? url
      : `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;

    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    const prev = link.href;
    link.href = href;

    // Mirror to og:url so social previews stay in sync with the canonical.
    let og = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (!og) {
      og = document.createElement("meta");
      og.setAttribute("property", "og:url");
      document.head.appendChild(og);
    }
    const prevOg = og.content;
    og.content = href;

    return () => {
      // Restore previous value on unmount so the next route can take over
      // cleanly without leaving a stale URL behind.
      if (link && prev) link.href = prev;
      if (og && prevOg) og.content = prevOg;
    };
  }, [url]);
}
