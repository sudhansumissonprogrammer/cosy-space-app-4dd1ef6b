import { useEffect, useRef, useState } from "react";
import { Mic, Loader2, Square, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { startWavRecording } from "@/lib/wavRecorder";

export type VoiceAddress = {
  full_name: string;
  phone: string;
  pincode: string;
  city: string;
  state: string;
  street: string;
};

type Props = {
  /** Called when the shopper confirms the heard address. */
  onFill: (address: VoiceAddress) => void;
  className?: string;
};

const LABELS: Record<keyof VoiceAddress, string> = {
  full_name: "Name",
  phone: "Phone",
  pincode: "Pincode",
  city: "City",
  state: "State",
  street: "Address",
};

const ERRORS: Record<string, string> = {
  audio_too_short: "That was too short — hold the button and speak your full address.",
  no_speech: "We couldn't hear anything. Try again in a quieter place.",
  audio_too_large: "That recording was too long. Try a shorter one.",
};

export default function VoiceAddressButton({ onFill, className }: Props) {
  const [state, setState] = useState<"idle" | "recording" | "working" | "review">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VoiceAddress | null>(null);
  const [transcript, setTranscript] = useState("");
  const [seconds, setSeconds] = useState(0);
  const recRef = useRef<Awaited<ReturnType<typeof startWavRecording>> | null>(null);

  useEffect(() => {
    if (state !== "recording") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [state]);

  // Safety: never leave the mic open if the component unmounts mid-recording.
  useEffect(() => () => { recRef.current?.cancel(); }, []);

  // Long clips cost more and transcribe worse — stop at 45s.
  useEffect(() => {
    if (state === "recording" && seconds >= 45) void stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, state]);

  async function start() {
    setError(null);
    setResult(null);
    setTranscript("");
    setSeconds(0);
    try {
      recRef.current = await startWavRecording();
      setState("recording");
    } catch (e) {
      const code = (e as MicError)?.code as MicErrorCode | undefined;
      setError(MIC_ERRORS[code || "unknown"] || MIC_ERRORS.unknown);
      setState("idle");
    }
  }

  async function stop() {
    const rec = recRef.current;
    if (!rec) return;
    recRef.current = null;
    setState("working");
    try {
      const blob = await rec.stop();
      if (blob.size < 4000) {
        setError(ERRORS.audio_too_short);
        setState("idle");
        return;
      }
      const form = new FormData();
      form.append("audio", blob, "address.wav");
      const { data, error: fnError } = await supabase.functions.invoke("voice-address", { body: form });
      if (fnError) throw fnError;
      if (data?.error) {
        setError(ERRORS[data.error] || "Couldn't understand that. Please try again.");
        setState("idle");
        return;
      }
      const addr = data?.address as VoiceAddress | undefined;
      const filled = addr && Object.values(addr).some((v) => String(v || "").trim());
      if (!filled) {
        setError("We couldn't pick out an address. Say your house number, area, city, state and pincode.");
        setState("idle");
        return;
      }
      setResult(addr!);
      setTranscript(String(data?.transcript || ""));
      setState("review");
    } catch {
      setError("Something went wrong. Please type your address or try again.");
      setState("idle");
    }
  }

  function cancel() {
    recRef.current?.cancel();
    recRef.current = null;
    setState("idle");
    setSeconds(0);
  }

  if (state === "review" && result) {
    const rows = (Object.keys(LABELS) as (keyof VoiceAddress)[]).filter((k) => result[k]?.trim());
    return (
      <div className={`rounded-lg border border-[#ECECEC] bg-[#F9FAFB] p-3 space-y-2 ${className || ""}`}>
        <p className="text-[12px] font-semibold">Is this right?</p>
        {transcript && <p className="text-[11px] italic text-muted-foreground">"{transcript}"</p>}
        <div className="space-y-1">
          {rows.map((k) => (
            <div key={k} className="flex gap-2 text-[12px]">
              <span className="w-16 shrink-0 text-muted-foreground">{LABELS[k]}</span>
              <span className="font-medium break-words">{result[k]}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            className="h-9 flex-1 text-xs"
            onClick={() => { onFill(result); setState("idle"); setResult(null); }}
          >
            <Check className="mr-1 h-3.5 w-3.5" /> Fill my address
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-9 text-xs" onClick={() => void start()}>
            Speak again
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-9 px-2" onClick={() => { setState("idle"); setResult(null); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">You can edit any field after filling.</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {state === "recording" ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
          </span>
          <span className="text-[12px] font-medium text-red-700">
            Listening… {String(seconds).padStart(2, "0")}s
          </span>
          <Button type="button" size="sm" className="ml-auto h-8 text-xs" onClick={() => void stop()}>
            <Square className="mr-1 h-3 w-3" /> Done
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={cancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full justify-center rounded-lg border-dashed text-[13px] font-medium"
          disabled={state === "working"}
          onClick={() => void start()}
        >
          {state === "working" ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Understanding your address…</>
          ) : (
            <><Mic className="mr-2 h-4 w-4" /> Speak your address (हिंदी भी चलेगी)</>
          )}
        </Button>
      )}
      {error && <p className="mt-1 text-[12px] text-red-600">{error}</p>}
      {state === "idle" && !error && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Say name, house/area, city, state and pincode in one go.
        </p>
      )}
    </div>
  );
}
