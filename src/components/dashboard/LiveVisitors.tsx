import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Radio, Smartphone, Monitor, Tablet } from "lucide-react";

interface Props {
  storeId: string;
}

// "Live" = unique sessions with a pageview in the last 5 minutes.
// Matches GA4 Realtime / Plausible / Shopify Live View semantics.
const LIVE_WINDOW_MS = 5 * 60 * 1000;
const POLL_MS = 15_000;

interface Row {
  session_id: string | null;
  visitor_id: string | null;
  path: string | null;
  device: string | null;
  created_at: string;
}

export default function LiveVisitors({ storeId }: Props) {
  const queryClient = useQueryClient();
  const [tick, setTick] = useState(0);

  const sinceIso = useMemo(() => {
    void tick; // re-derive on tick so window slides forward
    return new Date(Date.now() - LIVE_WINDOW_MS).toISOString();
  }, [tick]);

  const { data } = useQuery({
    queryKey: ["live-visitors", storeId, sinceIso],
    enabled: !!storeId,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("page_views")
        .select("session_id, visitor_id, path, device, created_at")
        .eq("store_id", storeId)
        .eq("is_bot", false)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as Row[];
    },
  });

  // Slide the 5-min window every 30s so stale sessions drop out
  // even when no new inserts arrive.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Realtime: nudge a refetch the moment a new pageview lands.
  useEffect(() => {
    if (!storeId) return;
    const channel = supabase
      .channel(`live-visitors-${storeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "page_views",
          filter: `store_id=eq.${storeId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["live-visitors", storeId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, queryClient]);

  const rows = data || [];

  // Unique active sessions in window
  const activeSessions = useMemo(() => {
    const seen = new Set<string>();
    for (const r of rows) {
      const key = r.session_id || r.visitor_id;
      if (key) seen.add(key);
    }
    return seen.size;
  }, [rows]);

  // Top pages right now
  const topPages = useMemo(() => {
    const counts = new Map<string, Set<string>>();
    for (const r of rows) {
      const p = r.path || "/";
      const key = r.session_id || r.visitor_id || "anon";
      if (!counts.has(p)) counts.set(p, new Set());
      counts.get(p)!.add(key);
    }
    return Array.from(counts.entries())
      .map(([path, set]) => ({ path, count: set.size }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [rows]);

  // Device split (unique sessions)
  const devices = useMemo(() => {
    const map: Record<string, Set<string>> = { mobile: new Set(), desktop: new Set(), tablet: new Set() };
    for (const r of rows) {
      const d = (r.device || "desktop").toLowerCase();
      const key = r.session_id || r.visitor_id || "anon";
      if (map[d]) map[d].add(key);
      else (map.desktop ||= new Set()).add(key);
    }
    return { mobile: map.mobile.size, desktop: map.desktop.size, tablet: map.tablet.size };
  }, [rows]);

  const isLive = activeSessions > 0;

  return (
    <Card className="border shadow-none overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="relative inline-flex h-2.5 w-2.5">
              <span className={`absolute inline-flex h-full w-full rounded-full ${isLive ? "bg-emerald-500 animate-ping opacity-75" : "bg-muted"}`} />
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${isLive ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
            </span>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.1em]">
              Live visitors
            </p>
          </div>
          <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
            <Radio className="h-3 w-3" /> last 5 min
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
