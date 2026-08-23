import { useEffect, useRef } from "react";
import { liquidGlass, type LiquidGlassOptions, type LiquidGlassHandle } from "@/lib/liquidGlass";

/**
 * Attach Apple-style liquid glass refraction to an element.
 *
 *   const ref = useLiquidGlass<HTMLDivElement>({ scale: -90 });
 *   <div ref={ref} className="lg-surface">…</div>
 *
 * Pass `enabled: false` to opt out (e.g. low-end devices or a theme toggle).
 */
export function useLiquidGlass<T extends HTMLElement = HTMLDivElement>(
  options: LiquidGlassOptions & { enabled?: boolean } = {},
) {
  const ref = useRef<T | null>(null);
  const { enabled = true, ...opts } = options;
  // Serialize so callers can pass an inline object without re-running forever.
  const key = JSON.stringify(opts);

  useEffect(() => {
    if (!enabled || !ref.current) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      // Still give a plain frosted backdrop, but skip the heavy filter.
      ref.current.style.backdropFilter = "blur(16px) saturate(1.4)";
      return () => {
        if (ref.current) ref.current.style.backdropFilter = "";
      };
    }
    let handle: LiquidGlassHandle | null = null;
    // Wait a frame so layout (and border-radius) is settled before mapping.
    const raf = requestAnimationFrame(() => {
      if (ref.current) handle = liquidGlass(ref.current, JSON.parse(key));
    });
    return () => {
      cancelAnimationFrame(raf);
      handle?.destroy();
    };
  }, [enabled, key]);

  return ref;
}

export default useLiquidGlass;
