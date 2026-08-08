import * as React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import brandLogo from "@/assets/shopbanao-logo.webp";

/**
 * Minimalist Monochrome onboarding design layer.
 * Pure black & white, serif display typography, zero radius, no shadows.
 * Exports keep their original names so every auth surface (login, signup,
 * forgot/reset password) restyles from this single file with no one-off CSS.
 * Scope class `.mono-auth` (see index.css) remaps legacy tokens to monochrome.
 */

/* ---------- Font loading (auth surfaces only — keeps storefront payload lean) ---------- */
const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Source+Serif+4:ital,opsz,wght@0,8..60,300..700;1,8..60,300..700&family=JetBrains+Mono:wght@400;500;700&display=swap";

function useMonoFonts() {
  React.useEffect(() => {
    if (document.getElementById("mono-auth-fonts")) return;
    const pre = document.createElement("link");
    pre.rel = "preconnect";
    pre.href = "https://fonts.gstatic.com";
    pre.crossOrigin = "anonymous";
    document.head.appendChild(pre);
    const link = document.createElement("link");
    link.id = "mono-auth-fonts";
    link.rel = "stylesheet";
    link.href = FONT_HREF;
    document.head.appendChild(link);
  }, []);
}

const DISPLAY = "'Playfair Display', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

/* ---------- Brand lockup: ShopBanao logo + wordmark ---------- */
export const BrandMark = ({
  className,
  size = 56,
  light = false,
}: {
  className?: string;
  size?: number;
  light?: boolean;
}) => (
  <span className={cn("inline-flex items-center gap-2", className)}>
    <img
      src={brandLogo}
      alt="ShopBanao"
      width={size}
      height={size}
      className={cn("w-auto brightness-0", light && "invert")}
      style={{ height: size }}
      decoding="async"
    />
    <span
      className={cn("leading-none", light ? "text-white" : "text-black")}
      style={{
        fontFamily: "'Alegreya SC', Georgia, serif",
        fontWeight: 700,
        fontSize: Math.round(size * 0.45),
        letterSpacing: "-0.01em",
      }}
    >
      ShopBanao
    </span>
  </span>
);

