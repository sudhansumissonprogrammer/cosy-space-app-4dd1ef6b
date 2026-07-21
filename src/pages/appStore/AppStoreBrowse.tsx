import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { APP_REGISTRY } from "@/lib/appStore/registry";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { CheckCircle2, Settings } from "lucide-react";

export default function AppStoreBrowse() {
  const { storeId, storeSlug } = useStoreSlugParam();

  const { data: installed } = useQuery({
    queryKey: ["store-apps", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_apps")
        .select("app_id, enabled")
        .eq("store_id", storeId!);
      if (error) throw error;
      return (data ?? []) as { app_id: string; enabled: boolean }[];
    },
  });

  const installedMap = new Map((installed ?? []).map((r) => [r.app_id, r.enabled]));

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">App Store</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add-ons to grow your store — install, configure, and launch in minutes.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {APP_REGISTRY.map((app) => {
          const isInstalled = installedMap.has(app.id);
          const enabled = installedMap.get(app.id);
          const Icon = app.icon;
          const comingSoon = app.status === "coming-soon";
          return (
            <Card key={app.id} className="overflow-hidden group hover:shadow-lg transition-shadow">
              <div className={`h-24 bg-gradient-to-br ${app.accent} relative`}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Icon className="h-10 w-10 text-white/95" strokeWidth={1.8} />
                </div>
                {isInstalled && (
                  <Badge className="absolute top-2 right-2 bg-white/90 text-slate-900 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Installed
                  </Badge>
                )}
                {comingSoon && (
                  <Badge variant="secondary" className="absolute top-2 right-2">Coming soon</Badge>
                )}
                {app.status === "beta" && (
                  <Badge className="absolute top-2 right-2 bg-amber-500">Beta</Badge>
                )}
              </div>
              <CardContent className="p-4">
                <h3 className="font-bold">{app.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{app.tagline}</p>
                <p className="mt-2 text-[11px] text-muted-foreground/80 line-clamp-3">{app.description}</p>

                <div className="mt-4 flex items-center gap-2">
                  {comingSoon ? (
                    <Button disabled variant="outline" className="w-full" size="sm">Coming soon</Button>
                  ) : isInstalled ? (
                    <>
                      <Button asChild variant="default" size="sm" className="flex-1 gap-1">
                        <Link to={`/dashboard/stores/${storeSlug}/apps/${app.id}`}>
                          <Settings className="h-3.5 w-3.5" /> Manage
                        </Link>
                      </Button>
                      {enabled === false && (
                        <Badge variant="outline" className="text-[10px]">Disabled</Badge>
                      )}
                    </>
                  ) : (
                    <Button asChild variant="default" size="sm" className="w-full">
                      <Link to={`/dashboard/stores/${storeSlug}/apps/${app.id}`}>Install</Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
