import { useEffect, useMemo, useRef } from "react";
import DOMPurify from "dompurify";

interface CustomHtmlRendererProps {
  html: string;
  className?: string;
}

function extractRenderableHtml(html: string) {
  if (typeof window === "undefined" || !/(<html|<head|<body)/i.test(html)) {
    return html;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const headStyles = Array.from(doc.head.querySelectorAll("style"))
      .map((styleTag) => styleTag.outerHTML)
      .join("\n");
    const bodyHtml = doc.body?.innerHTML?.trim() || html;

    return `${headStyles}\n${bodyHtml}`.trim();
  } catch {
    return html;
  }
}

export default function CustomHtmlRenderer({ html, className = "" }: CustomHtmlRendererProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);

  const sanitized = useMemo(() => {
    const renderableHtml = extractRenderableHtml(html);

    return DOMPurify.sanitize(renderableHtml, {
      ADD_TAGS: ["iframe", "style"],
      ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling", "target", "loading"],
      FORBID_TAGS: ["script"],
      FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
    });
  }, [html]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const shadowRoot = shadowRootRef.current ?? host.attachShadow({ mode: "open" });
    shadowRootRef.current = shadowRoot;

    shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          color: hsl(var(--foreground));
        }

        *, *::before, *::after {
          box-sizing: border-box;
        }

        img, video, iframe {
          max-width: 100%;
          height: auto;
        }

        iframe {
          width: 100%;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }
      </style>
      ${sanitized}
    `;
  }, [sanitized]);

  return <div ref={hostRef} className={`storefront-custom-html ${className}`} />;
}
