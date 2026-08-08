import * as React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import brandLogo from "@/assets/shopbanao-logo.webp";

/**
 * BAUHAUS onboarding design layer.
 * Constructivist geometry: primary colour blocking, 2/4px black borders,
 * hard offset shadows, Outfit type, binary radii (none | full).
 * Every auth surface (login, signup, forgot/reset password) restyles from
 * this single file — no one-off CSS anywhere else.
 * Scope class `.bh-auth` (see index.css) remaps shared tokens.
 */

/* ---------- Font loading (auth surfaces only — keeps storefront payload lean) ---------- */
const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;700;900&display=swap";

function useBauhausFonts() {
  React.useEffect(() => {
    if (document.getElementById("bauhaus-auth-fonts")) return;
    const pre = document.createElement("link");
    pre.rel = "preconnect";
    pre.href = "https://fonts.gstatic.com";
    pre.crossOrigin = "anonymous";
    document.head.appendChild(pre);
    const link = document.createElement("link");
    link.id = "bauhaus-auth-fonts";
    link.rel = "stylesheet";
    link.href = FONT_HREF;
    document.head.appendChild(link);
  }, []);
}

const RED = "#D02020";
const BLUE = "#1040C0";
const YELLOW = "#F0C020";
const INK = "#121212";

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
      className={cn("leading-none", light ? "text-white" : "text-[#121212]")}
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

/* ---------- Geometric composition for the colour-blocked panel ---------- */
const PanelComposition = () => (
  <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
    <span className="absolute -right-16 -top-16 h-64 w-64 rounded-full border-4 border-[#121212] bg-[#F0C020]" />
    <span className="absolute right-24 top-40 h-40 w-40 rotate-45 border-4 border-[#121212] bg-[#D02020]" />
    <span
      className="absolute -bottom-10 -left-8 h-52 w-52 border-4 border-[#121212] bg-white"
      style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }}
    />
    <span className="absolute bottom-24 right-10 h-24 w-24 rounded-full border-4 border-[#121212] bg-white" />
  </div>
);

/* ---------- Shell: constructed split — colour-blocked panel + form ---------- */
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
  useBauhausFonts();

  return (
    <div className="bh-auth min-h-screen w-full bg-[#F0F0F0] text-[#121212] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* LEFT — blue colour-blocked constructivist panel (desktop) */}
      <aside className="relative hidden overflow-hidden border-r-4 border-[#121212] bg-[#1040C0] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <PanelComposition />

        <Link
          to="/"
          className="relative z-10 inline-flex w-fit items-center border-4 border-[#121212] bg-white px-4 py-2 shadow-[6px_6px_0px_0px_#121212] transition-transform duration-200 ease-out hover:-translate-y-1 focus-visible:outline focus-visible:outline-4 focus-visible:outline-white focus-visible:outline-offset-4"
        >
          <BrandMark size={40} />
        </Link>

        <div className="relative z-10">
          <div className="mb-8 flex items-center gap-3">
            <span className="h-6 w-6 rounded-full border-4 border-[#121212] bg-[#F0C020]" />
            <span className="h-6 w-6 border-4 border-[#121212] bg-[#D02020]" />
            <span className="h-6 w-6 rotate-45 border-4 border-[#121212] bg-white" />
          </div>
          <h2 className="whitespace-pre-line text-6xl font-black uppercase leading-[0.9] tracking-tighter xl:text-8xl">
            {panelTitle}
          </h2>
          <p className="mt-6 max-w-sm text-lg font-medium leading-relaxed text-white">
            No code. No drama. Just commerce.
          </p>
        </div>

        <ul className="relative z-10 border-4 border-[#121212] bg-white text-[#121212] shadow-[8px_8px_0px_0px_#121212]">
          {panelPoints.map((p, i) => (
            <li
              key={p}
              className="flex items-center gap-4 border-b-4 border-[#121212] px-5 py-4 last:border-b-0"
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-[#121212] text-xs font-black"
                style={{ background: [YELLOW, RED, BLUE][i % 3], color: i === 0 ? INK : "#fff" }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-base font-bold uppercase tracking-wide">{p}</span>
            </li>
          ))}
        </ul>
      </aside>

      {/* RIGHT — the form */}
      <main className="bh-auth-grid relative flex min-h-screen flex-col justify-center px-4 py-12 sm:px-6 sm:py-16 lg:px-16">
        <div className="relative z-10 mx-auto w-full max-w-md">
          <Link
            to="/"
            className="mb-8 inline-flex items-center border-2 border-[#121212] bg-white px-3 py-2 shadow-[4px_4px_0px_0px_#121212] lg:hidden"
          >
            <BrandMark size={32} />
          </Link>

          <span className="inline-block border-2 border-[#121212] bg-[#F0C020] px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#121212] shadow-[3px_3px_0px_0px_#121212]">
            {eyebrow}
          </span>

          <h1 className="mt-5 text-5xl font-black uppercase leading-[0.9] tracking-tighter sm:text-6xl">
            {title}
          </h1>

          <div className="mt-5 flex items-center gap-2" aria-hidden="true">
            <span className="h-3 w-16 bg-[#D02020]" />
            <span className="h-3 w-8 bg-[#1040C0]" />
            <span className="h-3 w-3 rounded-full bg-[#F0C020] ring-2 ring-[#121212]" />
          </div>

          {subtitle && (
            <p className="mt-5 max-w-sm text-base font-medium leading-relaxed text-[#121212]/70">
              {subtitle}
            </p>
          )}

          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

/* ---------- Card: white block, 4px border, 8px hard shadow, corner shape ---------- */
const cornerColor: Record<string, string> = { red: RED, blue: BLUE, yellow: YELLOW };

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
        "relative border-2 border-[#121212] bg-white p-5 shadow-[4px_4px_0px_0px_#121212]",
        "sm:border-4 sm:p-8 sm:shadow-[8px_8px_0px_0px_#121212]",
        className
      )}
    >
      {corner !== "none" && (
        <span
          aria-hidden="true"
          className="absolute right-4 top-4 h-4 w-4 rounded-full border-2 border-[#121212]"
          style={{ background: cornerColor[corner] }}
        />
      )}
      {children}
    </div>
  );
}

