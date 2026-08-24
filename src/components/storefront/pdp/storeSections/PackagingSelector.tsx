import { useState } from "react";
import { Check, Expand, X } from "lucide-react";
import { PACKAGING_OPTIONS, type PackagingKey } from "@/lib/packagingOptions";
import { formatPrice } from "@/lib/productUtils";
import complimentaryImg from "@/assets/packaging/complimentary.webp.asset.json";
import signatureImg from "@/assets/packaging/signature.webp.asset.json";

/** Default photos shipped with the app (merchant `images` prop overrides these). */
const DEFAULT_IMAGES: Partial<Record<PackagingKey, string>> = {
  complimentary: complimentaryImg.url,
  signature: signatureImg.url,
};

const ICONS: Record<PackagingKey, typeof Gift> = {
  complimentary: Gift,
  signature: Package,
  brandkit: Sparkles,
};

interface Props {
  /** Unit price of the product BEFORE any packaging surcharge. */
  basePrice: number;
  currency?: string;
  value: PackagingKey;
  onChange: (key: PackagingKey) => void;
  /** Optional per-option image URLs (merchant can add real photos later). */
  images?: Partial<Record<PackagingKey, string>>;
}

export default function PackagingSelector({ basePrice, currency, value, onChange, images }: Props) {
  return (
    <div className="mt-5" role="radiogroup" aria-label="Choose packaging">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Choose your packaging
      </p>

      <div className="space-y-2">
        {PACKAGING_OPTIONS.map((opt) => {
          const selected = value === opt.key;
          const Icon = ICONS[opt.key];
          const img = images?.[opt.key] ?? DEFAULT_IMAGES[opt.key];
          return (
            <button
              key={opt.key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.key)}
              className={`flex w-full items-center gap-3 rounded-xl border-2 p-2.5 text-left transition-all duration-200 active:scale-[0.99] ${
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

              {/* thumbnail */}
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted ring-1 ring-border">
                {img ? (
                  <img src={img} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : (
                  <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                )}
              </span>

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
                  {formatPrice(basePrice + opt.surcharge, currency)}
                </span>
                {opt.surcharge > 0 && (
                  <span className="block text-[10px] font-semibold text-muted-foreground">
                    +{formatPrice(opt.surcharge, currency)}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
