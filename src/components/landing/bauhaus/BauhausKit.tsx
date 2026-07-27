/**
 * BauhausKit — the shared geometric vocabulary for the landing page.
 *
 * Why this file exists: before it, every landing section hand-rolled its own
 * borders, hard shadows, label chips and heading scale. That made the type
 * scale drift (3xl here, 4xl there) and made the "constructivist" decoration
 * impossible to apply consistently. Everything Bauhaus-specific now lives in
 * one place:
 *
 *   - GeoShape     — the three primitives: circle, square, triangle
 *   - CornerMark   — the 12px corner decoration every card carries
 *   - SectionLabel — uppercase tracked label chip above a headline
 *   - DisplayTitle — the one canonical display scale (4xl → 6xl → 8xl-ish)
 *   - BauCard      — white / border-4 / hard-shadow / lift-on-hover card
 *   - BauButton    — press-down button, 5 variants, square or pill
 *   - DotGrid      — the poster texture used on colour-blocked panels
 *
 * Tokens only: bauhaus-red / -blue / -yellow / -white / -canvas + foreground,
 * all defined in index.css. No hardcoded hex anywhere in this file.
 *
 * Zero runtime deps beyond React so the landing critical chunk stays small.
 */
import type { CSSProperties, ReactNode } from "react";

/* ── Geometric primitives ─────────────────────────────────────────────── */

export type GeoKind = "circle" | "square" | "triangle";

/** Rotation of shape + colour used for card corner marks and shape rows. */
export const GEO_CYCLE: GeoKind[] = ["circle", "square", "triangle"];
export const COLOR_CYCLE = ["bg-bauhaus-red", "bg-bauhaus-blue", "bg-bauhaus-yellow"] as const;