/* ---------- Shell: editorial split — inverted manifesto panel + form ---------- */
export function AuthShell({
  eyebrow,
  title,
  subtitle,
  panelTitle = "Sell\nOnline.",
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
  useMonoFonts();

  return (
    <div className="mono-auth min-h-screen w-full bg-white text-black lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* LEFT — inverted editorial panel (desktop) */}
      <aside className="mono-auth-invert-texture relative hidden overflow-hidden border-r-4 border-black bg-black p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Link
          to="/"
          className="relative z-10 inline-flex w-fit items-center focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-white focus-visible:outline-offset-4"
        >
          <BrandMark size={48} light />
        </Link>

        <div className="relative z-10">
          <div className="mb-8 flex items-center gap-4">
            <span className="h-[4px] w-24 bg-white" />
            <span className="h-3 w-3 border border-white" />
          </div>
          <h2
            className="whitespace-pre-line text-[6rem] leading-[0.85] tracking-tighter xl:text-[7.5rem]"
            style={{ fontFamily: DISPLAY, fontWeight: 500 }}
          >
            {panelTitle}
          </h2>
          <p
            className="mt-6 max-w-sm text-lg italic leading-relaxed text-white/70"
            style={{ fontFamily: DISPLAY }}
          >
            No code. No drama. Just commerce.
          </p>
        </div>

        <ul className="relative z-10 border-t border-white/25">
          {panelPoints.map((p, i) => (
            <li
              key={p}
              className="flex items-baseline gap-6 border-b border-white/25 py-4"
            >
              <span
                className="text-[11px] tracking-widest text-white/50"
                style={{ fontFamily: MONO }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-base tracking-wide">{p}</span>
            </li>
          ))}
        </ul>
      </aside>

      {/* RIGHT — the form */}
      <main className="mono-auth-texture relative flex min-h-screen flex-col justify-center px-6 py-14 sm:px-10 lg:px-16">
        <div className="relative z-10 mx-auto w-full max-w-md">
          <Link
            to="/"
            className="mb-10 inline-flex items-center lg:hidden focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-black focus-visible:outline-offset-4"
          >
            <BrandMark size={40} />
          </Link>

          <p
            className="mb-5 text-[11px] uppercase tracking-[0.28em] text-black"
            style={{ fontFamily: MONO }}
          >
            {eyebrow}
          </p>
          <div className="mb-5 h-[4px] w-16 bg-black" />
          <h1
            className="text-6xl leading-[0.88] tracking-tighter sm:text-7xl"
            style={{ fontFamily: DISPLAY, fontWeight: 500 }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mt-6 max-w-sm text-lg leading-relaxed text-neutral-600">
              {subtitle}
            </p>
          )}

          <div className="mt-10">{children}</div>
        </div>
      </main>
    </div>
  );
}

/* ---------- Card: white block, hairline-to-black border, no shadow ---------- */
export function BauhausCard({
  children,
  className,
  corner = "red",
}: {
  children: React.ReactNode;
  className?: string;
  /** kept for API compatibility — monochrome renders a single black rule marker */
  corner?: "red" | "blue" | "yellow" | "none";
}) {
  return (
    <div className={cn("relative border border-black bg-white p-6 sm:p-8", className)}>
      {corner !== "none" && (
        <span aria-hidden="true" className="absolute right-4 top-4 h-2 w-2 bg-black" />
      )}
      {children}
    </div>
  );
}

/* ---------- Field: bottom-rule input, mono label ---------- */
export const BauhausField = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }
>(({ label, hint, id, className, ...props }, ref) => (
  <div className="space-y-2">
    <label
      htmlFor={id}
      className="block text-[10px] uppercase tracking-[0.22em] text-black"
      style={{ fontFamily: MONO }}
    >
      {label}
    </label>
    <input
      id={id}
      ref={ref}
      className={cn(
        "h-12 w-full border-0 border-b-2 border-black bg-white px-0 text-lg text-black",
        "placeholder:italic placeholder:text-neutral-500",
        "transition-none focus:border-b-[4px] focus:outline-none focus-visible:border-b-[4px]",
        className
      )}
      style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
      {...props}
    />
    {hint && <p className="text-sm italic text-neutral-600">{hint}</p>}
  </div>
));
BauhausField.displayName = "BauhausField";

/* ---------- Button: inversion on hover, instant ---------- */
type BtnVariant = "red" | "blue" | "yellow" | "outline" | "ghost";

const variantMap: Record<BtnVariant, string> = {
  /* primary: solid black → inverts to white on hover */
  red: "bg-black text-white border-2 border-black hover:bg-white hover:text-black",
  blue: "bg-black text-white border-2 border-black hover:bg-white hover:text-black",
  yellow: "bg-white text-black border-2 border-black hover:bg-black hover:text-white",
  outline: "bg-white text-black border-2 border-black hover:bg-black hover:text-white",
  ghost: "bg-transparent text-black border-0 underline-offset-4 hover:underline",
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
        "inline-flex h-12 min-h-[44px] items-center justify-center gap-3 px-8",
        "text-xs uppercase tracking-[0.2em]",
        "transition-colors duration-100",
        "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-black focus-visible:outline-offset-[3px]",
        "disabled:pointer-events-none disabled:opacity-40",
        variantMap[variant],
        className
      )}
      style={{ fontFamily: MONO }}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />}
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
    className="border-b-2 border-black pb-[1px] text-black transition-none hover:border-b-[3px] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-black focus-visible:outline-offset-[3px]"
  >
    {children}
  </Link>
);

/* ---------- Full-screen loader in style ---------- */
export const BauhausLoader = () => (
  <div className="mono-auth flex min-h-screen items-center justify-center bg-white">
    <div className="flex flex-col items-center gap-5">
      <span className="h-10 w-10 border-2 border-black border-t-transparent motion-safe:animate-spin" />
      <span
        className="text-[10px] uppercase tracking-[0.3em] text-black"
        style={{ fontFamily: MONO }}
      >
        Loading
      </span>
    </div>
  </div>
);
