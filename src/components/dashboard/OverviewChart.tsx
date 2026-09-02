import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface MonthlyPoint {
  month: string;
  orders: number;
  revenue: number;
}

type Metric = "revenue" | "orders";
type Range = 3 | 6 | 12;

interface Props {
  data: MonthlyPoint[];
  currencySymbol: string;
  /** Rendered when there is no data at all. */
  emptyState?: React.ReactNode;
}

/**
 * Single chart card replacing the two separate Revenue / Orders charts on the
 * Overview page. Recharts lives only in this chunk so the dashboard shell no
 * longer pays for it on first paint.
 */
export default function OverviewChart({ data, currencySymbol, emptyState }: Props) {
  const [metric, setMetric] = useState<Metric>("revenue");
  const [range, setRange] = useState<Range>(6);

  const points = useMemo(() => data.slice(-range), [data, range]);

  const total = useMemo(
    () => points.reduce((sum, p) => sum + (metric === "revenue" ? p.revenue : p.orders), 0),
    [points, metric],
  );

  const metricTabs: { key: Metric; label: string }[] = [
    { key: "revenue", label: "Revenue" },
    { key: "orders", label: "Orders" },
  ];
  const rangeTabs: Range[] = [3, 6, 12];

  return (
    <Card className="border shadow-none">
      <CardContent className="space-y-3 p-3 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            className="inline-flex rounded-lg bg-muted p-0.5"
            role="tablist"
            aria-label="Chart metric"
          >
            {metricTabs.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={metric === t.key}
                onClick={() => setMetric(t.key)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  metric === t.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div
            className="inline-flex rounded-lg bg-muted p-0.5"
            role="tablist"
            aria-label="Chart date range"
          >
            {rangeTabs.map((r) => (
              <button
                key={r}
                role="tab"
                aria-selected={range === r}
                onClick={() => setRange(r)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
                  range === r ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                {r}M
              </button>
            ))}
          </div>
        </div>

        {points.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8">{emptyState}</div>
        ) : (
          <>
            <p className="text-xl font-bold tracking-tight text-foreground tabular-nums">
              {metric === "revenue"
                ? `${currencySymbol}${Math.round(total).toLocaleString()}`
                : total.toLocaleString()}
              <span className="ml-2 text-[11px] font-medium text-muted-foreground">
                last {range} months
              </span>
            </p>
            <div
              role="img"
              aria-label={`${metric === "revenue" ? "Revenue" : "Orders"} for the last ${range} months, total ${
                metric === "revenue" ? `${currencySymbol}${Math.round(total)}` : total
              }`}
            >
              <ResponsiveContainer width="100%" height={190}>
                {metric === "revenue" ? (
                  <LineChart data={points}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={44} />
                    <Tooltip
                      contentStyle={{ fontSize: 12 }}
                      formatter={(value: number) => `${currencySymbol}${value.toFixed(0)}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                ) : (
                  <BarChart data={points}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={34} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
