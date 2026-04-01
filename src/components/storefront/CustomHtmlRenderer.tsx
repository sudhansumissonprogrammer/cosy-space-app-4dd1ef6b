import DOMPurify from "dompurify";

interface CustomHtmlRendererProps {
  html: string;
  className?: string;
}

export default function CustomHtmlRenderer({ html, className = "" }: CustomHtmlRendererProps) {
  const sanitized = DOMPurify.sanitize(html, {
    ADD_TAGS: ["iframe", "style"],
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling", "target", "loading"],
    FORBID_TAGS: ["script"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
  });

  return (
    <div
      className={`storefront-custom-html ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
