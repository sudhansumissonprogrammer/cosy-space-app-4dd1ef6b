import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  media: { url: string; type: "image" | "video" }[];
  startIndex: number;
  onClose: () => void;
}

export default function ReviewMediaLightbox({ media, startIndex, onClose }: Props) {
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % media.length);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + media.length) % media.length);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [media.length, onClose]);

  const current = media[index];
  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/90 p-4 animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Review media"
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 rounded-full bg-background/90 p-2 text-foreground"
      >
        <X className="h-5 w-5" />
      </button>

      {media.length > 1 && (
        <>
          <button
            aria-label="Previous"
            onClick={(e) => { e.stopPropagation(); setIndex((i) => (i - 1 + media.length) % media.length); }}
            className="absolute left-3 rounded-full bg-background/90 p-2 text-foreground"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            aria-label="Next"
            onClick={(e) => { e.stopPropagation(); setIndex((i) => (i + 1) % media.length); }}
            className="absolute right-3 rounded-full bg-background/90 p-2 text-foreground"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      <div className="max-h-[85vh] max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
        {current.type === "video" ? (
          <video src={current.url} controls autoPlay playsInline className="max-h-[85vh] w-full rounded-xl bg-black" />
        ) : (
          <img src={current.url} alt="Customer review" className="max-h-[85vh] w-full rounded-xl object-contain" />
        )}
      </div>
    </div>
  );
}
