import { useEffect, useState } from "react";
import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { PlayCircle, Loader2, Smartphone, Gauge, VideoOff } from "lucide-react";
import { getApp } from "@/lib/appStore/registry";
import { AppConfigShell, AppLiveBadge } from "@/components/appStore/AppConfigShell";

const APP_ID = "card-video";

export default function CardVideoConfig() {
  const { storeId, storeSlug } = useStoreSlugParam();
  const qc = useQueryClient();
  const appMeta = getApp(APP_ID)!;

  const { data: row, isLoading } = useQuery({
    queryKey: ["store-app", storeId, APP_ID],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_apps")
        .select("*")
        .eq("store_id", storeId!)
        .eq("app_id", APP_ID)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: videoCount } = useQuery({
    queryKey: ["card-video-count", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId!)
        .eq("is_active", true)
        .not("video_url", "is", null);
      if (error) throw error;
      return count || 0;
    },
  });

  // Default ON: the add-on runs for every store until a merchant switches it
  // off, so a missing store_apps row means "enabled".
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(row ? !!row.enabled : true);
  }, [row?.id, row?.enabled]);

  const save = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await (supabase as any)
        .from("store_apps")
        .upsert(
          { store_id: storeId!, app_id: APP_ID, enabled: next, config: {} },
          { onConflict: "store_id,app_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-app", storeId, APP_ID] });
      qc.invalidateQueries({ queryKey: ["store-enabled-apps"] });
      qc.invalidateQueries({ queryKey: ["store-disabled-apps"] });
      toast.success("Saved");
    },
    onError: (e: any) => toast.error(e?.message || "Could not save"),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AppConfigShell
      storeSlug={storeSlug}
      icon={<PlayCircle className="h-4.5 w-4.5" />}
      accent={appMeta.accent}
      title={appMeta.name}
      subtitle={appMeta.tagline}
      enabled={enabled}
      onEnabledChange={(v) => {
        // Persist immediately — a toggle that only lives in local state looks
        // "on" until the next refresh, then silently reverts.
        setEnabled(v);
        save.mutate(v);
      }}
      onSave={() => save.mutate(enabled)}
      saving={save.isPending}
      statusBadge={<AppLiveBadge enabled={row ? !!row.enabled : true} />}
    >
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-4 md:px-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px]">How it behaves</CardTitle>
            <CardDescription className="text-[12px]">
              Nothing to configure — it is intentionally automatic and safe.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-[13px] text-muted-foreground">
            <div className="flex gap-2.5">
              <PlayCircle className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
              <p>
                Product cards that have a video play it silently while on screen. Only one video
                plays at a time, so data usage stays low.
              </p>
            </div>
            <div className="flex gap-2.5">
              <VideoOff className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
              <p>Products without a video look and behave exactly as they do today.</p>
            </div>
            <div className="flex gap-2.5">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
              <p>Mobile only. Desktop shoppers keep the normal image cards.</p>
            </div>
            <div className="flex gap-2.5">
              <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
              <p>
                Videos are never downloaded until they actually start playing, so home and category
                page load speed is unchanged. Automatically skipped on data-saver and slow (2G/3G)
                connections.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px]">Eligible products</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{videoCount ?? "—"}</p>
            <p className="text-[12px] text-muted-foreground">
              active products currently have a video uploaded.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppConfigShell>
  );
}
