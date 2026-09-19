import { useRef, useState } from "react";
import { BadgeCheck, Camera, Loader2, ScanLine, XCircle } from "lucide-react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type ScanResult = {
  tracking_number: string;
  courier_slug: string;
  confidence: number;
  matched?: { name?: boolean; phone?: boolean; pincode?: boolean };
};

type Props = {
  orderId: string;
  disabled?: boolean;
  onAccepted: (result: ScanResult) => void;
};

async function detectBarcode(file: File): Promise<string> {
  const Detector = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => { detect: (source: ImageBitmap) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
  if (!Detector || typeof createImageBitmap !== "function") return "";
  try {
    const bitmap = await createImageBitmap(file);
    const detector = new Detector({ formats: ["code_128", "code_39", "qr_code", "data_matrix", "ean_13"] });
    const codes = await detector.detect(bitmap);
    bitmap.close();
    return String(codes[0]?.rawValue ?? "").replace(/\s+/g, "").slice(0, 40);
  } catch {
    return "";
  }
}

export default function ParcelLabelScanner({ orderId, disabled, onAccepted }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<"idle" | "reading" | "checking" | "ready" | "error">("idle");
  const [message, setMessage] = useState("");

  const scan = async (file?: File) => {
    if (!file) return;
    setStage("reading");
    setMessage("Reading label…");
    const barcodeHint = await detectBarcode(file);
    setStage("checking");
    setMessage("Checking customer…");
    const form = new FormData();
    form.append("image", file);
    form.append("order_id", orderId);
    if (barcodeHint) form.append("barcode_hint", barcodeHint);

    const { data, error } = await supabase.functions.invoke("parcel-label-scan", { body: form });
    if (error) {
      let detail = error.message || "Could not scan this label";
      if (error instanceof FunctionsHttpError) {
        try {
          const body = await error.context.clone().json();
          detail = body?.error || body?.reasons?.[0] || detail;
        } catch {
          // Keep the SDK message when the response is not JSON.
        }
      }
      setStage("error");
      setMessage(detail);
      return;
    }
    if (!data?.tracking_number || !data?.courier_slug) {
      setStage("error");
      setMessage("We could not safely verify this label. Try a clearer photo.");
      return;
    }
    setStage("ready");
    setMessage("Customer matched · tracking details ready");
    onAccepted(data as ScanResult);
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void scan(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        disabled={disabled || stage === "reading" || stage === "checking"}
        onClick={() => inputRef.current?.click()}
      >
        {stage === "reading" || stage === "checking" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        {stage === "idle" ? "Scan parcel label" : stage === "ready" ? "Scan another label" : stage === "error" ? "Try another photo" : message}
      </Button>
      {stage !== "idle" && stage !== "reading" && stage !== "checking" && (
        <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${stage === "ready" ? "border-success/30 bg-success/5 text-foreground" : "border-destructive/30 bg-destructive/5 text-destructive"}`}>
          {stage === "ready" ? <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{message}</span>
        </div>
      )}
      {stage === "idle" && (
        <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <ScanLine className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Keep the recipient name, address and barcode clearly visible. A wrong customer label will be blocked.
        </p>
      )}
    </div>
  );
}