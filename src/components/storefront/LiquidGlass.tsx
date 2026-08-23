import { forwardRef, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useLiquidGlass } from "@/hooks/useLiquidGlass";
import type { LiquidGlassOptions } from "@/lib/liquidGlass";
import "@/styles/liquid-glass.css";

export interface LiquidGlassProps extends LiquidGlassOptions {
  children?: ReactNode;
  className?: string;
  /** Render as a different element (e.g. "button", "header", "nav"). */
  as?: ElementType;
  /** Turn the effect off without unmounting the element. */
  enabled?: boolean;
  /** Adds a subtle press-scale on tap. */
  interactive?: boolean;
  /** Force the smoked-dark dressing regardless of theme. */
  tone?: "light" | "dark";
  onClick?: () => void;
  style?: React.CSSProperties;
  "aria-label"?: string;
}

/**
 * Apple-style liquid glass panel.
 *
 *   <LiquidGlass className="p-5 rounded-[28px]">…</LiquidGlass>
 *
 * Refraction runs in Chromium; Safari/Firefox get a frosted-blur fallback
 * automatically. Best on cards, nav bars, sheets and buttons — avoid on
 * elements larger than ~800px per side (GPU cost).
 */
const LiquidGlass = forwardRef<HTMLElement, LiquidGlassProps>(function LiquidGlass(
  {
    children,
    className,
    as: Tag = "div",
    enabled = true,
    interactive = false,
    tone,
    onClick,
    style,
    ...glassOpts
  },
  _ref,
) {
  const ref = useLiquidGlass<HTMLElement>({ enabled, ...glassOpts });

  return (
    <Tag
      ref={ref}
      data-tone={tone}
      onClick={onClick}
      style={style}
      className={cn("lg-surface", interactive && "lg-interactive", className)}
    >
      {children}
    </Tag>
  );
});

export default LiquidGlass;
