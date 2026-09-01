import * as React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Loader2, Check } from "lucide-react";
import brandLogo from "@/assets/shopbanao-logo.webp";

/**
 * SHOPBANAO AUTH — "Commerce Editorial" design layer.
 * Warm cream canvas, deep ink navy, saffron accent, Alegreya SC display type
 * (same wordmark family as the landing page) over Inter body copy.
 * Every auth surface (login, signup, forgot/reset password) restyles from
 * this single file. Export names are kept stable for existing pages.
 * Scope class `.bh-auth` (see index.css) remaps shared tokens.
 */

/* ---------- Font loading (auth surfaces only — keeps storefront payload lean) ---------- */
const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Alegreya+SC:wght@700&family=Inter:wght@400;500;600;700&display=swap";

function useAuthFonts() {
  React.useEffect(() => {
    if (document.getElementById("sb-auth-fonts")) return;
    const pre = document.createElement("link");
    pre.rel = "preconnect";
    pre.href = "https://fonts.gstatic.com";
    pre.crossOrigin = "anonymous";
    document.head.appendChild(pre);
    const link = document.createElement("link");
    link.id = "sb-auth-fonts";
    link.rel = "stylesheet";
    link.href = FONT_HREF;
    document.head.appendChild(link);
  }, []);
}

const DISPLAY = "'Alegreya SC', Georgia, serif";

/* ---------- Brand lockup: ShopBanao logo + wordmark ---------- */
export const BrandMark = ({
  className,
  size = 40,
  light = false,
}: {
  className?: string;
  size?: number;
  light?: boolean;
}) => (
  <span className={cn("inline-flex items-center gap-2.5", className)}>
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
      className={cn("leading-none", light ? "text-[#FBF8F3]" : "text-[#101827]")}
      style={{
        fontFamily: DISPLAY,
        fontWeight: 700,
        fontSize: Math.round(size * 0.46),
        letterSpacing: "0.01em",
      }}
    >
      ShopBanao
    </span>
  </span>
);

/* ---------- Shell: editorial split — ink brand panel + calm form column ---------- */
export function AuthShell({
  eyebrow,
  title,
  subtitle,
  panelTitle = "Sell online,\nthe simple way.",
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
  useAuthFonts();

  return (
    <div className="bh-auth min-h-screen w-full bg-[#FBF8F3] text-[#101827] lg:grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)]">
      {/* LEFT — deep ink brand panel (desktop) */}
      <aside className="bh-auth-panel relative hidden overflow-hidden bg-[#101827] p-12 text-[#FBF8F3] lg:flex lg:flex-col lg:justify-between">
        <Link
          to="/"
          className="relative z-10 w-fit rounded-xl px-1 py-1 transition-opacity duration-200 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F0932B] focus-visible:outline-offset-4"
        >
          <BrandMark size={38} light />
        </Link>

        <div className="relative z-10">
          <h2
            className="whitespace-pre-line text-5xl leading-[1.05] tracking-tight xl:text-6xl"
            style={{ fontFamily: DISPLAY, fontWeight: 700 }}
          >
            {panelTitle}
          </h2>
          <p className="mt-5 max-w-sm text-base leading-relaxed text-[#FBF8F3]/70">
            No code. No drama. Just commerce — built for Indian sellers.
          </p>
        </div>

        <ul className="relative z-10 space-y-3">
          {panelPoints.map((p) => (
            <li key={p} className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F0932B]/15 ring-1 ring-inset ring-[#F0932B]/40">
                <Check className="h-3.5 w-3.5 text-[#F0932B]" strokeWidth={3} />
              </span>
              <span className="text-sm font-medium text-[#FBF8F3]/85">{p}</span>
            </li>
          ))}
        </ul>
      </aside>

      {/* RIGHT — the form */}
      <main className="bh-auth-grid relative flex min-h-screen flex-col justify-center px-5 py-12 sm:px-8 sm:py-16 lg:px-16">
        <div className="relative z-10 mx-auto w-full max-w-[27rem]">
          <Link to="/" className="mb-8 inline-flex lg:hidden">
            <BrandMark size={32} />
          </Link>

          <span className="inline-flex items-center gap-2 rounded-full bg-[#F0932B]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#B26410] ring-1 ring-inset ring-[#F0932B]/30">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F0932B]" />
            {eyebrow}
          </span>

          <h1
            className="mt-5 text-4xl leading-[1.08] tracking-tight text-[#101827] sm:text-5xl"
            style={{ fontFamily: DISPLAY, fontWeight: 700 }}
          >
            {title}
          </h1>

          {subtitle && (
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-[#101827]/60">
              {subtitle}
            </p>
          )}

          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

/* ---------- Card: soft white sheet with a hairline border + gentle elevation ---------- */
export const BauhausCard = React.forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
    className?: string;
    corner?: "red" | "blue" | "yellow" | "none";
  }
>(function BauhausCard({ children, className, corner = "red" }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[#101827]/10 bg-white p-5 sm:p-7",
        "shadow-[0_1px_2px_rgba(16,24,39,0.04),0_12px_32px_-12px_rgba(16,24,39,0.16)]",
        className
      )}
    >
      {corner !== "none" && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#F0932B] via-[#F0932B]/40 to-transparent"
        />
      )}
      {children}
    </div>
  );
});
BauhausCard.displayName = "BauhausCard";

