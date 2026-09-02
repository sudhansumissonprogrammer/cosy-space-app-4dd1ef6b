import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SortableHeadProps<T extends string> {
  label: string;
  /** sort value applied when the column is toggled to ascending */
  asc: T;
  /** sort value applied when the column is toggled to descending */
  desc: T;
  sort: T;
  onSort: (value: T) => void;
  className?: string;
}

/**
 * Clickable table column header for desktop data tables.
 * Toggles between the column's asc / desc sort values and shows the
 * active direction. Purely presentational — sorting itself is done by
 * whatever query the parent runs with the new sort value.
 */
export default function SortableHead<T extends string>({
  label, asc, desc, sort, onSort, className,
}: SortableHeadProps<T>) {
  const isAsc = sort === asc;
  const isDesc = sort === desc;
  const active = isAsc || isDesc;

  return (
    <button
      type="button"
      onClick={() => onSort(isAsc ? desc : asc)}
      aria-label={`Sort by ${label}`}
      aria-sort={isAsc ? "ascending" : isDesc ? "descending" : "none"}
      className={cn(
        "inline-flex items-center gap-1 -mx-1 px-1 py-0.5 rounded transition-colors hover:text-foreground",
        active ? "text-foreground font-medium" : "text-muted-foreground",
        className
      )}
    >
      {label}
      {isAsc ? (
        <ArrowUp className="h-3 w-3" />
      ) : isDesc ? (
        <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      )}
    </button>
  );
}
