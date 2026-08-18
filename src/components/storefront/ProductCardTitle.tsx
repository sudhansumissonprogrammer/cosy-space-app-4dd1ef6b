import { useLayoutEffect, useRef, useState } from "react";

/**
 * Product card title with a hard 2-line ceiling on mobile.
 *
 * On phones (<768px) the font size auto-shrinks in small steps until the whole
 * title fits inside `lines` lines — so titles are never truncated mid-word when
 * a slightly smaller size would have fitted. If even the minimum size does not
 * fit, the standard line-clamp ellipsis kicks in.
 *
 * Desktop keeps the original size and simply clamps.
 */
interface Props {
  name: string;
  className?: string;
  style?: React.CSSProperties;
  /** Base (desktop + mobile starting) font size in px */
  baseSize?: number;
  /** Smallest font size we are willing to shrink to on mobile */
  minSize?: number;
  lines?: number;
  lineHeight?: number;
  /** Reserve the full clamp height so grids stay aligned */
  reserve?: boolean;
}

const MOBILE_MAX = 767;

export default function ProductCardTitle({
  name,
  className = "",
  style,
  baseSize = 13,
  minSize = 10,
  lines = 2,
  lineHeight = 1.25,
  reserve = true,
}: Props) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [size, setSize] = useState<number>(baseSize);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      const node = ref.current;
      if (!node) return;
      const isMobile = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`).matches;
      if (!isMobile) {
        node.style.fontSize = "";
        setSize(baseSize);
        return;
      }
      let s = baseSize;
      node.style.fontSize = `${s}px`;
      let guard = 0;
      while (node.scrollHeight > node.clientHeight + 1 && s > minSize && guard++ < 20) {
        s = Math.round((s - 0.5) * 10) / 10;
        node.style.fontSize = `${s}px`;
      }
      setSize(s);
    };

    fit();
    // Re-measure once webfonts settle (metrics change after swap)
    (document as any).fonts?.ready?.then(() => fit()).catch(() => {});

    const onResize = () => fit();
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [name, baseSize, minSize, lines]);

  return (
    <h3
      ref={ref}
      className={className}
      style={{
        display: "-webkit-box",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: lines,
        overflow: "hidden",
        fontSize: `${size}px`,
        lineHeight,
        ...(reserve ? { minHeight: `${(baseSize * lineHeight * lines).toFixed(1)}px` } : {}),
        ...style,
      }}
    >
      {name}
    </h3>
  );
}
