/**
 * CheckoutOtpSheet — "Verify number securely" bottom sheet shown at checkout
 * ONLY for stores that switched on mobile-number verification.
 *
 * UX contract (matches the reference GoKwik verification sheet):
 *  - Opens INSTANTLY when the shopper taps Continue; the WhatsApp code is
 *    requested in the background from inside this sheet (no dead wait on the
 *    phone screen).
 *  - Cream→white gradient sheet, animated padlock + typing/scan illustration,
 *    navy "Verify mobile number" heading, underlined number + Edit,
 *    rounded OTP boxes, "Resend OTP in mm:ss", powered-by footer.
 *  - Autofill: `autocomplete="one-time-code"` + WebOTP where available, plus a
 *    clipboard read on focus/visibility-return (WhatsApp's "Copy code" button
 *    puts the code on the clipboard, so returning to the tab fills it).
 *  - Auto-submits the moment 6 digits are present.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import shopbanaoLogo from "@/assets/shopbanao-logo.webp";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  storeId: string;
  phone: string; // canonical 10-digit
  onEdit: () => void;
  onVerified: () => void;
  /** Called when the code could not be delivered at all — never dead-end a shopper. */
  onSendFailed?: (message?: string) => void;
}

const RESEND_SECONDS = 30;
const EMPTY = ["", "", "", "", "", ""];