/* ---------- Field: boxed input, thick border, focus shifts to hard shadow ---------- */
export const BauhausField = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }
>(({ label, hint, id, className, ...props }, ref) => (
  <div className="space-y-2">
    <label
      htmlFor={id}
      className="block text-[11px] font-bold uppercase tracking-widest text-[#121212]"
    >
      {label}
    </label>
    <input
      id={id}
      ref={ref}
      className={cn(
        "h-12 w-full border-2 border-[#121212] bg-white px-3 text-base font-medium text-[#121212]",
        "placeholder:font-normal placeholder:text-[#121212]/40",
        "transition-shadow duration-200 ease-out",
        "focus:outline-none focus:shadow-[4px_4px_0px_0px_#1040C0]",
        className
      )}
      {...props}
    />
    {hint && <p className="text-xs font-medium text-[#121212]/60">{hint}</p>}
  </div>
));
BauhausField.displayName = "BauhausField";

/* ---------- Button: primary colour blocks that physically press down ---------- */
type BtnVariant = "red" | "blue" | "yellow" | "outline" | "ghost";

const variantMap: Record<BtnVariant, string> = {
  red: "bg-[#D02020] text-white border-2 border-[#121212] shadow-[4px_4px_0px_0px_#121212] hover:bg-[#D02020]/90",
  blue: "bg-[#1040C0] text-white border-2 border-[#121212] shadow-[4px_4px_0px_0px_#121212] hover:bg-[#1040C0]/90",
  yellow: "bg-[#F0C020] text-[#121212] border-2 border-[#121212] shadow-[4px_4px_0px_0px_#121212] hover:bg-[#F0C020]/90",
  outline: "bg-white text-[#121212] border-2 border-[#121212] shadow-[4px_4px_0px_0px_#121212] hover:bg-[#E0E0E0]",
  ghost: "bg-transparent text-[#121212] border-0 hover:bg-[#E0E0E0]",
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
  const pressable = variant !== "ghost";
  return (
    <button
      className={cn(
        "inline-flex h-12 min-h-[44px] items-center justify-center gap-3 px-8",
        "text-sm font-bold uppercase tracking-wider",
        "transition-all duration-200 ease-out",
        pressable && "active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#121212] focus-visible:outline-offset-[3px]",
        "disabled:pointer-events-none disabled:opacity-50",
        variantMap[variant],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={3} />}
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
    className="font-bold uppercase tracking-wide text-[#121212] underline decoration-[#D02020] decoration-4 underline-offset-4 transition-colors duration-200 hover:text-[#D02020] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#121212] focus-visible:outline-offset-[3px]"
  >
    {children}
  </Link>
);

/* ---------- Full-screen loader in style ---------- */
export const BauhausLoader = () => (
  <div className="bh-auth flex min-h-screen items-center justify-center bg-[#F0F0F0]">
    <div className="flex flex-col items-center gap-5">
      <span className="h-12 w-12 rounded-full border-4 border-[#121212] border-t-[#D02020] motion-safe:animate-spin" />
      <span className="text-[11px] font-bold uppercase tracking-widest text-[#121212]">
        Loading
      </span>
    </div>
  </div>
);
