import * as React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Loader2, Check } from "lucide-react";
import brandLogo from "@/assets/shopbanao-logo.webp";

/**
 * Onboarding / auth design layer.
 * Modern, soft-geometric surfaces built on the --bauhaus-* tokens.
 * Shared by Login, Signup, ForgotPassword, ResetPassword and CreateStore.
 */

/* ---------- Brand mark (real ShopBanao logo from the landing page) ---------- */
export const GeoLogo = ({
  className,
  size = 28,
  invert = false,
}: {
  className?: string;
  size?: number;
  invert?: boolean;
}) => (
  <img
    src={brandLogo}
    alt="ShopBanao"
    width={size}
    height={size}
    className={cn("object-contain", invert && "brightness-0 invert", className)}
    style={{ height: size, width: "auto" }}
    loading="eager"
    decoding="async"
  />
);

export const BrandLockup = ({
  size = 26,
  invert = false,
  className,
}: {
  size?: number;
  invert?: boolean;
  className?: string;
}) => (
  <span className={cn("inline-flex items-center gap-2.5", className)}>
    <GeoLogo size={size} invert={invert} />
    <span
      className={cn(
        "text-lg font-extrabold tracking-tight",
        invert ? "text-bauhaus-white" : "text-foreground"
      )}
    >
      ShopBanao
    </span>
  </span>
);

/* ---------- Shell: split layout, gradient brand panel + clean form column ---------- */
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
    <div className="min-h-screen w-full bg-bauhaus-canvas font-bauhaus text-foreground lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* LEFT — brand panel (desktop) */}
      <aside className="relative hidden overflow-hidden bg-bauhaus-blue p-12 lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "radial-gradient(closest-side, rgba(255,255,255,.9), transparent 70%), radial-gradient(closest-side, rgba(255,255,255,.55), transparent 70%)",
            backgroundSize: "520px 520px, 380px 380px",
            backgroundPosition: "-120px -80px, 88% 108%",
            backgroundRepeat: "no-repeat",
          }}
        />
        <div className="pointer-events-none absolute -right-24 top-1/3 h-72 w-72 rounded-full bg-bauhaus-red/30 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-bauhaus-yellow/25 blur-3xl" />

        <Link to="/" className="relative z-10 w-fit">
          <BrandLockup invert size={30} />
        </Link>

        <div className="relative z-10 max-w-md">
          <h2 className="whitespace-pre-line text-[2.75rem] font-extrabold leading-[1.05] tracking-tight text-bauhaus-white xl:text-5xl">
            {panelTitle}
          </h2>
          <ul className="mt-8 space-y-3.5">
            {panelPoints.map((p) => (
              <li key={p} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bauhaus-white/20 ring-1 ring-inset ring-bauhaus-white/40">
                  <Check className="h-3.5 w-3.5 text-bauhaus-white" strokeWidth={3} />
                </span>
                <span className="text-[15px] font-medium text-bauhaus-white/90">{p}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs font-medium text-bauhaus-white/60">
          Trusted by Indian sellers · shopbanao.in
        </p>
      </aside>

      {/* RIGHT — form column */}
      <main className="relative flex min-h-screen flex-col justify-center px-5 py-12 sm:px-10 lg:px-16">
        <div className="relative z-10 mx-auto w-full max-w-[26rem]">
          <Link to="/" className="mb-9 inline-flex lg:hidden">
            <BrandLockup size={26} />
          </Link>

          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-bauhaus-blue">
            {eyebrow}
          </p>
          <h1 className="text-[2rem] font-extrabold leading-[1.1] tracking-tight sm:text-[2.35rem]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          )}

          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

/* ---------- Card ---------- */
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
        "relative rounded-2xl border border-border/70 bg-bauhaus-white p-5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_12px_32px_-12px_rgba(16,24,40,.18)] sm:p-7",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ---------- Field ---------- */
export const BauhausField = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }
>(({ label, hint, id, className, ...props }, ref) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="block text-[13px] font-semibold text-foreground">
      {label}
    </label>
    <input
      id={id}
      ref={ref}
      className={cn(
        "h-12 w-full rounded-xl border border-border bg-background px-3.5 text-[15px] font-medium text-foreground",
        "placeholder:font-normal placeholder:text-muted-foreground/70",
        "transition-[box-shadow,border-color] duration-150 ease-out",
        "focus:border-bauhaus-blue focus:outline-none focus:ring-4 focus:ring-bauhaus-blue/15",
        className
      )}
      {...props}
    />
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
));
BauhausField.displayName = "BauhausField";

/* ---------- Button ---------- */
type BtnVariant = "red" | "blue" | "yellow" | "outline" | "ghost";

const variantMap: Record<BtnVariant, string> = {
  red: "bg-bauhaus-red text-bauhaus-white shadow-sm hover:brightness-110",
  blue: "bg-bauhaus-blue text-bauhaus-white shadow-sm hover:brightness-110",
  yellow: "bg-bauhaus-yellow text-foreground shadow-sm hover:brightness-105",
  outline: "border border-border bg-bauhaus-white text-foreground hover:bg-muted",
  ghost: "text-foreground hover:bg-muted",
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
        "inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5",
        "text-[15px] font-semibold tracking-tight",
        "transition-[transform,box-shadow,filter,background-color] duration-150 ease-out",
        "active:scale-[.985]",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-bauhaus-blue/25",
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
    className="font-semibold text-bauhaus-blue underline-offset-4 transition-colors duration-150 hover:underline"
  >
    {children}
  </Link>
);

/* ---------- Full-screen loader ---------- */
export const BauhausLoader = () => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bauhaus-canvas">
    <GeoLogo size={34} className="animate-pulse" />
    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
  </div>
);
