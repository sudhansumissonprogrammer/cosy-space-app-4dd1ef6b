import * as React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

/**
 * Bauhaus onboarding design layer.
 * Centralises the constructivist primitives (geometric mark, split-screen shell,
 * bordered fields, hard-shadow buttons) so every auth/onboarding surface stays
 * visually identical without one-off styles.
 * Tokens come from index.css (--bauhaus-*) via tailwind.config.ts.
 */

/* ---------- Brand lockup: ShopBanao logo + wordmark (same as landing) ---------- */
export const BrandMark = ({
  className,
  size = 56,
  light = false,
}: {
  className?: string;
  size?: number;
  light?: boolean;
}) => (
  <span className={cn("inline-flex items-center -space-x-1", className)}>
    <img
      src={brandLogo}
      alt="ShopBanao"
      width={size}
      height={size}
      className="w-auto"
      style={{ height: size }}
      decoding="async"
    />
    <span
      className={cn("leading-none", light ? "text-bauhaus-white" : "text-foreground")}
      style={{
        fontFamily: "'Alegreya SC', serif",
        fontWeight: 700,
        fontSize: Math.round(size * 0.45),
      }}
    >
      ShopBanao
    </span>
  </span>
);

/* ---------- Decorative constructivist composition (desktop panel) ---------- */
const GeoComposition = () => (
  <div className="relative h-64 w-64" aria-hidden="true">
    <div className="absolute left-0 top-0 h-40 w-40 rounded-full border-4 border-foreground bg-bauhaus-yellow" />
    <div className="absolute bottom-0 right-0 h-36 w-36 rotate-45 border-4 border-foreground bg-bauhaus-red" />
    <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 border-4 border-foreground bg-bauhaus-white" />
    <div
      className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 bg-bauhaus-blue"
      style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }}
    />
  </div>
);

/* ---------- Shell: split-screen poster layout ---------- */
export function AuthShell({
  eyebrow,
  title,
  subtitle,
  panelTitle = "Sell online.\nNo code.\nNo drama.",
  panelPoints = ["Storefront in minutes", "UPI · COD · Razorpay", "WhatsApp order engine"],
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
  panelTitle?: string;
  panelPoints?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-bauhaus-canvas font-bauhaus text-foreground lg:grid lg:grid-cols-2">
      {/* LEFT — color-blocked poster panel (desktop only) */}
      <aside className="relative hidden overflow-hidden border-r-4 border-foreground bg-bauhaus-blue p-10 lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(#fff 2px, transparent 2px)",
            backgroundSize: "24px 24px",
          }}
        />
        <Link to="/" className="relative z-10 inline-flex w-fit items-center gap-3">
          <GeoLogo size={22} />
          <span className="text-xl font-black uppercase tracking-tighter text-bauhaus-white">
            ShopBanao
          </span>
        </Link>

        <div className="relative z-10">
          <h2 className="whitespace-pre-line text-5xl font-black uppercase leading-[0.9] tracking-tighter text-bauhaus-white xl:text-6xl">
            {panelTitle}
          </h2>
          <ul className="mt-8 space-y-3">
            {panelPoints.map((p, i) => (
              <li key={p} className="flex items-center gap-3">
                <span
                  className={cn(
                    "h-4 w-4 border-2 border-foreground",
                    i % 3 === 0 && "rounded-full bg-bauhaus-red",
                    i % 3 === 1 && "bg-bauhaus-yellow",
                    i % 3 === 2 && "rotate-45 bg-bauhaus-white"
                  )}
                />
                <span className="text-base font-medium text-bauhaus-white/90">{p}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 self-end">
          <GeoComposition />
        </div>
      </aside>

      {/* RIGHT — the form */}
      <main className="relative flex min-h-screen flex-col justify-center px-4 py-10 sm:px-8 lg:px-14">
        <div className="pointer-events-none absolute right-6 top-6 h-16 w-16 rotate-45 border-2 border-foreground bg-bauhaus-yellow lg:h-24 lg:w-24" aria-hidden="true" />
        <div className="relative z-10 mx-auto w-full max-w-md">
          <Link to="/" className="mb-8 inline-flex items-center gap-3 lg:hidden">
            <GeoLogo size={18} />
            <span className="text-lg font-black uppercase tracking-tighter">ShopBanao</span>
          </Link>

          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-bauhaus-red">
            {eyebrow}
          </p>
          <h1 className="text-4xl font-black uppercase leading-[0.9] tracking-tighter sm:text-5xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-4 max-w-sm text-base font-medium leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          )}

          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

/* ---------- Card: white block, thick border, hard shadow ---------- */
export function BauhausCard({
  children,
  className,
  corner = "red",
}: {
  children: React.ReactNode;
  className?: string;
  corner?: "red" | "blue" | "yellow" | "none";
}) {
  return (
    <div
      className={cn(
        "relative border-2 border-foreground bg-bauhaus-white p-5 shadow-bauhaus sm:border-4 sm:p-7 sm:shadow-bauhaus-lg",
        className
      )}
    >
      {corner !== "none" && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute right-3 top-3 h-3 w-3 border-2 border-foreground",
            corner === "red" && "rounded-full bg-bauhaus-red",
            corner === "blue" && "bg-bauhaus-blue",
            corner === "yellow" && "rotate-45 bg-bauhaus-yellow"
          )}
        />
      )}
      {children}
    </div>
  );
}

