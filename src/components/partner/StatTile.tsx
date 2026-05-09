import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useCountUp } from "@/hooks/useCountUp";
import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: string; // tailwind text color class
  prefix?: string;
  sub?: string;
  animated?: boolean;
}

export function StatTile({ label, value, icon: Icon, tone = "text-primary", prefix, sub, animated = true }: StatTileProps) {
  const numeric = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, "")) || 0;
  const counted = useCountUp(animated ? numeric : 0);
  const display = animated && typeof value === "number"
    ? counted.toLocaleString("en-IN")
    : typeof value === "string" ? value : value.toLocaleString("en-IN");

  return (
    <Card className="shrink-0 min-w-[140px] border shadow-none rounded-2xl">
      <div className="flex items-center gap-2.5 p-3">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/50", tone)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-base font-bold tabular-nums tracking-tight text-foreground truncate">
            {prefix}{display}
          </p>
          {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
        </div>
      </div>
    </Card>
  );
}
