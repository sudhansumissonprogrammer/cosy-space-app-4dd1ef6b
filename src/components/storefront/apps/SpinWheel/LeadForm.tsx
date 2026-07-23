import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
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
  previewMode?: boolean;
  onSubmitted: () => void;
}

export default function LeadForm({
  storeId,
  segmentLabel,
  couponCode,
  heading,
  subheading,
  consentLabel,
  previewMode = false,
  onSubmitted,
}: LeadFormProps) {
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = /^[6-9]\d{9}$/.test(phone) && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (previewMode) {
        await new Promise((r) => setTimeout(r, 400));
        onSubmitted();
        return;
      }
      const { error } = await supabase.functions.invoke("store-app-lead", {
        body: {
          store_id: storeId,
          app_id: "spin-wheel",
          phone,
          country_code: "+91",
          marketing_opt_in: consent,
          coupon_code: couponCode ?? null,
          segment_label: segmentLabel,
          metadata: { source: "spin-wheel", ua: navigator.userAgent.slice(0, 200) },
        },
      });
      if (error) throw error;
      try { localStorage.setItem(`sf_spin_lead_${storeId}`, String(Date.now())); } catch {}
      onSubmitted();
    } catch (e: any) {
      toast.error(e?.message || "Could not save. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

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
        onClick={submit}
        disabled={!canSubmit}
        className="mt-4 w-full h-12 rounded-xl text-base font-bold"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock Discount"}
      </Button>

      <p className="mt-3 text-center text-[10px] text-slate-400">
        By continuing you agree to receive offers via WhatsApp/SMS
      </p>
    </div>
  );
}
