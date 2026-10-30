import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Expand, X } from "lucide-react";
import { PACKAGING_OPTIONS, type PackagingKey, type PackagingOption } from "@/lib/packagingOptions";
import { formatPrice } from "@/lib/productUtils";
import complimentaryImg from "@/assets/packaging/complimentary.webp.asset.json";
import signatureImg from "@/assets/packaging/signature.webp.asset.json";

/** Default photos shipped with the app (merchant `images` prop overrides these). */
const DEFAULT_IMAGES: Partial<Record<PackagingKey, string>> = {
  complimentary: complimentaryImg.url,
  signature: signatureImg.url,
};

interface Props {
  /** Unit price of the product BEFORE any packaging surcharge. */
  basePrice: number;
  currency?: string;
  value: PackagingKey;
  onChange: (key: PackagingKey) => void;
  /** Optional per-option image URLs (merchant can add real photos later). */
  images?: Partial<Record<PackagingKey, string>>;
  options?: PackagingOption[];
}

export default function PackagingSelector({ basePrice, currency, value, onChange, images, options = PACKAGING_OPTIONS }: Props) {
  const [preview, setPreview] = useState<{ src: string; label: string } | null>(null);

  // Lock body scroll + close on Escape while the lightbox is open.
  useEffect(() => {
    if (!preview) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreview(null);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [preview]);

  return (
    <div className="mt-5" role="radiogroup" aria-label="Choose packaging">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Choose your packaging
      </p>

      <div className="space-y-2">
        {options.map((opt) => {
          const selected = value === opt.key;
          const img = images?.[opt.key] ?? DEFAULT_IMAGES[opt.key];
          return (
            <div
              key={opt.key}
              role="radio"
              tabIndex={opt.unavailable ? -1 : 0}
              aria-checked={selected}
              aria-disabled={opt.unavailable || undefined}
              onClick={() => { if (!opt.unavailable) onChange(opt.key); }}
              onKeyDown={(e) => {
                if (!opt.unavailable && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onChange(opt.key);
                }
              }}
              className={`flex w-full items-center gap-3 rounded-xl border-2 p-2.5 text-left transition-all duration-200 ${opt.unavailable ? "cursor-not-allowed opacity-60" : "cursor-pointer active:scale-[0.99]"} ${
                selected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              {/* radio */}
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  selected ? "border-primary bg-primary" : "border-muted-foreground/40"
                }`}
              >
                {selected && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
              </span>

              {/* thumbnail (square, tap to zoom) */}
              {img && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`View ${opt.label} photo`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreview({ src: img, label: opt.label });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      setPreview({ src: img, label: opt.label });
                    }
                  }}
                  className="relative block h-12 w-12 shrink-0 overflow-hidden bg-muted ring-1 ring-border"
                >
                  <img src={img} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  <span className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center bg-background/85">
                    <Expand className="h-2.5 w-2.5 text-foreground" strokeWidth={2.5} />
                  </span>
                </span>
              )}

              {/* label */}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-foreground sm:text-sm">
                  {opt.label}
                </span>
                {opt.note && (
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{opt.note}</span>
                )}
              </span>

              {/* price */}
              <span className="shrink-0 text-right">
                <span className="block text-[13px] font-extrabold text-foreground sm:text-sm">
                  {opt.unavailable ? "—" : formatPrice(basePrice + opt.surcharge, currency)}
                </span>
                {opt.surcharge > 0 && (
                  <span className="block text-[10px] font-semibold text-muted-foreground">
                    +{formatPrice(opt.surcharge, currency)}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* lightbox — portaled to <body> so it centers in the viewport on mobile */}
      {preview &&
        createPortal(
          <div
            className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/85 p-4"
            style={{ height: "100dvh" }}
            onClick={() => setPreview(null)}
            role="dialog"
            aria-modal="true"
            aria-label={preview.label}
          >
            <div
              className="relative w-full max-w-md overflow-hidden bg-card"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setPreview(null)}
                aria-label="Close"
                className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow"
              >
                <X className="h-4 w-4" />
              </button>
              <img
                src={preview.src}
                alt={preview.label}
                className="max-h-[72dvh] w-full object-contain"
              />
              <p className="px-3 py-2 text-sm font-bold text-foreground">{preview.label}</p>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
