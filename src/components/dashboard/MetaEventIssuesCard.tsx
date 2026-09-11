import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

type ErrRow = {
  id: string;
  event_name: string | null;
  source: string | null;
  http_status: number | null;
  meta_code: number | null;
  meta_message: string | null;
  created_at: string;
};

/**
 * Plain-language explanation for the codes Meta actually returns.
 * Store owners should never have to read a raw Graph API error string.
 */
function explain(row: ErrRow): { title: string; fix: string } {
  const code = row.meta_code;
  const msg = (row.meta_message || "").toLowerCase();

  if (code === 190 || msg.includes("access token")) {
    return {
      title: "Your Meta access token is expired or invalid",
      fix: "Generate a new token in Meta Events Manager and paste it below, then save.",
    };
  }
  if (code === 100 && msg.includes("pixel")) {
    return {
      title: "Meta does not recognise this Pixel ID",
      fix: "Check the Pixel ID below matches the dataset in Events Manager.",
    };
  }
  if (code === 100) {
    return {
      title: "Meta rejected the details sent with this event",
      fix: "Usually a temporary mismatch. If it keeps repeating, re-run the setup wizard.",
    };
  }
  if (code === 200 || code === 803 || msg.includes("permission")) {
    return {
      title: "This token is not allowed to send events for this Pixel",
      fix: "In Events Manager, make sure the token was created for this same dataset.",
    };
  }
  if (row.http_status && row.http_status >= 500) {
    return {
      title: "Meta's servers were temporarily unavailable",
      fix: "Nothing to do — we retry automatically.",
    };
  }
  return {
    title: "Meta refused this event",
    fix: row.meta_message ? row.meta_message.slice(0, 140) : "Try again later.",
  };
}

function ago(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function MetaEventIssuesCard({ storeId }: { storeId?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["meta-capi-errors", storeId],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 86400_000).toISOString();
      const { data, error } = await supabase
        .from("meta_capi_errors")
        .select("id, event_name, source, http_status, meta_code, meta_message, created_at")
        .eq("store_id", storeId!)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as ErrRow[];
    },
    enabled: !!storeId,
    staleTime: 60_000,
  });

  if (isLoading || !storeId) return null;

  const rows = data || [];

  // Group identical problems so one bad token doesn't fill the screen.
  const groups = new Map<string, { title: string; fix: string; count: number; last: string; events: Set<string> }>();
  for (const row of rows) {
    const { title, fix } = explain(row);
    const g = groups.get(title) || { title, fix, count: 0, last: row.created_at, events: new Set<string>() };
    g.count++;
    if (new Date(row.created_at) > new Date(g.last)) g.last = row.created_at;
    for (const name of String(row.event_name || "").split(",")) {
      if (name.trim()) g.events.add(name.trim());
    }
    groups.set(title, g);
  }
  const list = [...groups.values()].sort((a, b) => b.count - a.count);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {list.length ? (
            <AlertTriangle className="h-5 w-5 text-warning" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-success" />
          )}
          Tracking issues
        </CardTitle>
        <CardDescription>Anything Meta refused in the last 7 days</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {!list.length && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
            No problems — Meta accepted every event we sent.
          </div>
        )}
        {list.map((g) => (
          <div key={g.title} className="rounded-lg border p-3 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">{g.title}</p>
              <Badge variant="secondary" className="shrink-0 text-[11px]">
                {g.count}x
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{g.fix}</p>
            <p className="text-[11px] text-muted-foreground">
              {g.events.size ? `${[...g.events].slice(0, 4).join(", ")} · ` : ""}
              last {ago(g.last)}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