/* ---------- Field ---------- */
export const BauhausField = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }
>(({ label, hint, id, className, ...props }, ref) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="block text-[13px] font-semibold text-[#101827]">
      {label}
    </label>
    <input
      id={id}
      ref={ref}
      className={cn(
        "h-12 w-full rounded-xl border border-[#101827]/14 bg-[#FBF8F3]/60 px-3.5 text-[15px] text-[#101827]",
        "placeholder:text-[#101827]/35",
        "transition-all duration-200 ease-out",
        "focus:border-[#F0932B] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#F0932B]/15",
        className
      )}
      {...props}
    />
    {hint && <p className="text-xs text-[#101827]/55">{hint}</p>}
  </div>
));
BauhausField.displayName = "BauhausField";

/* ---------- Button ---------- */
type BtnVariant = "red" | "blue" | "yellow" | "outline" | "ghost";

const variantMap: Record<BtnVariant, string> = {
  red: "bg-[#101827] text-[#FBF8F3] hover:bg-[#1b2740] shadow-[0_8px_20px_-10px_rgba(16,24,39,0.7)]",
  blue: "bg-[#101827] text-[#FBF8F3] hover:bg-[#1b2740] shadow-[0_8px_20px_-10px_rgba(16,24,39,0.7)]",
  yellow: "bg-[#F0932B] text-[#3A2205] hover:bg-[#e0871f] shadow-[0_8px_20px_-10px_rgba(240,147,43,0.8)]",
  outline: "bg-white text-[#101827] border border-[#101827]/15 hover:bg-[#FBF8F3]",
  ghost: "bg-transparent text-[#101827] hover:bg-[#101827]/5",
};

export const BauhausButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: BtnVariant;
    loading?: boolean;
  }
>(function BauhausButton({ variant = "red", loading, className, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex h-12 min-h-[44px] items-center justify-center gap-2.5 rounded-xl px-6",
        "text-[15px] font-semibold tracking-tight",
        "transition-all duration-200 ease-out active:scale-[0.985]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F0932B] focus-visible:outline-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        variantMap[variant],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />}
      {children}
    </button>
  );
});
BauhausButton.displayName = "BauhausButton";

/* ---------- Inline link ---------- */
export const BauhausLink = React.forwardRef<
  HTMLAnchorElement,
  { to: string; children: React.ReactNode }
>(function BauhausLink({ to, children }, ref) {
  return (
  <Link
    ref={ref}
    to={to}
    className="font-semibold text-[#101827] underline decoration-[#F0932B] decoration-2 underline-offset-4 transition-colors duration-200 hover:text-[#B26410] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F0932B] focus-visible:outline-offset-2"
  >
    {children}
  </Link>
  );
});
BauhausLink.displayName = "BauhausLink";

/* ---------- Full-screen loader in style ---------- */
export const BauhausLoader = () => (
  <div className="bh-auth flex min-h-screen items-center justify-center bg-[#FBF8F3]">
    <div className="flex flex-col items-center gap-4">
      <span className="h-9 w-9 rounded-full border-2 border-[#101827]/15 border-t-[#F0932B] motion-safe:animate-spin" />
      <span className="text-xs font-medium uppercase tracking-[0.18em] text-[#101827]/50">
        Loading
      </span>
    </div>
  </div>
);
