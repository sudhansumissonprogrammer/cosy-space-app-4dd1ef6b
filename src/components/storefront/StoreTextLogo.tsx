/**
 * Text-based logo fallback.
 * Renders the store name as a typographic logo
 * when no logo image is uploaded.
 */
interface StoreTextLogoProps {
  storeName: string;
  /** Tailwind text size class, e.g. "text-lg", "text-2xl" */
  size?: string;
  /** Additional classes */
  className?: string;
  /** Override color via inline style */
  color?: string;
}

export default function StoreTextLogo({
  storeName,
  size = "text-xl",
  className = "",
  color,
}: StoreTextLogoProps) {
  return (
    <span
      className={`font-bold tracking-wide whitespace-nowrap ${size} ${className}`}
      style={{
        fontFamily: "var(--storefront-heading-font, 'Alegreya SC'), serif",
        color: color || undefined,
        letterSpacing: "0.04em",
      }}
    >
      {storeName}
    </span>
  );
}
