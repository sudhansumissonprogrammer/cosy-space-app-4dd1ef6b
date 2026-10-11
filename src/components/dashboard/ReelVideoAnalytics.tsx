import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  storeId?: string;
  rangeStart: Date;
  rangeEnd: Date;
  visitors: number;
}

interface ReelRow { reel_id: string; title: string | null; position: number; viewers: number; avg_seconds: number; full_views: number; views: number }
interface ReelData {
  bubble_viewers: number; openers: number; opens: number; watchers: number;
  multi_reel_viewers: number; full_watchers: number; avg_seconds_per_viewer: number;
  total_seconds: number; buckets: { lt3: number; s3_10: number; s10_30: number; gte30: number };
  reels: ReelRow[];
}

const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : "—");

export default function ReelVideoAnalytics({ storeId, rangeStart, rangeEnd, visitors }: Props) {
  const { data } = useQuery({
    queryKey: ["reel-analytics", storeId, rangeStart.toISOString().slice(0, 13), rangeEnd.toISOString().slice(0, 13)],
    enabled: !!storeId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_reel_analytics", {
        _store_id: storeId, _range_start: rangeStart.toISOString(), _range_end: rangeEnd.toISOString(),
      });
      if (error) throw error;
      return data as ReelData;
    },
  });

  const d = data;
  const stats: { label: string; value: string | number; sub?: string }[] = [
    { label: "Visitors", value: visitors },
    { label: "Saw video bubble", value: d?.bubble_viewers ?? 0, sub: pct(d?.bubble_viewers ?? 0, visitors) },
    { label: "Tapped to open", value: d?.openers ?? 0, sub: `${pct(d?.openers ?? 0, visitors)} of visitors` },
    { label: "Watched a video", value: d?.watchers ?? 0 },
    { label: "Watched 2+ videos", value: d?.multi_reel_viewers ?? 0, sub: pct(d?.multi_reel_viewers ?? 0, d?.watchers ?? 0) },
    { label: "Watched full video", value: d?.full_watchers ?? 0, sub: pct(d?.full_watchers ?? 0, d?.watchers ?? 0) },
    { label: "Avg watch / person", value: `${d?.avg_seconds_per_viewer ?? 0}s` },
    { label: "Total watch time", value: `${Math.round((d?.total_seconds ?? 0) / 60)} min` },
  ];
  const b = d?.buckets;

  return (
    <Card className="border shadow-none">
      <CardHeader className="p-3 pb-0">
        <CardTitle className="text-sm font-medium">Video Reels</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-3 pt-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border p-2">
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
              <p className="text-lg font-semibold text-foreground">{s.value}</p>
              {s.sub && <p className="text-[11px] text-muted-foreground">{s.sub}</p>}
            </div>
          ))}
        </div>
        {b && (
          <div>
            <p className="mb-1 text-xs font-medium text-foreground">How long each video was watched</p>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {[["Under 3s", b.lt3], ["3–10s", b.s3_10], ["10–30s", b.s10_30], ["30s+", b.gte30]].map(([l, n]) => (
                <div key={l as string} className="rounded-md bg-muted p-1.5">
                  <p className="text-muted-foreground">{l}</p>
                  <p className="font-semibold text-foreground">{n}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {d?.reels?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr><th className="py-1 text-left">Video</th><th>People</th><th>Avg</th><th>Full views</th></tr>
              </thead>
              <tbody>
                {d.reels.map((r) => (
                  <tr key={r.reel_id} className="border-t">
                    <td className="py-1 text-left">{r.title || `Video #${r.position}`}</td>
                    <td className="text-center">{r.viewers}</td>
                    <td className="text-center">{r.avg_seconds}s</td>
                    <td className="text-center">{r.full_views}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No video views recorded in this period yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
