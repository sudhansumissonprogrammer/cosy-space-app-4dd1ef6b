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
      className={`font-bold whitespace-nowrap ${size} ${className}`}
      style={{
        fontFamily: "var(--storefront-heading-font, 'Alegreya SC'), serif",
        color: color || undefined,
        // Optical-size normalization so the wordmark keeps the same visual
        // weight/height whichever heading font the merchant picks.
        fontSizeAdjust: "var(--storefront-heading-adjust, none)" as any,
        letterSpacing: "0.04em",
      }}
    >
      {storeName}
    </span>
  );
}

