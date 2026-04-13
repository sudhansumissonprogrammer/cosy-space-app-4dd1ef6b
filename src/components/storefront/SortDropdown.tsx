import { useState } from "react";
import { ArrowUpDown } from "lucide-react";

type SortValue = "popular" | "price_asc" | "price_desc" | "newest";

interface SortDropdownProps {
  value: SortValue;
  onChange: (value: SortValue) => void;
}

const OPTIONS: { value: SortValue; label: string }[] = [
  { value: "popular", label: "Popular" },
  { value: "price_asc", label: "Price: Low → High" },
  { value: "price_desc", label: "Price: High → Low" },
  { value: "newest", label: "Newest First" },
];

/** Shared sort dropdown used across multiple home pages */
export default function SortDropdown({ value, onChange }: SortDropdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors" style={{ backgroundColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 6%, transparent)", color: "var(--storefront-text, hsl(var(--foreground)))" }}
        aria-label="Sort products"
      >
        <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
        <span>
          {OPTIONS.find((o) => o.value === value)?.label || "Popular"}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-40 overflow-hidden rounded-xl shadow-lg" style={{ border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 12%, transparent)", backgroundColor: "var(--storefront-bg, hsl(var(--popover)))" }}>
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="block w-full px-3 py-2 text-left text-xs font-medium transition-colors"
              style={{
                backgroundColor: value === opt.value ? "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 8%, transparent)" : undefined,
                color: "var(--storefront-text, hsl(var(--foreground)))",
                fontWeight: value === opt.value ? 700 : 500,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
