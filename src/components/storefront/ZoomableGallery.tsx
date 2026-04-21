import { useEffect, useRef, useState } from "react";
import { X, ZoomIn } from "lucide-react";
import { optimizeImageUrl } from "@/lib/imageOptimize";

interface Props {
  images: string[];
  initialIndex?: number;
  alt: string;
  open: boolean;
  onClose: () => void;
}

/** Fullscreen pinch/double-tap-to-zoom gallery overlay. Lazy-loaded — never in critical path. */
export default function ZoomableGallery({ images, initialIndex = 0, alt, open, onClose }: Props) {
  const [idx, setIdx] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setIdx(initialIndex); setZoom(1); }, [initialIndex, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx((i) => Math.min(i + 1, images.length - 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(i - 1, 0));
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, images.length, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-fade-in" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between px-4 h-12 text-white">
        <div className="text-[12px] font-semibold opacity-80">{idx + 1} / {images.length}</div>
        <button onClick={onClose} className="h-9 w-9 rounded-full flex items-center justify-center bg-white/10 active:bg-white/20" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center touch-pinch-zoom"
        onDoubleClick={() => setZoom((z) => (z === 1 ? 2.5 : 1))}
      >
        <img
          src={optimizeImageUrl(images[idx], 1600, 95)}
          alt={alt}
          className="max-h-full max-w-full object-contain transition-transform duration-200"
          style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
          draggable={false}
        />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-4 py-3 no-scrollbar">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => { setIdx(i); setZoom(1); }}
              className="shrink-0 h-14 w-14 rounded-lg overflow-hidden border-2"
              style={{ borderColor: i === idx ? "white" : "transparent" }}
            >
              <img src={optimizeImageUrl(img, 120, 70)} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
          <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{scrollbar-width:none}`}</style>
        </div>
      )}
      <div className="text-center text-white/60 text-[11px] pb-2">Double-tap to zoom · ESC to close</div>
    </div>
  );
}

/** Small inline zoom hint button. */
export function ZoomHint({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute top-3 right-3 z-10 h-9 w-9 rounded-full bg-white/90 backdrop-blur shadow flex items-center justify-center active:scale-95 transition"
      aria-label="Zoom"
    >
      <ZoomIn className="h-4.5 w-4.5 text-gray-800" strokeWidth={2.4} />
    </button>
  );
}
