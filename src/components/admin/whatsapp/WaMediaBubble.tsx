import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText, Download, AlertCircle } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

/**
 * Renders a WhatsApp media attachment (audio / image / video / document).
 * Meta media needs a Bearer token + fresh URL, so bytes are streamed through
 * the `wa-media` edge function and turned into a local object URL.
 */
export function WaMediaBubble({
  messageId,
  mediaType,
}: {
  messageId: string;
  mediaType: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/wa-media?message_id=${encodeURIComponent(messageId)}`,
          { headers: { Authorization: `Bearer ${session?.access_token ?? ""}` } },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(
            res.status === 410
              ? "Media expired on WhatsApp (older than 30 days)"
              : body?.error || `Failed to load media (${res.status})`,
          );
        }
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load media");
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [messageId]);

  if (error) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground py-1">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading {mediaType}…
      </div>
    );
  }

  if (mediaType === "audio") {
    return <audio controls preload="metadata" src={url} className="my-1 h-9 w-[240px] max-w-full" />;
  }

  if (mediaType === "image") {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img
          src={url}
          alt="WhatsApp attachment"
          loading="lazy"
          className="my-1 max-h-64 w-auto max-w-full rounded-md object-cover"
        />
      </a>
    );
  }

  if (mediaType === "video") {
    return <video controls preload="metadata" src={url} className="my-1 max-h-64 max-w-full rounded-md" />;
  }

  return (
    <a
      href={url}
      download
      className="my-1 flex items-center gap-2 rounded-md border bg-background px-2.5 py-2 text-[12px] hover:bg-muted"
    >
      <FileText className="h-4 w-4 shrink-0" />
      <span className="flex-1">Document</span>
      <Download className="h-3.5 w-3.5" />
    </a>
  );
}
