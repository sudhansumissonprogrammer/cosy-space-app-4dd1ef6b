import { useCallback, useMemo, useRef } from "react";
import DOMPurify from "dompurify";

interface CustomHtmlRendererProps {
  html: string;
  className?: string;
}

function buildSrcDoc(html: string) {
  const trimmed = html.trim();

  const resizeScript = `<script>
    function _r(){document.body.style.overflow='hidden';var h=document.documentElement.scrollHeight;parent.postMessage({type:'customHtmlHeight',height:h},'*');}
    window.addEventListener('load',_r);
    new MutationObserver(_r).observe(document.body,{childList:true,subtree:true,attributes:true});
    window.addEventListener('resize',_r);
  <\/script>`;

  if (/(<!doctype|<html|<head|<body)/i.test(trimmed)) {
    return trimmed.replace(/<\/body>/i, `${resizeScript}</body>`);
  }

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body { margin: 0; padding: 0; }
      *, *::before, *::after { box-sizing: border-box; }
      img, video, iframe { max-width: 100%; height: auto; }
      iframe { width: 100%; }
      table { width: 100%; border-collapse: collapse; }
    </style>
  </head>
  <body>
    ${trimmed}
    ${resizeScript}
  </body>
</html>`;
}

export default function CustomHtmlRenderer({ html, className = "" }: CustomHtmlRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const srcDoc = useMemo(() => {
    const trimmed = html.trim();
    const isFullDocument = /(?:<!doctype|<html|<head|<body)/i.test(trimmed);

    const sanitized = DOMPurify.sanitize(trimmed, {
      WHOLE_DOCUMENT: isFullDocument,
      ADD_TAGS: ["style", "link"],
      ADD_ATTR: [
        "allow", "allowfullscreen", "frameborder", "scrolling",
        "target", "loading", "rel", "href", "media", "class", "style",
      ],
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
      ALLOW_UNKNOWN_PROTOCOLS: false,
      FORBID_TAGS: ["script"],
      FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
    });

    return buildSrcDoc(sanitized);
  }, [html]);

  const onMessage = useCallback((e: MessageEvent) => {
    if (e.data?.type === "customHtmlHeight" && iframeRef.current) {
      iframeRef.current.style.height = `${e.data.height}px`;
    }
  }, []);

  // Attach listener once
  const listenerAttached = useRef(false);
  if (!listenerAttached.current && typeof window !== "undefined") {
    window.addEventListener("message", (e: MessageEvent) => {
      if (e.data?.type === "customHtmlHeight") {
        const iframe = document.querySelector<HTMLIFrameElement>(
          'iframe[title="Custom HTML content"]'
        );
        if (iframe) iframe.style.height = `${e.data.height}px`;
      }
    });
    listenerAttached.current = true;
  }

  const isFullWidth = !className;
  return (
    <div
      className={className}
      style={isFullWidth ? { width: "100vw", marginLeft: "calc(-50vw + 50%)" } : undefined}
    >
      <iframe
        ref={iframeRef}
        title="Custom HTML content"
        srcDoc={srcDoc}
        className="w-full border-0 bg-transparent"
        style={{ minHeight: "400px", display: "block" }}
        sandbox="allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-scripts"
      />
    </div>
  );
}

