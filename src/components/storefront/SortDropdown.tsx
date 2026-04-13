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
        className="inline-flex items-center gap-1.5 rounded-full bg-accent/60 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
        aria-label="Sort products"
      >
        <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
        <span>
          {OPTIONS.find((o) => o.value === value)?.label || "Popular"}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-40 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`block w-full px-3 py-2 text-left text-xs font-medium transition-colors ${
                value === opt.value
                  ? "bg-foreground/10 text-foreground font-bold"
                  : "text-foreground hover:bg-accent/60"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
