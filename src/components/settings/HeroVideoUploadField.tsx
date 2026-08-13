import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadHeroVideo, type HeroVideoTarget } from "@/lib/uploadHeroVideo";

interface HeroVideoUploadFieldProps {
  label: string;
  hint: string;
  target: HeroVideoTarget;
  userId: string;
  storeId: string;
  videoUrl: string;
  posterUrl: string;
  onChange: (next: { videoUrl: string; posterUrl: string }) => void;
}

const STAGE_LABEL: Record<string, string> = {
  reading: "Reading video…",
  resizing: "Resizing for best speed…",
  "uploading-video": "Uploading video…",
  "uploading-poster": "Finishing up…",
};

/**
 * Hero video picker used in Store Settings.
 *
 * Uploads immediately on selection (resize + poster happen in the browser) so
 * the merchant sees the result before saving. The parent only stores the two
 * resulting URLs and writes them with the rest of the settings form.
 */
export default function HeroVideoUploadField({
  label,
  hint,
  target,
  userId,
  storeId,
  videoUrl,
  posterUrl,
  onChange,
}: HeroVideoUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string>("");
  const [pct, setPct] = useState(0);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setPct(0);
    setStage("reading");
    try {
      const result = await uploadHeroVideo(file, {
        userId,
        storeId,
        target,
        onStage: (s) => setStage(s),
        onProgress: (p) => setPct(Math.round(p * 100)),
      });
      onChange({ videoUrl: result.videoUrl, posterUrl: result.posterUrl });
      const saved = result.originalBytes - result.finalBytes;
      toast.success(
        saved > 100 * 1024
          ? `Video ready — optimised to ${(result.finalBytes / 1024 / 1024).toFixed(1)}MB`
          : "Video uploaded",
      );
    } catch (err: any) {
      toast.error(err?.message || "Could not upload this video");
    } finally {
      setBusy(false);
      setStage("");
      setPct(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-[11px] text-muted-foreground">{hint}</p>
        </div>
        {videoUrl && !busy && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-destructive"
            onClick={() => onChange({ videoUrl: "", posterUrl: "" })}
          >
            <X className="h-3.5 w-3.5 mr-1" /> Remove
          </Button>
        )}
      </div>

      {videoUrl ? (
        <video
          src={videoUrl}
          poster={posterUrl || undefined}
          className="w-full max-h-44 rounded-lg border bg-muted object-contain"
          controls
          muted
          loop
          playsInline
          preload="metadata"
        />
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex h-24 w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Video className="h-5 w-5" />}
          <span className="text-[11px]">{busy ? STAGE_LABEL[stage] || "Working…" : "Upload video"}</span>
          {busy && pct > 0 && <span className="text-[10px]">{pct}%</span>}
        </button>
      )}

      {videoUrl && !busy && (
        <Button type="button" variant="outline" size="sm" className="h-8 w-full" onClick={() => inputRef.current?.click()}>
          Replace video
        </Button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
