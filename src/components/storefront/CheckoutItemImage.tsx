import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Expand, Package, X } from "lucide-react";
import signatureImg from "@/assets/packaging/signature.webp.asset.json";

interface CheckoutItemImageProps {
  image?: string | null;
  name: string;
  meta?: Record<string, unknown> | null;
  className?: string;
}

type Preview = { src: string; label: string };

/** Clickable checkout thumbnail, with a peeking packaging photo when selected. */
export default function CheckoutItemImage({ image, name, meta, className = "h-14 w-14" }: CheckoutItemImageProps) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const packaging = typeof meta?.packaging === "string" ? meta.packaging : null;
  const packagingLabel = typeof meta?.packaging_label === "string" ? meta.packaging_label : "Packaging";
  const packagingImage = packaging === "signature" ? signatureImg.url : null;

  useEffect(() => {
    if (!preview) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreview(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [preview]);

  const open = (src: string, label: string) => setPreview({ src, label });

  return (
    <>
      <div className={`relative shrink-0 ${packagingImage ? "mr-2 mb-2" : ""} ${className}`}>
        {packagingImage && (
          <button
            type="button"
            onClick={() => open(packagingImage, packagingLabel)}
            className="absolute -bottom-2 -right-2 z-0 h-[76%] w-[76%] overflow-hidden rounded-md border-2 border-background bg-muted shadow-sm"
            aria-label={`View ${packagingLabel} photo`}
          >
            <img src={packagingImage} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          </button>
        )}

        {image ? (
          <button
            type="button"
            onClick={() => open(image, name)}
            className="relative z-10 block h-full w-full overflow-hidden rounded-lg border bg-muted text-left shadow-sm"
            aria-label={`View ${name} photo`}
          >
            <img src={image} alt={name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
            <span className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-tl bg-background/90 shadow-sm" aria-hidden>
              <Expand className="h-2.5 w-2.5 text-foreground" strokeWidth={2.5} />
            </span>
          </button>
        ) : (
          <div className="relative z-10 flex h-full w-full items-center justify-center rounded-lg border bg-muted">
            <Package className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>

      {preview && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-foreground/85 p-4"
          onClick={() => setPreview(null)}
          role="dialog"
          aria-modal="true"
          aria-label={preview.label}
        >
          <div className="relative w-full max-w-md overflow-hidden rounded-lg bg-card shadow-xl" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreview(null)}
              aria-label="Close photo"
              className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow"
            >
              <X className="h-4 w-4" />
            </button>
            <img src={preview.src} alt={preview.label} className="max-h-[78dvh] w-full object-contain" />
            <p className="px-3 py-2.5 text-sm font-bold text-foreground">{preview.label}</p>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}