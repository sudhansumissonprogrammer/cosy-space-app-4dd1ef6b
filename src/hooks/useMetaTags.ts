import { useEffect } from "react";
import { getStoreBaseUrl } from "@/lib/storeUrl";

interface MetaTagsOptions {
  enabled?: boolean;
  title?: string;
  description?: string;
  ogImage?: string;
  ogType?: string;
  canonicalPath?: string;
  storeSlug?: string;
  /** Custom domain if configured — used to build correct canonical URL */
  customDomain?: string | null;
  noIndex?: boolean;
}

function setMeta(name: string, content: string, attr = "name") {
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function useMetaTags({ enabled = true, title, description, ogImage, ogType = "website", canonicalPath, storeSlug, customDomain, noIndex = false }: MetaTagsOptions) {
  useEffect(() => {
    if (!enabled) return;
    const prevTitle = document.title;
    if (title) document.title = title;
    setMeta("description", description || "");
    if (title) {
      setMeta("og:title", title, "property");
      setMeta("twitter:title", title, "name");
    }
    setMeta("og:description", description || "", "property");
    setMeta("twitter:description", description || "", "name");
    setMeta("og:image", ogImage || "", "property");
    setMeta("twitter:image", ogImage || "", "name");
    setMeta("robots", noIndex ? "noindex,follow" : "index,follow,max-image-preview:large");
    setMeta("og:type", ogType, "property");

    // Canonical URL — prefer custom domain, then subdomain
    if (storeSlug) {
      const base = getStoreBaseUrl(storeSlug, customDomain);
      const canonical = canonicalPath ? `${base}/${canonicalPath}` : base;
      setLink("canonical", canonical);
      setMeta("og:url", canonical, "property");
    }

    return () => {
      // A departing route must not remove a newer route's canonical.
      if (title && document.title === title) document.title = prevTitle;
    };
  }, [enabled, title, description, ogImage, ogType, canonicalPath, storeSlug, customDomain, noIndex]);
}
