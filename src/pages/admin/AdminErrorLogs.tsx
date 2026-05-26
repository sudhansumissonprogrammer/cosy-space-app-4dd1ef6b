import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, RefreshCw, Search, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface ErrorLog {
  id: string;
  created_at: string;
  level: string;
  message: string;
  context: string | null;
  stack: string | null;
  url: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
}

const levelColors: Record<string, string> = {
  error: "bg-red-100 text-red-800",
  warn: "bg-amber-100 text-amber-800",
  info: "bg-blue-100 text-blue-800",
};

export default function AdminErrorLogs() {
  useDocumentTitle("Error Logs · Admin");
  const [search, setSearch] = useState("");

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["admin-error-logs"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("error_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as ErrorLog[];
    },
  });

  const filtered = (logs ?? []).filter(
    (l) =>
      !search ||
      l.message.toLowerCase().includes(search.toLowerCase()) ||
      l.context?.toLowerCase().includes(search.toLowerCase()) ||
      l.url?.toLowerCase().includes(search.toLowerCase())
  );

  const errorCount = filtered.filter((l) => l.level === "error").length;
  const warnCount = filtered.filter((l) => l.level === "warn").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Error Logs</h1>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{errorCount}</p>
            <p className="text-xs text-muted-foreground">Errors</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{warnCount}</p>
            <p className="text-xs text-muted-foreground">Warnings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{filtered.length}</p>
            <p className="text-xs text-muted-foreground">Total (last 100)</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search errors by message, context, or URL..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Logs list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12">
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {search ? "No matching logs found" : "No error logs yet — that's great!"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => (
            <Card key={log.id} className="overflow-hidden">
              <CardContent className="p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="secondary" className={`text-[10px] shrink-0 ${levelColors[log.level] || ""}`}>
                      {log.level}
                    </Badge>
                    {log.context && (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {log.context}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground shrink-0">
                      {format(new Date(log.created_at), "MMM d, HH:mm:ss")}
                    </span>
                  </div>
                </div>
                <p className="text-sm font-medium text-foreground break-words">{log.message}</p>
                {log.url && (
                  <p className="text-[11px] text-muted-foreground truncate">URL: {log.url}</p>
                )}
                {log.stack && (
                  <details className="text-[11px]">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Stack trace
                    </summary>
                    <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted p-2 text-[10px] text-muted-foreground whitespace-pre-wrap">
                      {log.stack}
                    </pre>
                  </details>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
