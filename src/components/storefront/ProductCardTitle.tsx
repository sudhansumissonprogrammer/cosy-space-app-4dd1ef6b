import { memo } from "react";

/**
 * Product card title — always a SINGLE line with a trailing ellipsis.
 *
 * Previously this auto-shrank the font size on mobile to squeeze a title into
 * two lines (which forced a layout read per card and made grids janky while
 * scrolling). Cards now keep one consistent font size across the whole grid and
 * simply truncate with "…" when the title is longer than the card.
 *
 * A small leading indent (1ch) keeps the first character from being visually
 * clipped at the card edge on edge-to-edge mobile grids.
 */
interface Props {
  name: string;
  className?: string;
  style?: React.CSSProperties;
  /** Font size in px (same on mobile + desktop) */
  baseSize?: number;
  /** @deprecated kept for API compatibility — no longer used */
  minSize?: number;
  /** @deprecated kept for API compatibility — titles are always one line */
  lines?: number;
  lineHeight?: number;
  /** Reserve the line height so grids stay aligned */
  reserve?: boolean;
}

function ProductCardTitleImpl({
  name,
  className = "",
  style,
  baseSize = 13,
  lineHeight = 1.25,
  reserve = true,
}: Props) {
  return (
    <h3
      className={className}
      title={name}
      style={{
        display: "block",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        fontSize: `${baseSize}px`,
        lineHeight,
        paddingLeft: "1ch",
        ...(reserve ? { minHeight: `${(baseSize * lineHeight).toFixed(1)}px` } : {}),
        ...style,
      }}
    >
      {name}
    </h3>
  );
}

const ProductCardTitle = memo(ProductCardTitleImpl);
export default ProductCardTitle;
