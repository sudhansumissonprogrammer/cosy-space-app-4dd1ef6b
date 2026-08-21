import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ShieldCheck } from "lucide-react";
import { IndiaFlagIcon } from "@/components/ui/IndiaFlagIcon";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LeadFormProps {
  storeId: string;
  segmentLabel: string;
  couponCode?: string;
  heading: string;
  subheading: string;
  consentLabel: string;
  requireOtp?: boolean;
  previewMode?: boolean;
  onSubmitted: () => void;
}

const APP_ID = "spin-wheel";

/**
 * Remember the shopper's mobile the same way the Buy Now gate does, so a
 * number collected here is never asked for again at checkout.
 */
function rememberPhoneForCheckout(phone: string) {
  try {
    localStorage.setItem("checkout_phone", phone);
    localStorage.setItem("sf_spin_phone", phone);
  } catch {}
}

export default function LeadForm({
  storeId,
  segmentLabel,
  couponCode,
  heading,
  subheading,
  consentLabel,
  requireOtp = false,
  previewMode = false,
  onSubmitted,
}: LeadFormProps) {
  const [phone, setPhone] = useState(() => {
    try {
      const saved = localStorage.getItem("checkout_phone") || "";
      return saved.replace(/\D/g, "").slice(-10);
    } catch {
      return "";
    }
  });
  const [consent, setConsent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [otpError, setOtpError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const phoneValid = /^[6-9]\d{9}$/.test(phone);
  const canSubmit = phoneValid && !submitting;

  useEffect(() => {
    if (resendIn <= 0) return;
    timerRef.current = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [resendIn]);

  const finish = () => {
    rememberPhoneForCheckout(phone);
    try { localStorage.setItem(`sf_spin_lead_${storeId}`, String(Date.now())); } catch {}
    onSubmitted();
  };

  /** Plain (no-OTP) capture — unchanged behaviour. */
  const saveLead = async () => {
    const { error } = await supabase.functions.invoke("store-app-lead", {
      body: {
        store_id: storeId,
        app_id: APP_ID,
        phone,
        country_code: "+91",
        marketing_opt_in: consent,
        coupon_code: couponCode ?? null,
        segment_label: segmentLabel,
        metadata: { source: "spin-wheel", ua: navigator.userAgent.slice(0, 200) },
      },
    });
    if (error) throw error;
    finish();
  };

  const sendOtp = async () => {
    const { data, error } = await supabase.functions.invoke("store-lead-otp-send", {
      body: { store_id: storeId, app_id: APP_ID, phone },
    });
    const payload: any = data ?? {};
    if (error || payload?.error) {
      throw new Error(payload?.message || error?.message || "Could not send the code");
    }
    setStep("otp");
    setCode("");
    setOtpError(null);
    setResendIn(Number(payload?.resend_after) || 30);
    toast.success("Code sent on WhatsApp");
  };

  const submitPhone = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (previewMode) {
        await new Promise((r) => setTimeout(r, 350));
        if (requireOtp) { setStep("otp"); setResendIn(30); } else onSubmitted();
        return;
      }
      if (requireOtp) await sendOtp();
      else await saveLead();
    } catch (e: any) {
      toast.error(e?.message || "Could not save. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const verifyOtp = async () => {
    if (code.length !== 6 || submitting) return;
    setSubmitting(true);
    setOtpError(null);
    try {
      if (previewMode) {
        await new Promise((r) => setTimeout(r, 350));
        onSubmitted();
        return;
      }
      const { data, error } = await supabase.functions.invoke("store-lead-otp-verify", {
        body: {
          store_id: storeId,
          app_id: APP_ID,
          phone,
          code,
          marketing_opt_in: consent,
          coupon_code: couponCode ?? null,
          segment_label: segmentLabel,
          metadata: { source: "spin-wheel", ua: navigator.userAgent.slice(0, 200) },
        },
      });
      const payload: any = data ?? {};
      if (error || payload?.error) {
        setOtpError(payload?.message || error?.message || "Incorrect code");
        return;
      }
      finish();
    } catch (e: any) {
      setOtpError(e?.message || "Could not verify. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-verify as soon as all 6 digits are in.
  useEffect(() => {
    if (step === "otp" && code.length === 6 && !submitting) void verifyOtp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, step]);

  if (step === "otp") {
    return (
      <div className="rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-center text-lg font-extrabold text-slate-900">Verify your number</h3>
        <p className="mt-1 text-center text-xs text-slate-500">
          We sent a 6-digit code on WhatsApp to <span className="font-semibold text-slate-700">+91 {phone}</span>
        </p>

        <Input
          type="tel"
          inputMode="numeric"
          maxLength={6}
          placeholder="––––––"
          value={code}
          onChange={(e) => { setOtpError(null); setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); }}
          className="mt-4 h-14 text-center font-mono text-2xl font-black tracking-[0.4em] text-slate-900"
          autoFocus
        />
        {otpError ? <p className="mt-2 text-center text-xs font-medium text-destructive">{otpError}</p> : null}

        <Button
          onClick={verifyOtp}
          disabled={code.length !== 6 || submitting}
          className="mt-4 w-full h-12 rounded-xl text-base font-bold"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Unlock"}
        </Button>

        <div className="mt-3 flex items-center justify-between text-[11px]">
          <button
            type="button"
            onClick={() => { setStep("phone"); setCode(""); setOtpError(null); }}
            className="font-medium text-slate-500 hover:text-slate-800"
          >
            Change number
          </button>
          <button
            type="button"
            disabled={resendIn > 0 || submitting}
            onClick={() => { setSubmitting(true); sendOtp().catch((e) => toast.error(e?.message || "Resend failed")).finally(() => setSubmitting(false)); }}
            className="font-semibold text-slate-700 disabled:text-slate-400"
          >
            {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-xl">
      <h3 className="text-center text-lg font-extrabold text-slate-900">{heading}</h3>
      <p className="mt-1 text-center text-xs text-slate-500">{subheading}</p>

      <div className="mt-4 flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white p-3 focus-within:border-slate-400 transition-colors">
        <span className="flex items-center gap-1 text-sm font-semibold text-slate-700 pr-2 border-r border-slate-200">
          <IndiaFlagIcon className="h-3.5 w-5 rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" /> <span>+91</span>
        </span>
        <Input
          type="tel"
          inputMode="numeric"
          maxLength={10}
          placeholder="Enter Mobile Number"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
          className="border-0 shadow-none focus-visible:ring-0 px-0 h-8 text-base font-medium text-slate-900 placeholder:text-slate-400"
          autoFocus
        />
      </div>

      <label className="mt-3 flex items-start gap-2 cursor-pointer">
        <Checkbox
          checked={consent}
          onCheckedChange={(v) => setConsent(v === true)}
          className="mt-0.5"
        />
        <span className="text-xs text-slate-600 select-none">{consentLabel}</span>
      </label>

      <Button
        onClick={submitPhone}
        disabled={!canSubmit}
        className="mt-4 w-full h-12 rounded-xl text-base font-bold"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : requireOtp ? "Send OTP on WhatsApp" : "Unlock Discount"}
      </Button>

      {requireOtp ? (
        <p className="mt-3 flex items-center justify-center gap-1 text-center text-[10px] text-slate-400">
          <ShieldCheck className="h-3 w-3" /> We'll WhatsApp a 6-digit code to confirm it's you
        </p>
      ) : (
        <p className="mt-3 text-center text-[10px] text-slate-400">
          By continuing you agree to receive offers via WhatsApp/SMS
        </p>
      )}
    </div>
  );
}
