import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import SortableHead from "./SortableHead";

/**
 * Shared desktop data-table primitives.
 *
 * Purely presentational wrappers around the shadcn table so every dashboard
 * list gets the same card shell, row affordances (clickable / selected /
 * active), stop-propagation cells and empty state — without forcing each page
 * into a single generic column-config API.
 */

/** Card shell + horizontal scroll container for a desktop table. */
export function DataTableCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="p-0">
        <div className="w-full overflow-x-auto">{children}</div>
      </CardContent>
    </Card>
  );
}

interface DataTableRowProps extends React.ComponentPropsWithoutRef<typeof TableRow> {
  /** Row opens a detail view / navigates when clicked. */
  clickable?: boolean;
  /** Row is checked in bulk-select mode. */
  selected?: boolean;
  /** Row's detail panel is currently open. */
  active?: boolean;
}

/**
 * Table row with consistent click affordance and highlight states.
 * Also supports keyboard activation (Enter / Space) when clickable.
 */
export function DataTableRow({
  clickable,
  selected,
  active,
  className,
  onClick,
  onKeyDown,
  ...props
}: DataTableRowProps) {
  return (
    <TableRow
      {...props}
      onClick={onClick}
      tabIndex={clickable ? 0 : undefined}
      role={clickable ? "button" : undefined}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (!clickable || e.defaultPrevented) return;
        if (e.key === "Enter" || e.key === " ") {
          if (e.target !== e.currentTarget) return;
          e.preventDefault();
          (onClick as any)?.(e);
        }
      }}
      className={cn(
        clickable && "cursor-pointer transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        selected && "bg-primary/5",
        active && "bg-primary/10",
        className,
      )}
    />
  );
}

/**
 * Cell whose interactive content (checkbox, dropdown, buttons) must not
 * trigger the row's own click handler.
 */
export function DataTableActionCell({
  className,
  onClick,
  ...props
}: React.ComponentPropsWithoutRef<typeof TableCell>) {
  return (
    <TableCell
      {...props}
      className={className}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
    />
  );
}

/** Full-width empty row inside a table body. */
export function DataTableEmpty({
  colSpan,
  icon,
  title,
  description,
}: {
  colSpan: number;
  icon?: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-12 text-center">
        {icon && <div className="mb-3 flex justify-center text-muted-foreground">{icon}</div>}
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </TableCell>
    </TableRow>
  );
}

export {
  Table as DataTable,
  TableBody as DataTableBody,
  TableCell as DataTableCell,
  TableHead as DataTableHead,
  TableHeader as DataTableHeader,
  SortableHead,
};
