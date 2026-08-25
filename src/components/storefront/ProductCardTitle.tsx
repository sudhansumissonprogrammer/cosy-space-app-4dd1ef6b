import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Product card title with a hard 2-line ceiling on mobile.
 *
 * On phones (<768px) the font size auto-shrinks in small steps until the whole
 * title fits inside `lines` lines — so titles are never truncated mid-word when
 * a slightly smaller size would have fitted. If even the minimum size does not
 * fit, the standard line-clamp ellipsis kicks in.
 *
 * Desktop keeps the original size and simply clamps.
 *
 * PERF: measuring forces layout, and a category grid mounts 60+ of these while
 * the user is scrolling. Three guards keep that off the scroll path:
 *  1. Results are cached per (text + size params + container width), so
 *     re-renders and recycled cards reuse a known-good size with zero reads.
 *  2. Measurement runs inside a single shared rAF batch (one layout flush for
 *     the whole grid instead of one per card).
 *  3. One shared, debounced resize listener + one shared fonts.ready refit for
 *     the whole page instead of one listener per card.
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

/** Cached fit results: key → resolved font size. */
const fitCache = new Map<string, number>();

/** Shared rAF batch so a whole grid causes one layout flush, not N. */
let batch: Set<() => void> | null = null;
let batchFrame = 0;
function scheduleMeasure(fn: () => void) {
  if (!batch) batch = new Set();
  batch.add(fn);
  if (batchFrame) return;
  batchFrame = requestAnimationFrame(() => {
    batchFrame = 0;
    const jobs = batch;
    batch = null;
    jobs?.forEach((job) => {
      try {
        job();
      } catch {}
    });
  });
}

/** Shared refit broadcast (resize / webfont swap) — one listener per page. */
const refitSubs = new Set<() => void>();
let sharedWired = false;
function wireShared() {
  if (sharedWired || typeof window === "undefined") return;
  sharedWired = true;
  let t: number | undefined;
  window.addEventListener(
    "resize",
    () => {
      if (t) window.clearTimeout(t);
      t = window.setTimeout(() => {
        fitCache.clear();
        refitSubs.forEach((fn) => fn());
      }, 200);
    },
    { passive: true },
  );
  (document as any).fonts?.ready
    ?.then(() => {
      fitCache.clear();
      refitSubs.forEach((fn) => fn());
    })
    .catch(() => {});
}

function ProductCardTitleImpl({
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
  const cacheKey = useRef("");
  const [size, setSize] = useState<number>(baseSize);
  const [tick, setTick] = useState(0);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof window === "undefined") return;

    const isMobile = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`).matches;
    if (!isMobile) {
      node.style.fontSize = "";
      setSize(baseSize);
      return;
    }

    // Container width participates in the key: same title at same width always
    // resolves to the same size, so recycled/re-rendered cards skip measuring.
    const width = node.parentElement?.clientWidth || node.clientWidth || 0;
    const key = `${name}|${baseSize}|${minSize}|${lines}|${lineHeight}|${width}|${
      (style as any)?.fontFamily || ""
    }`;
    cacheKey.current = key;
    const cached = fitCache.get(key);
    if (cached !== undefined) {
      node.style.fontSize = `${cached}px`;
      setSize(cached);
      return;
    }

    let cancelled = false;
    scheduleMeasure(() => {
      const el = ref.current;
      if (cancelled || !el || cacheKey.current !== key) return;
      const hit = fitCache.get(key);
      if (hit !== undefined) {
        el.style.fontSize = `${hit}px`;
        setSize(hit);
        return;
      }
      let s = baseSize;
      el.style.fontSize = `${s}px`;
      let guard = 0;
      while (el.scrollHeight > el.clientHeight + 1 && s > minSize && guard++ < 20) {
        s = Math.round((s - 0.5) * 10) / 10;
        el.style.fontSize = `${s}px`;
      }
      fitCache.set(key, s);
      setSize(s);
    });

    return () => {
      cancelled = true;
    };
  }, [name, baseSize, minSize, lines, lineHeight, style, tick]);

  useEffect(() => {
    wireShared();
    const refit = () => setTick((n) => n + 1);
    refitSubs.add(refit);
    return () => {
      refitSubs.delete(refit);
    };
  }, []);

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

const ProductCardTitle = memo(ProductCardTitleImpl);
export default ProductCardTitle;
