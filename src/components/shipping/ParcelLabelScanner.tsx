import { useRef, useState } from "react";
import { BadgeCheck, Camera, Images, Loader2, ScanLine, XCircle } from "lucide-react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ScanResult = {
  scan_id: string;
  tracking_number: string;
  courier_slug: string;
  confidence: number;
  matched?: { phone?: boolean };
  decision?: "accepted" | "review";
  needs_tracking_confirmation?: boolean;
  message?: string;
};

type Props = {
  orderId: string;
  disabled?: boolean;
  onScanStart: () => void;
  onAccepted: (result: ScanResult) => void;
};

async function prepareParcelImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const maxEdge = 1600;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare this photo");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.84));
    if (!blob) throw new Error("Could not prepare this photo");
    return new File([blob], file.name.replace(/\.[^.]+$/i, ".jpg"), { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

async function detectBarcode(file: File): Promise<string> {
  const Detector = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => { detect: (source: ImageBitmap) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
  if (!Detector || typeof createImageBitmap !== "function") return "";
  try {
    const bitmap = await createImageBitmap(file);
    // QR/data-matrix payloads often contain booking URLs or JSON, not the AWB.
    const detector = new Detector({ formats: ["code_128", "code_39"] });
    const codes = await detector.detect(bitmap);
    bitmap.close();
    return String(codes[0]?.rawValue ?? "").replace(/\s+/g, "").slice(0, 40);
  } catch {
    return "";
  }
}

export default function ParcelLabelScanner({ orderId, disabled, onScanStart, onAccepted }: Props) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<"idle" | "reading" | "checking" | "ready" | "error">("idle");
  const [message, setMessage] = useState("");
  const [reviewResult, setReviewResult] = useState<ScanResult | null>(null);
  const [manualAwb, setManualAwb] = useState("");

  const scan = async (file?: File) => {
    if (!file) return;
    onScanStart();
    setReviewResult(null);
    setManualAwb("");
    setStage("reading");
    setMessage("Reading label…");
    let preparedFile: File;
    try {
      preparedFile = await prepareParcelImage(file);
    } catch {
      setStage("error");
      setMessage("Could not prepare this photo. Try taking a new photo.");
      return;
    }
    const barcodeHint = await detectBarcode(preparedFile);
    setStage("checking");
    setMessage("Checking tracking number and phone…");
    const form = new FormData();
    form.append("image", preparedFile);
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
    if (data?.decision === "review" && data?.scan_id && data?.needs_tracking_confirmation) {
      setReviewResult(data as ScanResult);
      setManualAwb(String(data.tracking_number || ""));
      setStage("ready");
      setMessage(data.message || "Enter the complete tracking number printed on this label.");
      return;
    }
    if (!data?.tracking_number || !data?.courier_slug) {
      setStage("error");
      setMessage("We could not safely verify this label. Try a clearer photo.");
      return;
    }
    setStage("ready");
    setMessage("Phone matched · tracking number ready");
    onAccepted(data as ScanResult);
  };

  const confirmTracking = async () => {
    const value = manualAwb.replace(/\s+/g, "").toUpperCase();
    if (!reviewResult?.scan_id || !/^[A-Z0-9._-]{4,40}$/.test(value)) {
      setStage("error");
      setMessage("Enter the complete tracking number printed on the label.");
      return;
    }
    setStage("checking");
    setMessage("Checking tracking number…");
    const form = new FormData();
    form.append("order_id", orderId);
    form.append("review_scan_id", reviewResult.scan_id);
    form.append("manual_awb", value);
    const { data, error } = await supabase.functions.invoke("parcel-label-scan", { body: form });
    if (error || !data?.tracking_number) {
      let detail = error?.message || "Could not confirm this tracking number";
      if (error instanceof FunctionsHttpError) {
        try {
          const body = await error.context.clone().json();
          detail = body?.error || detail;
        } catch { /* keep SDK message */ }
      }
      setStage("error");
      setMessage(detail);
      return;
    }
    setStage("ready");
    setReviewResult(null);
    setMessage("Tracking number ready");
    onAccepted(data as ScanResult);
  };

  return (
    <div className="space-y-2">
      <input
        ref={cameraInputRef}
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
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void scan(file);
        }}
      />
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-w-0 gap-2"
          disabled={disabled || stage === "reading" || stage === "checking"}
          onClick={() => cameraInputRef.current?.click()}
        >
          <Camera className="h-4 w-4 shrink-0" />
          Take photo
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-w-0 gap-2"
          disabled={disabled || stage === "reading" || stage === "checking"}
          onClick={() => galleryInputRef.current?.click()}
        >
          <Images className="h-4 w-4 shrink-0" />
          Gallery
        </Button>
      </div>
      {reviewResult && (
        <div className="space-y-2 rounded-md border bg-muted/40 p-3">
          <p className="text-xs font-medium text-foreground">Confirm tracking number</p>
          <Input
            value={manualAwb}
            onChange={(event) => setManualAwb(event.target.value.toUpperCase().replace(/\s+/g, "").slice(0, 40))}
            placeholder="Tracking number"
            autoCapitalize="characters"
            autoCorrect="off"
            disabled={disabled || stage === "checking"}
            aria-label="Tracking number"
          />
          <Button type="button" className="w-full" disabled={disabled || stage === "checking" || manualAwb.length < 4} onClick={() => void confirmTracking()}>
            Confirm tracking number
          </Button>
        </div>
      )}
      {(stage === "reading" || stage === "checking") && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-foreground">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          <span>{message}</span>
        </div>
      )}
      {stage !== "idle" && stage !== "reading" && stage !== "checking" && (
        <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${stage === "ready" ? "border-success/30 bg-success/5 text-foreground" : "border-destructive/30 bg-destructive/5 text-destructive"}`}>
          {stage === "ready" ? <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{message}</span>
        </div>
      )}
      {stage === "idle" && (
        <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <ScanLine className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Keep the complete phone number, tracking number, and barcode clearly visible.
        </p>
      )}
    </div>
  );
}