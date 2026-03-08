import { useEffect } from "react";

interface MetaTagsOptions {
  title?: string;
  description?: string;
  ogImage?: string;
  ogType?: string;
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

export function useMetaTags({ title, description, ogImage, ogType = "website" }: MetaTagsOptions) {
  useEffect(() => {
    const prevTitle = document.title;
    if (title) document.title = title;
    if (description) setMeta("description", description);
    if (title) setMeta("og:title", title, "property");
    if (description) setMeta("og:description", description, "property");
    if (ogImage) setMeta("og:image", ogImage, "property");
    setMeta("og:type", ogType, "property");

    return () => {
      document.title = prevTitle;
    };
  }, [title, description, ogImage, ogType]);
}
