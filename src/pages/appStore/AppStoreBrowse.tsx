import { useMemo, useState } from "react";
import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { APP_REGISTRY, type StoreAppMeta } from "@/lib/appStore/registry";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { CheckCircle2, Sparkles, LayoutGrid, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type CategoryFilter = "all" | "installed" | "engagement" | "conversion" | "retention";

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: "All apps",
  installed: "Installed",
  engagement: "Engagement",
  conversion: "Conversion",
  retention: "Retention",
};

export default function AppStoreBrowse() {
  const { storeId, storeSlug } = useStoreSlugParam();
  const [filter, setFilter] = useState<CategoryFilter>("all");

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

  const installedMap = useMemo(
    () => new Map((installed ?? []).map((r) => [r.app_id, r.enabled])),
    [installed]
  );

  const installedCount = installedMap.size;
  const liveCount = (installed ?? []).filter((r) => r.enabled).length;

  const filteredApps = useMemo(() => {
    if (filter === "all") return APP_REGISTRY;
    if (filter === "installed") return APP_REGISTRY.filter((a) => installedMap.has(a.id));
    return APP_REGISTRY.filter((a) => a.category === filter);
  }, [filter, installedMap]);

  return (
    <div className="mx-auto max-w-6xl pb-8">
      {/* Hero header */}
      <div className="border-b bg-gradient-to-br from-primary/5 via-background to-fuchsia-500/5 px-4 py-6 md:rounded-2xl md:border md:px-8 md:py-8">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-fuchsia-500 text-white shadow-sm">
            <LayoutGrid className="h-4.5 w-4.5" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight md:text-2xl">App Store</h1>
        </div>
        <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted-foreground md:text-sm">
          Add-ons that plug into your store — spin wheels, bundles, upsells, migrations & more. Install in seconds.
        </p>

        {/* Stat pills */}
        <div className="mt-4 flex gap-2">
          <StatPill label="Available" value={APP_REGISTRY.filter((a) => a.status !== "coming-soon").length} />
          <StatPill label="Installed" value={installedCount} accent="primary" />
          <StatPill label="Live" value={liveCount} accent="emerald" />
        </div>
      </div>

      {/* Filter chips */}
      <div className="sticky top-0 z-10 -mx-4 mt-4 border-b bg-background/95 px-4 py-2.5 backdrop-blur md:top-0 md:mx-0 md:rounded-xl md:border md:px-2 md:py-2 md:shadow-sm">
        <div className="scrollbar-none flex gap-1.5 overflow-x-auto">
          {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map((k) => {
            const active = filter === k;
            const count =
              k === "all"
                ? APP_REGISTRY.length
                : k === "installed"
                  ? installedCount
                  : APP_REGISTRY.filter((a) => a.category === k).length;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                )}
              >
                {CATEGORY_LABELS[k]}
                <span className={cn("text-[10px] opacity-70", active && "opacity-90")}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Apps list */}
      <div className="mt-3 grid grid-cols-1 gap-2.5 px-0 md:mt-4 md:grid-cols-2 md:gap-3 md:px-0 lg:grid-cols-3">
        {filteredApps.map((app) => (
          <AppCard
            key={app.id}
            app={app}
            installed={installedMap.has(app.id)}
            enabled={installedMap.get(app.id)}
            storeSlug={storeSlug}
          />
        ))}
      </div>

      {filteredApps.length === 0 && (
        <div className="mt-10 flex flex-col items-center gap-2 py-8 text-center">
          <Sparkles className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No apps in this category yet.</p>
        </div>
      )}
    </div>
  );
}

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "primary" | "emerald";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card/70 px-3 py-1.5 backdrop-blur",
        accent === "primary" && "border-primary/30 bg-primary/5",
        accent === "emerald" && "border-emerald-500/30 bg-emerald-500/5"
      )}
    >
      <p
        className={cn(
          "text-lg font-extrabold leading-none",
          accent === "primary" && "text-primary",
          accent === "emerald" && "text-emerald-600"
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function AppCard({
  app,
  installed,
  enabled,
  storeSlug,
}: {
  app: StoreAppMeta;
  installed: boolean;
  enabled: boolean | undefined;
  storeSlug?: string;
}) {
  const Icon = app.icon;
  const comingSoon = app.status === "coming-soon";
  const href = storeSlug ? `/dashboard/stores/${storeSlug}/apps/${app.id}` : "#";

  const Wrapper: any = comingSoon ? "div" : Link;
  const wrapperProps = comingSoon ? {} : { to: href };

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        "group relative flex items-stretch gap-3 overflow-hidden rounded-2xl border bg-card p-3 transition-all",
        comingSoon
          ? "cursor-not-allowed opacity-60"
          : "hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
      )}
    >
      {/* Icon block */}
      <div
        className={cn(
          "relative flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm md:h-[68px] md:w-[68px]",
          app.accent
        )}
      >
        <Icon className="h-7 w-7" strokeWidth={1.8} />
      </div>

      {/* Text */}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-[14px] font-bold leading-tight">{app.name}</h3>
            {!comingSoon && (
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
            )}
          </div>
          <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-muted-foreground">
            {app.tagline}
          </p>
        </div>

        {/* Status row */}
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {comingSoon ? (
            <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-semibold">
              Coming soon
            </Badge>
          ) : installed ? (
            <>
              <Badge className="h-4 gap-0.5 bg-emerald-500 px-1.5 text-[9px] font-semibold text-white hover:bg-emerald-500">
                <CheckCircle2 className="h-2.5 w-2.5" /> Installed
              </Badge>
              {enabled === false && (
                <Badge variant="outline" className="h-4 px-1.5 text-[9px]">
                  Disabled
                </Badge>
              )}
              {enabled && (
                <Badge variant="outline" className="h-4 border-emerald-500/40 px-1.5 text-[9px] text-emerald-600">
                  Live
                </Badge>
              )}
            </>
          ) : (
            <>
              {app.status === "beta" && (
                <Badge className="h-4 bg-amber-500 px-1.5 text-[9px] font-semibold text-white hover:bg-amber-500">
                  Beta
                </Badge>
              )}
              <span className="text-[10.5px] font-semibold text-primary">Install →</span>
            </>
          )}
        </div>
      </div>
    </Wrapper>
  );
}
