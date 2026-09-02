import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Radio, Smartphone, Monitor, Tablet } from "lucide-react";

interface Props {
  storeId: string;
}

// "Live" = sessions with a heartbeat in the last 60 seconds (server-side window
// inside get_live_visitors). Heartbeats only fire while the shopper's tab is
// actually visible, so people who left drop off within ~1 minute instead of
// lingering for 5 minutes like the old pageview-window estimate did.
const POLL_MS = 15_000;

interface LiveData {
  active: number;
  mobile: number;
  desktop: number;
  tablet: number;
  top_pages: { path: string; count: number }[];
}

export default function LiveVisitors({ storeId }: Props) {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["dashboard-live-visitors", storeId],
    enabled: !!storeId,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
    queryFn: async (): Promise<LiveData> => {
      const { data, error } = await supabase.rpc("get_live_visitors", { _store_id: storeId });
      if (error) throw error;
      const d = (data || {}) as any;
      return {
        active: Number(d.active || 0),
        mobile: Number(d.mobile || 0),
        desktop: Number(d.desktop || 0),
        tablet: Number(d.tablet || 0),
        top_pages: Array.isArray(d.top_pages) ? d.top_pages : [],
      };
    },
  });

  // Poll while the dashboard tab is open and visible.
  useEffect(() => {
    if (!storeId) return;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      queryClient.invalidateQueries({ queryKey: ["dashboard-live-visitors", storeId] });
    }, POLL_MS);
    return () => clearInterval(id);
  }, [queryClient, storeId]);

  const activeSessions = data?.active ?? 0;
  const devices = {
    mobile: data?.mobile ?? 0,
    desktop: data?.desktop ?? 0,
    tablet: data?.tablet ?? 0,
  };
  const topPages = data?.top_pages ?? [];
  const isLive = activeSessions > 0;

  return (
    <Card className="border shadow-none overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="relative inline-flex h-2.5 w-2.5">
              <span className={`absolute inline-flex h-full w-full rounded-full ${isLive ? "bg-success animate-ping opacity-75" : "bg-muted"}`} />
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${isLive ? "bg-success" : "bg-muted-foreground/40"}`} />
            </span>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.1em]">
              Live visitors
            </p>
          </div>
          <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
            <Radio className="h-3 w-3" /> right now
          </span>
        </div>

        <div className="flex items-end gap-3 mb-3">
          <p className="text-4xl font-bold tabular-nums leading-none text-foreground">
            {activeSessions}
          </p>
          <p className="text-xs text-muted-foreground pb-1">
            {activeSessions === 1 ? "person browsing now" : "people browsing now"}
          </p>
        </div>

        {isLive && (
          <>
            <div className="flex items-center gap-3 mb-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Smartphone className="h-3 w-3" /> {devices.mobile}
              </span>
              <span className="inline-flex items-center gap-1">
                <Monitor className="h-3 w-3" /> {devices.desktop}
              </span>
              <span className="inline-flex items-center gap-1">
                <Tablet className="h-3 w-3" /> {devices.tablet}
              </span>
            </div>

            {topPages.length > 0 && (
              <div className="space-y-1.5 border-t pt-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Top pages right now
                </p>
                {topPages.map((p) => (
                  <div key={p.path} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-foreground font-medium">{p.path}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{p.count}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!isLive && (
          <p className="text-xs text-muted-foreground">
            No active visitors right now. Share your store link to drive traffic.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
