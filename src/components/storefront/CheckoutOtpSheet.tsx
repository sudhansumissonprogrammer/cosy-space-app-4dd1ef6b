/**
 * CheckoutOtpSheet — "Verify number securely" bottom sheet shown at checkout
 * ONLY for stores that switched on mobile-number verification.
 *
 * Behaviour:
 *  - 6 separate boxes, auto-advance, backspace-back, paste anywhere.
 *  - Autofill: `autocomplete="one-time-code"` + WebOTP where available, plus a
 *    clipboard read on focus/visibility-return (WhatsApp's "Copy code" button
 *    puts the code on the clipboard, so returning to the tab fills it).
 *  - Auto-submits the moment 6 digits are present.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  storeId: string;
  phone: string; // canonical 10-digit
  onEdit: () => void;
  onVerified: () => void;
}

const RESEND_SECONDS = 30;

export default function CheckoutOtpSheet({ storeId, phone, onEdit, onVerified }: Props) {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>("Code sent on WhatsApp");
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const submitted = useRef(false);

  const code = digits.join("");

  useEffect(() => {
    const t = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    inputs.current[0]?.focus();
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
        setDigits(["", "", "", "", "", ""]);
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
      <div className="absolute inset-0 bg-black/45" onClick={onEdit} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Verify mobile number"
        className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white px-5 pb-7 pt-8 shadow-2xl animate-in slide-in-from-bottom duration-200"
        style={{ background: "linear-gradient(180deg, #FEF7E4 0%, #FFFFFF 55%)" }}
      >
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <Lock className="h-6 w-6 text-amber-700" />
          </div>
          <h2 className="mt-4 text-[20px] font-extrabold tracking-tight">Verify number securely</h2>
          <p className="mt-1 inline-flex items-center gap-1 text-[12.5px] text-muted-foreground">
            Your details are safe with us <ShieldCheck className="h-3.5 w-3.5" />
          </p>

          <div className="mt-5 text-[15px] font-bold">Verify mobile number</div>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Enter OTP sent to{" "}
            <span className="font-semibold text-foreground underline underline-offset-2">
              +91 {phone.slice(0, 5)} {phone.slice(5)}
            </span>{" "}
            <button type="button" onClick={onEdit} className="font-bold text-foreground underline">
              Edit
            </button>
          </p>

          <div className="mt-5 flex items-center justify-center gap-2.5" onPaste={(e) => {
            e.preventDefault();
            fill(e.clipboardData.getData("text"));
          }}>
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
                onFocus={() => { if (!code) tryClipboard(); }}
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
                className="h-12 w-12 rounded-xl border-2 border-[#E3E3E3] bg-white text-center text-[18px] font-bold outline-none transition-colors focus:border-black disabled:opacity-60"
              />
            ))}
          </div>

          {verifying && (
            <div className="mt-4 inline-flex items-center gap-2 text-[12.5px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
            </div>
          )}
          {!verifying && error && (
            <p className="mt-4 text-[12.5px] font-medium text-red-600">{error}</p>
          )}
          {!verifying && !error && info && (
            <p className="mt-4 text-[12.5px] text-muted-foreground">{info}</p>
          )}

          <div className="mt-4 text-[12.5px] text-muted-foreground">
            {countdown > 0 ? (
              <>Resend OTP in {mm}:{ss}</>
            ) : (
              <button
                type="button"
                onClick={resend}
                disabled={sending}
                className="font-bold text-foreground underline disabled:opacity-60"
              >
                {sending ? "Sending…" : "Resend OTP on WhatsApp"}
              </button>
            )}
          </div>

          <Button
            variant="ghost"
            onClick={onEdit}
            className="mt-3 h-9 text-[12.5px] text-muted-foreground"
          >
            Change number
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