export default function CheckoutOtpSheet({ storeId, phone, onEdit, onVerified, onSendFailed }: Props) {
  const [digits, setDigits] = useState<string[]>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>("Sending code on WhatsApp…");
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const submitted = useRef(false);
  const firstSend = useRef(false);

  const code = digits.join("");

  // ── Send the code from inside the sheet so the sheet appears instantly ──
  useEffect(() => {
    if (firstSend.current) return;
    firstSend.current = true;
    (async () => {
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("checkout-otp-send", {
          body: { store_id: storeId, phone },
        });
        const res = data as any;
        if (res?.sent) {
          setInfo("Code sent on WhatsApp");
          setCountdown(RESEND_SECONDS);
          return;
        }
        if (res?.disabled) {
          onSendFailed?.();
          return;
        }
        onSendFailed?.(res?.message || fnErr?.message);
      } catch (e: any) {
        onSendFailed?.(e?.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => inputs.current[0]?.focus(), 250);
    return () => clearTimeout(t);
  }, []);

  const fill = useCallback((value: string) => {
    const only = value.replace(/\D/g, "").slice(0, 6);
    if (!only) return;
    const next = ["", "", "", "", "", ""];
    only.split("").forEach((d, i) => (next[i] = d));
    setDigits(next);
    inputs.current[Math.min(only.length, 5)]?.focus();
  }, []);

  // WebOTP (works when the code arrives as SMS on Android Chrome).
  useEffect(() => {
    const anyNav = navigator as any;
    if (!("OTPCredential" in window) || !anyNav.credentials) return;
    const ac = new AbortController();
    anyNav.credentials
      .get({ otp: { transport: ["sms"] }, signal: ac.signal })
      .then((c: any) => c?.code && fill(c.code))
      .catch(() => {});
    return () => ac.abort();
  }, [fill]);

  // Clipboard autofill — WhatsApp authentication templates carry a
  // "Copy code" button, so the code is usually on the clipboard when the
  // shopper switches back to the browser.
  const tryClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const m = text && text.match(/\b(\d{6})\b/);
      if (m) fill(m[1]);
    } catch {
      /* permission denied — shopper types it manually */
    }
  }, [fill]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && !code) tryClipboard();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [code, tryClipboard]);

  const verify = useCallback(
    async (value: string) => {
      if (verifying || submitted.current) return;
      submitted.current = true;
      setVerifying(true);
      setError(null);
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("checkout-otp-verify", {
          body: { store_id: storeId, phone, code: value },
        });
        const res = data as any;
        if (res?.verified) {
          onVerified();
          return;
        }
        setError(res?.message || (fnErr ? "Could not verify right now. Please try again." : "Incorrect code."));
        setDigits(EMPTY);
        inputs.current[0]?.focus();
      } catch {
        setError("Could not verify right now. Please try again.");
      } finally {
        submitted.current = false;
        setVerifying(false);
      }
    },
    [onVerified, phone, storeId, verifying],
  );

  useEffect(() => {
    if (code.length === 6) verify(code);
  }, [code, verify]);

  const resend = async () => {
    if (countdown > 0 || sending) return;
    setSending(true);
    setError(null);
    try {
      const { data } = await supabase.functions.invoke("checkout-otp-send", {
        body: { store_id: storeId, phone },
      });
      const res = data as any;
      if (res?.sent || res?.disabled) {
        setInfo("New code sent on WhatsApp");
        setCountdown(RESEND_SECONDS);
      } else {
        setError(res?.message || "Could not resend the code. Please try again.");
        if (res?.retry_after) setCountdown(Number(res.retry_after));
      }
    } catch {
      setError("Could not resend the code. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const onKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      const next = [...digits];
      next[i - 1] = "";
      setDigits(next);
      inputs.current[i - 1]?.focus();
    }
  };

  const mm = String(Math.floor(countdown / 60)).padStart(2, "0");
  const ss = String(countdown % 60).padStart(2, "0");

  // Portal to <body>: an animated ancestor on the checkout page creates a
  // containing block that would otherwise collapse this fixed overlay to 0px.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      <style>{`
        @keyframes sbOtpSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes sbOtpFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes sbOtpLock { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
        @keyframes sbOtpStar { 0%,100% { opacity:.25; transform: scale(.85) } 40% { opacity:1; transform: scale(1.15) } }
        @keyframes sbOtpScan { 0% { transform: translateX(-100%) } 100% { transform: translateX(340%) } }
        .sb-otp-sheet { animation: sbOtpSheetUp .34s cubic-bezier(.22,1,.36,1); }
        .sb-otp-body { animation: sbOtpFade .45s ease .1s both; }
        .sb-otp-lock { animation: sbOtpLock 2.1s ease-in-out infinite; }
        .sb-otp-star { animation: sbOtpStar 1.2s ease-in-out infinite; }
        .sb-otp-scan { animation: sbOtpScan 1.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .sb-otp-sheet, .sb-otp-body, .sb-otp-lock, .sb-otp-star, .sb-otp-scan { animation: none !important; }
        }
      `}</style>

      <div
        className="absolute inset-0 bg-black/45"
        style={{ animation: "sbOtpFade .2s ease" }}
        onClick={onEdit}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Verify mobile number"
        className="sb-otp-sheet relative w-full max-w-md overflow-hidden rounded-t-[26px] sm:rounded-[26px] px-5 pb-7 pt-8 shadow-2xl"
        style={{ background: "linear-gradient(180deg, #FDF3D8 0%, #FEF9EC 32%, #FFFFFF 62%)" }}
      >
        <div className="sb-otp-body flex flex-col items-center text-center">
          {/* Animated padlock + "code being typed" illustration */}
          <div className="sb-otp-lock text-[34px] leading-none" aria-hidden>🔐</div>

          <div className="mt-2 flex items-center gap-1.5" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="sb-otp-star text-[17px] font-black leading-none text-emerald-500"
                style={{ animationDelay: `${i * 0.16}s` }}
              >
                ✳
              </span>
            ))}
          </div>

          <div className="mt-2.5 flex w-[104px] flex-col items-center gap-1.5" aria-hidden>
            <div className="relative h-[7px] w-full overflow-hidden rounded-full bg-[#E4E4E4]">
              <span className="sb-otp-scan absolute inset-y-0 left-0 w-[30%] rounded-full bg-emerald-500" />
            </div>
            <div className="relative h-[7px] w-[74%] overflow-hidden rounded-full bg-[#E4E4E4]">
              <span
                className="sb-otp-scan absolute inset-y-0 left-0 w-[30%] rounded-full bg-emerald-500"
                style={{ animationDelay: ".3s" }}
              />
            </div>
          </div>

          <h2 className="mt-4 text-[22px] font-extrabold tracking-tight text-[#111]">
            Verify number securely
          </h2>
          <p className="mt-1 inline-flex items-center gap-1 text-[13px] text-[#6B7280]">
            Your details are safe with us <Lock className="h-3.5 w-3.5" />
          </p>

          <div className="mt-5 text-[16px] font-bold text-[#1B1B5C]">Verify mobile number</div>
          <p className="mt-1 text-[13px] text-[#6B7280]">
            Enter OTP sent to{" "}
            <span className="font-semibold text-[#111] underline underline-offset-[3px]">
              +91- {phone.slice(0, 5)} {phone.slice(5)}
            </span>{" "}
            <button type="button" onClick={onEdit} className="font-bold text-[#111]">
              Edit
            </button>
          </p>

          <div
            className="mt-5 flex items-center justify-center gap-3"
            onPaste={(e) => {
              e.preventDefault();
              fill(e.clipboardData.getData("text"));
            }}
          >
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (inputs.current[i] = el)}
                value={d}
                type="tel"
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={1}
                disabled={verifying}
                aria-label={`Digit ${i + 1}`}
                onFocus={() => {
                  if (!code) tryClipboard();
                }}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "");
                  if (v.length > 1) return fill(v);
                  const next = [...digits];
                  next[i] = v;
                  setDigits(next);
                  if (v && i < 5) inputs.current[i + 1]?.focus();
                  if (error) setError(null);
                }}
                onKeyDown={(e) => onKey(i, e)}
                className="h-[52px] w-[46px] rounded-[14px] border border-[#D9D9D9] bg-white text-center text-[19px] font-bold text-[#111] caret-[#111] outline-none transition-all focus:border-[#111] focus:shadow-[0_0_0_1px_#111] disabled:opacity-60"
              />
            ))}
          </div>

          {verifying && (
            <div className="mt-4 inline-flex items-center gap-2 text-[12.5px] text-[#6B7280]">
              <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
            </div>
          )}
          {!verifying && error && (
            <p className="mt-4 text-[12.5px] font-medium text-red-600">{error}</p>
          )}
          {!verifying && !error && info && (
            <p className="mt-4 inline-flex items-center gap-1 text-[12.5px] text-[#6B7280]">
              <ShieldCheck className="h-3.5 w-3.5" /> {info}
            </p>
          )}

          <div className="mt-3 text-[13px] text-[#6B7280]">
            {countdown > 0 ? (
              <>
                Resend OTP in {mm}:{ss}
              </>
            ) : (
              <button
                type="button"
                onClick={resend}
                disabled={sending}
                className="font-bold text-[#111] underline disabled:opacity-60"
              >
                {sending ? "Sending…" : "Resend OTP on WhatsApp"}
              </button>
            )}
          </div>

          <div className="mt-5 inline-flex items-center gap-1.5 text-[12px] text-[#9CA3AF]">
            Powered by
            <img
              src={shopbanaoLogo}
              alt=""
              width={16}
              height={16}
              className="h-4 w-4 object-contain"
              loading="lazy"
            />
            <span className="font-bold text-[#4B5563]">ShopBanao</span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
