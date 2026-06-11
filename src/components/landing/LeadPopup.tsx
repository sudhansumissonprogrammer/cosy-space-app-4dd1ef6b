import { useState, useEffect, useCallback } from "react";
import { X, ArrowRight, CheckCircle2 } from "lucide-react";

/**
 * Landing lead-capture popup.
 *
 * Trigger rules (any one fires it, once per session):
 *  - 25 s after first paint
 *  - Scroll past 50% of the page
 *  - Desktop exit-intent (cursor leaves top of viewport)
 *
 * SAFETY / VALIDATION:
 *  - Client-side: length + format checks (mirrors DB CHECK constraints)
 *  - Server-side: RLS policy on landing_leads + CHECK constraints reject
 *    oversized / malformed payloads even if a client bypasses validation.
 *  - We deliberately DO NOT use any geolocation / Google Maps API. City is
 *    typed manually. No navigator.geolocation, no third-party SDK.
 *  - Submits via direct fetch to the Supabase REST endpoint so the landing
 *    fast-path bundle stays free of the supabase-js client.
 *  - Honeypot field ("website") rejects bot submissions silently.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const STORAGE_KEY = "lead_popup_state"; // values: "submitted" | "dismissed" | "snooze:<epochMs>"

type Form = { name: string; phone: string; business: string; city: string };
type Errors = Partial<Record<keyof Form, string>>;

const trim = (v: string, max: number) => v.replace(/\s+/g, " ").trim().slice(0, max);

function validate(form: Form): { ok: boolean; errors: Errors; clean: Form } {
  const clean: Form = {
    name: trim(form.name, 100),
    phone: form.phone.replace(/[^\d+]/g, "").slice(0, 20),
    business: trim(form.business, 100),
    city: trim(form.city, 100),
  };
  const errors: Errors = {};
  if (clean.name.length < 2) errors.name = "Please enter your name";
  // Indian phone: 10 digits, optionally with +91 prefix
  const digits = clean.phone.replace(/^\+?91/, "").replace(/^\+/, "");
  if (!/^\d{10}$/.test(digits)) errors.phone = "Enter a valid 10-digit phone";
  if (clean.business.length > 100) errors.business = "Too long";
  if (clean.city.length > 100) errors.city = "Too long";
  return { ok: Object.keys(errors).length === 0, errors, clean };
}

function shouldSuppress(): boolean {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    if (raw === "submitted") return true;
    if (raw.startsWith("snooze:")) {
      const until = Number(raw.slice(7));
      return Number.isFinite(until) && Date.now() < until;
    }
    return raw === "dismissed";
  } catch {
    return false;
  }
}

const LeadPopup = () => {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState<Form>({ name: "", phone: "", business: "", city: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState(""); // bot trap

  // Open logic — runs once on mount.
  useEffect(() => {
    if (shouldSuppress()) return;
    let armed = true;
    const open = () => {
      if (!armed) return;
      armed = false;
      setShow(true);
    };

    const timer = window.setTimeout(open, 25_000);

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max >= 0.5) open();
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const onMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) open();
    };
    document.addEventListener("mouseleave", onMouseLeave);

    return () => {
      armed = false;
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  const close = useCallback((reason: "dismissed" | "submitted") => {
    setShow(false);
    try {
      if (reason === "submitted") {
        localStorage.setItem(STORAGE_KEY, "submitted");
      } else {
        // Snooze for 24h so the popup doesn't pester the same visitor.
        const until = Date.now() + 24 * 60 * 60 * 1000;
        sessionStorage.setItem(STORAGE_KEY, `snooze:${until}`);
      }
    } catch {
      /* storage disabled — fine */
    }
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (honeypot) {
      // Silently pretend success for bots.
      setDone(true);
      setTimeout(() => close("submitted"), 1500);
      return;
    }
    const { ok, errors: errs, clean } = validate(form);
    setErrors(errs);
    if (!ok) return;

    setSubmitting(true);
    try {
      const payload = {
        name: clean.name,
        phone: clean.phone,
        business: clean.business || null,
        city: clean.city || null,
        page_path: window.location.pathname.slice(0, 500),
        referrer: (document.referrer || "").slice(0, 500),
        user_agent: (navigator.userAgent || "").slice(0, 500),
      };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/landing_leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        // Don't surface raw server errors to the user.
        throw new Error(`status ${res.status}`);
      }
      setDone(true);
      setTimeout(() => close("submitted"), 1800);
    } catch {
      setServerError("Couldn't submit right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-popup-title"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={() => close("dismissed")}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-bauhaus-white border-4 border-foreground shadow-bauhaus-lg max-w-md w-full p-6 sm:p-8"
      >
        <button
          type="button"
          onClick={() => close("dismissed")}
          className="absolute top-3 right-3 text-foreground hover:opacity-70"
          aria-label="Close"
        >
          <X className="h-5 w-5" strokeWidth={3} />
        </button>

        {done ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-bauhaus-yellow border-4 border-foreground rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-7 w-7 text-foreground" strokeWidth={3} />
            </div>
            <h3 className="font-black uppercase text-2xl tracking-tight text-foreground mb-2">
              Thank You!
            </h3>
            <p className="text-muted-foreground font-medium text-sm">
              Our team will call you within 24 hours.
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-5">
              <div className="inline-flex w-12 h-12 bg-bauhaus-red border-4 border-foreground rounded-full items-center justify-center mx-auto mb-3">
                <span className="text-xl">🚀</span>
              </div>
              <h3
                id="lead-popup-title"
                className="font-black uppercase text-2xl tracking-tight text-foreground mb-1"
              >
                Get a Free Demo
              </h3>
              <p className="text-muted-foreground font-medium text-xs">
                Tell us a bit about you — we'll call to help set up your store.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-3" noValidate>
              {/* honeypot — hidden from real users */}
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
                aria-hidden="true"
                name="website"
              />

              <Field
                label="Name"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
                placeholder="Your name"
                maxLength={100}
                autoComplete="name"
                error={errors.name}
                required
              />
              <Field
                label="Phone"
                type="tel"
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
                placeholder="10-digit mobile number"
                maxLength={20}
                autoComplete="tel"
                inputMode="tel"
                error={errors.phone}
                required
              />
              <Field
                label="Business Type"
                value={form.business}
                onChange={(v) => setForm({ ...form, business: v })}
                placeholder="e.g. Clothing, Bakery"
                maxLength={100}
                error={errors.business}
              />
              <Field
                label="City"
                value={form.city}
                onChange={(v) => setForm({ ...form, city: v })}
                placeholder="Your city"
                maxLength={100}
                autoComplete="address-level2"
                error={errors.city}
              />

              {serverError && (
                <p className="text-bauhaus-red text-xs font-bold uppercase tracking-wider">
                  {serverError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-bauhaus-red text-bauhaus-white font-black uppercase tracking-wider text-sm py-3.5 border-3 border-foreground shadow-[4px_4px_0px_0px_hsl(var(--foreground))] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-[transform,opacity,colors,box-shadow] duration-150 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0px_0px_hsl(var(--foreground))]"
              >
                {submitting ? "Submitting..." : (<>Book Free Demo <ArrowRight className="h-4 w-4" /></>)}
              </button>

              <p className="text-[10px] text-muted-foreground text-center font-medium pt-1">
                No spam • We respect your privacy
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  maxLength,
  autoComplete,
  inputMode,
  error,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  autoComplete?: string;
  inputMode?: "tel" | "text" | "email" | "numeric";
  error?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="font-bold uppercase tracking-widest text-[10px] text-muted-foreground mb-1 block">
        {label}{required && <span className="text-bauhaus-red"> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={!!error}
        className={`w-full border-2 ${error ? "border-bauhaus-red" : "border-foreground"} p-2.5 font-medium text-sm text-foreground bg-bauhaus-canvas focus:outline-none focus:ring-2 focus:ring-bauhaus-blue`}
      />
      {error && (
        <p className="text-bauhaus-red text-[11px] font-bold mt-1">{error}</p>
      )}
    </div>
  );
}

export default LeadPopup;