/* ---------- Field ---------- */
export const BauhausField = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }
>(({ label, hint, id, className, ...props }, ref) => (
  <div className="space-y-2">
    <label
      htmlFor={id}
      className="block text-[11px] font-bold uppercase tracking-widest text-foreground"
    >
      {label}
    </label>
    <input
      id={id}
      ref={ref}
      className={cn(
        "h-12 w-full rounded-none border-2 border-foreground bg-bauhaus-white px-3 text-base font-medium text-foreground",
        "placeholder:font-normal placeholder:text-muted-foreground",
        "transition-[box-shadow,transform] duration-200 ease-out",
        "focus:outline-none focus:shadow-bauhaus-sm focus:-translate-y-[1px]",
        className
      )}
      {...props}
    />
    {hint && <p className="text-xs font-medium text-muted-foreground">{hint}</p>}
  </div>
));
BauhausField.displayName = "BauhausField";

/* ---------- Button ---------- */
type BtnVariant = "red" | "blue" | "yellow" | "outline" | "ghost";

const variantMap: Record<BtnVariant, string> = {
  red: "bg-bauhaus-red text-bauhaus-white border-2 border-foreground shadow-bauhaus hover:bg-bauhaus-red/90",
  blue: "bg-bauhaus-blue text-bauhaus-white border-2 border-foreground shadow-bauhaus hover:bg-bauhaus-blue/90",
  yellow: "bg-bauhaus-yellow text-foreground border-2 border-foreground shadow-bauhaus hover:bg-bauhaus-yellow/90",
  outline: "bg-bauhaus-white text-foreground border-2 border-foreground shadow-bauhaus hover:bg-muted",
  ghost: "border-none text-foreground hover:bg-muted",
};

export function BauhausButton({
  variant = "red",
  loading,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  loading?: boolean;
}) {
  return (
    <button
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-none px-5",
        "text-sm font-bold uppercase tracking-wider",
        "transition-[transform,box-shadow,background-color] duration-200 ease-out",
        "active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        variantMap[variant],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

/* ---------- Inline link ---------- */
export const BauhausLink = ({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) => (
  <Link
    to={to}
    className="font-bold uppercase tracking-wide text-bauhaus-blue underline decoration-2 underline-offset-4 transition-colors duration-200 hover:text-bauhaus-red"
  >
    {children}
  </Link>
);

/* ---------- Full-screen loader in style ---------- */
export const BauhausLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-bauhaus-canvas">
    <div className="flex items-center gap-2">
      <span className="h-5 w-5 animate-bounce rounded-full border-2 border-foreground bg-bauhaus-red" />
      <span
        className="h-5 w-5 animate-bounce border-2 border-foreground bg-bauhaus-blue"
        style={{ animationDelay: "0.12s" }}
      />
      <span
        className="h-5 w-5 rotate-45 animate-bounce border-2 border-foreground bg-bauhaus-yellow"
        style={{ animationDelay: "0.24s" }}
      />
    </div>
  </div>
);
