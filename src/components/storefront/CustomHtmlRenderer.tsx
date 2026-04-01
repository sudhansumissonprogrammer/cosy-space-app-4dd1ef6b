import { useMemo } from "react";
import DOMPurify from "dompurify";

interface CustomHtmlRendererProps {
  html: string;
  className?: string;
}

function buildSrcDoc(html: string) {
  const trimmed = html.trim();
  if (/(<!doctype|<html|<head|<body)/i.test(trimmed)) {
    return trimmed;
  }

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
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
  </head>
  <body>
    ${trimmed}
  </body>
</html>`;
}

export default function CustomHtmlRenderer({ html, className = "" }: CustomHtmlRendererProps) {
  const srcDoc = useMemo(() => {
    const trimmed = html.trim();
    const isFullDocument = /(?:<!doctype|<html|<head|<body)/i.test(trimmed);

    const sanitized = DOMPurify.sanitize(trimmed, {
      WHOLE_DOCUMENT: isFullDocument,
      ADD_TAGS: ["iframe", "style", "link"],
      ADD_ATTR: [
        "allow",
        "allowfullscreen",
        "frameborder",
        "scrolling",
        "target",
        "loading",
        "rel",
        "href",
        "media",
        "class",
        "style",
      ],
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
      FORBID_TAGS: ["script"],
      FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
    });

    return buildSrcDoc(sanitized);
  }, [html]);

  return (
    <div className={className}>
      <iframe
        title="Custom HTML content"
        srcDoc={srcDoc}
        className="storefront-custom-html min-h-[600px] w-full border-0 bg-transparent"
        sandbox="allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}