const TRIANGLE_CLIP: CSSProperties = { clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" };

export const GeoShape = ({
  kind,
  className = "",
  color = "bg-bauhaus-red",
  bordered = false,
}: {
  kind: GeoKind;
  className?: string;
  color?: string;
  bordered?: boolean;
}) => (
  <span
    aria-hidden="true"
    className={[
      "block",
      color,
      kind === "circle" ? "rounded-full" : "rounded-none",
      bordered ? "border-2 border-foreground" : "",
      className,
    ].join(" ")}
    style={kind === "triangle" ? TRIANGLE_CLIP : undefined}
  />
);

/** Circle · square · triangle in the three primaries — the brand mark. */
export const BauhausMark = ({ size = "h-6 w-6" }: { size?: string }) => (
  <span aria-hidden="true" className="flex items-center gap-1">
    <GeoShape kind="circle" color="bg-bauhaus-red" className={size} />
    <GeoShape kind="square" color="bg-bauhaus-blue" className={size} />
    <GeoShape kind="triangle" color="bg-bauhaus-yellow" className={size} />
  </span>
);

/**
 * Corner decoration for cards. Pass the item index — shape and colour cycle
 * so a grid of cards reads as one composition instead of repeated stickers.
 * Every 3rd mark is rotated 45°, per the design system's rotation rule.
 */
export const CornerMark = ({ index = 0, className = "" }: { index?: number; className?: string }) => {
  const kind = GEO_CYCLE[index % 3];
  const color = COLOR_CYCLE[index % 3];
  return (
    <GeoShape
      kind={kind}
      color={color}
      className={`absolute top-3 right-3 h-3 w-3 ${index % 3 === 2 ? "rotate-45" : ""} ${className}`}
    />
  );
};

/* ── Texture ──────────────────────────────────────────────────────────── */

/** Dot-grid poster texture. `tone` picks white dots (on colour) or black. */
export const DotGrid = ({
  tone = "light",
  className = "",
  opacity = 0.1,
}: {
  tone?: "light" | "dark";
  className?: string;
  opacity?: number;
}) => (
  <div
    aria-hidden="true"
    className={`pointer-events-none absolute inset-0 ${className}`}
    style={{
      opacity,
      backgroundImage: `radial-gradient(${
        tone === "light" ? "hsl(var(--bauhaus-white))" : "hsl(var(--foreground))"
      } 2px, transparent 2px)`,
      backgroundSize: "20px 20px",
    }}
  />
);

/* ── Typography ───────────────────────────────────────────────────────── */

/** One canonical display scale so no section invents its own. */
export const DISPLAY = {
  xl: "font-black uppercase tracking-tighter leading-[0.88] text-4xl sm:text-6xl lg:text-7xl xl:text-8xl",
  lg: "font-black uppercase tracking-tighter leading-[0.9] text-[34px] sm:text-5xl lg:text-6xl",
  md: "font-black uppercase tracking-tighter leading-[0.92] text-3xl sm:text-4xl lg:text-5xl",
  sm: "font-black uppercase tracking-tight leading-none text-xl sm:text-2xl",
} as const;

export const SectionLabel = ({
  children,
  tone = "dark",
  shape = "square",
  className = "",
}: {
  children: ReactNode;
  tone?: "dark" | "light";
  shape?: GeoKind;
  className?: string;
}) => (
  <span
    className={`inline-flex items-center gap-2 font-bold uppercase tracking-widest text-[10px] sm:text-xs ${
      tone === "light" ? "text-bauhaus-white/80" : "text-foreground/60"
    } ${className}`}
  >
    <GeoShape kind={shape} color="bg-bauhaus-red" className="h-2.5 w-2.5" />
    {children}
  </span>
);

/** Label + display headline block used at the top of every section. */
export const SectionHeading = ({
  label,
  children,
  tone = "dark",
  size = "lg",
  align = "center",
  sub,
  labelShape = "square",
}: {
  label: string;
  children: ReactNode;
  tone?: "dark" | "light";
  size?: keyof typeof DISPLAY;
  align?: "center" | "left";
  sub?: ReactNode;
  labelShape?: GeoKind;
}) => (
  <div className={`${align === "center" ? "text-center mx-auto" : "text-left"} mb-10 sm:mb-14 max-w-4xl`}>
    <SectionLabel tone={tone} shape={labelShape} className="mb-3">
      {label}
    </SectionLabel>
    <h2 className={`${DISPLAY[size]} ${tone === "light" ? "text-bauhaus-white" : "text-foreground"}`}>{children}</h2>
    {sub && (
      <p
        className={`font-medium text-sm sm:text-base lg:text-lg leading-relaxed mt-5 max-w-2xl ${
          align === "center" ? "mx-auto" : ""
        } ${tone === "light" ? "text-bauhaus-white/70" : "text-muted-foreground"}`}
      >
        {sub}
      </p>
    )}
  </div>
);

/* ── Surfaces ─────────────────────────────────────────────────────────── */

export const BauCard = ({
  children,
  index,
  className = "",
  shadow = "shadow-bauhaus sm:shadow-bauhaus-lg",
  hover = true,
  as: Tag = "div",
}: {
  children: ReactNode;
  /** When provided, renders the cycling geometric corner mark. */
  index?: number;
  className?: string;
  shadow?: string;
  hover?: boolean;
  as?: "div" | "li" | "article";
}) => (
  <Tag
    className={`relative bg-bauhaus-white border-2 sm:border-4 border-foreground ${shadow} ${
      hover ? "transition-transform duration-200 ease-out hover:-translate-y-1" : ""
    } ${className}`}
  >
    {index !== undefined && <CornerMark index={index} />}
    {children}
  </Tag>
);

/* ── Buttons ──────────────────────────────────────────────────────────── */

type BauVariant = "red" | "blue" | "yellow" | "outline" | "ghost";

const VARIANTS: Record<BauVariant, string> = {
  red: "bg-bauhaus-red text-primary-foreground border-2 border-foreground hover:bg-bauhaus-red/90",
  blue: "bg-bauhaus-blue text-primary-foreground border-2 border-foreground hover:bg-bauhaus-blue/90",
  yellow: "bg-bauhaus-yellow text-foreground border-2 border-foreground hover:bg-bauhaus-yellow/90",
  outline: "bg-bauhaus-white text-foreground border-2 border-foreground hover:bg-muted",
  ghost: "border-none text-foreground hover:bg-muted",
};

const SIZES = {
  sm: "text-xs px-4 py-2",
  md: "text-xs sm:text-sm px-5 sm:px-6 py-3",
  lg: "text-sm px-6 sm:px-8 py-3.5 sm:py-4",
} as const;

export const bauButtonClass = ({
  variant = "red",
  size = "md",
  shape = "square",
  shadow = "shadow-bauhaus",
}: {
  variant?: BauVariant;
  size?: keyof typeof SIZES;
  shape?: "square" | "pill";
  shadow?: string;
} = {}) =>
  [
    "inline-flex items-center justify-center gap-2 font-bold uppercase tracking-wider",
    "transition-[transform,box-shadow,background-color,color] duration-200 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2",
    "active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    shape === "pill" ? "rounded-full" : "rounded-none",
    variant === "ghost" ? "" : shadow,
    VARIANTS[variant],
    SIZES[size],
  ].join(" ");

export const BauButton = ({
  children,
  href,
  variant = "red",
  size = "md",
  shape = "square",
  shadow = "shadow-bauhaus",
  className = "",
  ...rest
}: {
  children: ReactNode;
  href: string;
  variant?: BauVariant;
  size?: keyof typeof SIZES;
  shape?: "square" | "pill";
  shadow?: string;
  className?: string;
} & Record<string, unknown>) => (
  <a href={href} className={`${bauButtonClass({ variant, size, shape, shadow })} ${className}`} {...rest}>
    {children}
  </a>
);
