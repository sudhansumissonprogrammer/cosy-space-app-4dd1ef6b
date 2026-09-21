import { useEffect, useMemo, useState } from "react";
import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  CheckCircle2,
  DownloadCloud,
  Loader2,
  ShoppingBag,
  Store,
  Package,
  Users,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { AppConfigShell } from "@/components/appStore/AppConfigShell";

type Platform =
  "shopify" | "woocommerce" | "dukaan" | "bigcommerce" | "magento" | "generic";

interface JobRow {
  id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  source_platform: Platform | "shopify-public";
  source_url: string;
  entities: string[];
  progress: any;
  error_log: any[];
  created_at: string;
  completed_at: string | null;
  discovered_counts?: Record<string, number>;
}

const PLATFORMS: {
  id: Platform;
  name: string;
  supported: boolean;
  description: string;
}[] = [
  {
    id: "shopify",
    name: "Shopify",
    supported: true,
    description:
      "Products, images, variants, SEO. Uses Admin API access token.",
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    supported: true,
    description:
      "Products, images, prices via REST API (consumer key + secret).",
  },
  {
    id: "dukaan",
    name: "Dukaan",
    supported: true,
    description:
      "Auto-discover via sitemap + product page scrape. No credentials needed.",
  },
  {
    id: "generic",
    name: "Other / Custom store",
    supported: true,
    description:
      "Any store with a sitemap — Shopdeck, custom-coded, WordPress etc.",
  },
  {
    id: "bigcommerce",
    name: "BigCommerce",
    supported: false,
    description: "Coming soon.",
  },
  {
    id: "magento",
    name: "Magento 2",
    supported: false,
    description: "Coming soon.",
  },
];

const ENTITIES = [
  { id: "products", label: "Products", icon: Package, defaultOn: true },
  {
    id: "categories",
    label: "Categories / Collections",
    icon: ShoppingBag,
    defaultOn: true,
  },
  { id: "customers", label: "Customers", icon: Users, defaultOn: false },
  { id: "orders", label: "Order history", icon: Clock, defaultOn: false },
];

export default function MigrationConfig() {
  const { storeId, storeSlug, store } = useStoreSlugParam();
  const qc = useQueryClient();

  const [step, setStep] = useState(1);
  const [platform, setPlatform] = useState<Platform>("shopify");
  const [sourceUrl, setSourceUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [selectedEntities, setSelectedEntities] = useState<string[]>(
    ENTITIES.filter((e) => e.defaultOn).map((e) => e.id),
  );
  const [detecting, setDetecting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const { data: history } = useQuery({
    queryKey: ["migration-jobs", storeId],
    enabled: !!storeId,
    refetchInterval: activeJobId ? 3000 : false,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("migration_jobs")
        .select(
          "id,status,source_platform,source_url,entities,progress,discovered_counts,error_log,created_at,completed_at",
        )
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as JobRow[];
    },
  });

  useEffect(() => {
    if (!history?.length) return;
    const running = history.find(
      (j) => j.status === "running" || j.status === "pending",
    );
    if (running && !activeJobId) setActiveJobId(running.id);
  }, [history, activeJobId]);

  const activeJob = useMemo(
    () => history?.find((j) => j.id === activeJobId) ?? null,
    [history, activeJobId],
  );

  useEffect(() => {
    if (
      activeJob &&
      (activeJob.status === "completed" ||
        activeJob.status === "failed" ||
        activeJob.status === "cancelled")
    ) {
      qc.invalidateQueries({ queryKey: ["migration-jobs", storeId] });
    }
  }, [activeJob?.status, storeId, qc]);

  function buildCredentials(): Record<string, string> {
    if (platform === "shopify") return { access_token: accessToken.trim() };
    if (platform === "woocommerce")
      return {
        consumer_key: consumerKey.trim(),
        consumer_secret: consumerSecret.trim(),
      };
    return {};
  }

  async function handleDetect() {
    if (!sourceUrl.trim()) return toast.error("Enter your store URL");
    if (platform === "shopify" && !accessToken.trim())
      return toast.error("Enter your Shopify Admin access token");
    if (
      platform === "woocommerce" &&
      (!consumerKey.trim() || !consumerSecret.trim())
    ) {
      return toast.error("Enter your WooCommerce consumer key and secret");
    }
    setDetecting(true);
    setCounts(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "migration-detect",
        {
          body: {
            platform,
            source_url: sourceUrl.trim(),
            credentials: buildCredentials(),
          },
        },
      );
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setCounts((data as any).counts);
      toast.success("Connection successful");
      setStep(3);
    } catch (err: any) {
      toast.error(err?.message || "Could not connect");
    } finally {
      setDetecting(false);
    }
  }

  async function handleCancel() {
    if (!activeJobId) return;
    const { data, error } = await (supabase as any).rpc(
      "cancel_own_migration",
      { _job_id: activeJobId },
    );
    if (error || !data)
      return toast.error(error?.message || "Could not cancel migration");
    toast.success("Migration cancelled");
    await qc.invalidateQueries({ queryKey: ["migration-jobs", storeId] });
  }

  async function handleStart() {
    if (!storeId) return;
    setStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "migration-start",
        {
          body: {
            store_id: storeId,
            platform,
            source_url: sourceUrl.trim(),
            credentials: buildCredentials(),
            entities: selectedEntities,
          },
        },
      );
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const jobId = (data as any).job_id as string;
      setActiveJobId(jobId);
      toast.success("Migration started");
      setStep(4);
      qc.invalidateQueries({ queryKey: ["migration-jobs", storeId] });
    } catch (err: any) {
      toast.error(err?.message || "Could not start migration");
    } finally {
      setStarting(false);
    }
  }

  const productCount =
    counts?.products ?? activeJob?.discovered_counts?.products ?? 0;
  const productsDone = Number(activeJob?.progress?.products?.done ?? 0);
  const productsFailed = Number(activeJob?.progress?.products?.failed ?? 0);
  const productsTotal = Math.max(productCount, productsDone + productsFailed);
  const pct =
    productsTotal > 0
      ? Math.min(
          100,
          Math.round(((productsDone + productsFailed) / productsTotal) * 100),
        )
      : activeJob?.status === "running"
        ? 8
        : 0;

  if (!storeId) {
    return (
      <div className="p-8 text-sm text-muted-foreground">Loading store…</div>
    );
  }

  return (
    <AppConfigShell
      storeSlug={storeSlug}
      icon={<DownloadCloud className="h-4.5 w-4.5" />}
      accent="from-sky-500 to-indigo-600"
      title="Migrate My Store"
      subtitle={`Import into ${store?.name ?? storeSlug}`}
    >
      <div className="px-4 md:px-0">
        <ol className="scrollbar-none flex items-center gap-1.5 overflow-x-auto text-[11px] font-semibold">
          {["Platform", "Connect", "Select", "Run"].map((label, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <li
                key={label}
                className={`shrink-0 rounded-full px-2.5 py-1 ${active ? "bg-primary text-primary-foreground" : done ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}
              >
                {n}. {label}
              </li>
            );
          })}
        </ol>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Choose your source platform</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => p.supported && (setPlatform(p.id), setStep(2))}
                className={`text-left rounded-lg border p-4 transition ${platform === p.id ? "border-primary ring-2 ring-primary/20" : "border-border"} ${!p.supported ? "opacity-60 cursor-not-allowed" : "hover:border-primary/50"}`}
                disabled={!p.supported}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{p.name}</span>
                  </div>
                  {p.supported ? (
                    <Badge variant="default">Available</Badge>
                  ) : (
                    <Badge variant="secondary">Soon</Badge>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {p.description}
                </p>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Connect your {PLATFORMS.find((p) => p.id === platform)?.name}{" "}
              store
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Store URL</Label>
              <Input
                placeholder={
                  platform === "shopify"
                    ? "mystore.myshopify.com"
                    : platform === "woocommerce"
                      ? "https://mystore.com"
                      : "https://mystore.com"
                }
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
              />
              {platform === "shopify" && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Your <code>*.myshopify.com</code> URL, or your custom domain.
                </p>
              )}
              {platform === "woocommerce" && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  The homepage URL of your WordPress site (with WooCommerce
                  installed).
                </p>
              )}
              {(platform === "dukaan" || platform === "generic") && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Any storefront URL. We'll read <code>/sitemap.xml</code> to
                  find your products.
                </p>
              )}
            </div>

            {platform === "shopify" && (
              <div>
                <Label>Admin API access token</Label>
                <Input
                  type="password"
                  placeholder="shpat_…"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  In Shopify admin:{" "}
                  <b>
                    Settings → Apps and sales channels → Develop apps → Create
                    an app
                  </b>
                  . Add Admin API scopes <code>read_products</code>,{" "}
                  <code>read_orders</code>, <code>read_customers</code>.
                  Install, then copy the Admin API access token.
                </p>
              </div>
            )}

            {platform === "woocommerce" && (
              <>
                <div>
                  <Label>Consumer Key</Label>
                  <Input
                    placeholder="ck_…"
                    value={consumerKey}
                    onChange={(e) => setConsumerKey(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Consumer Secret</Label>
                  <Input
                    type="password"
                    placeholder="cs_…"
                    value={consumerSecret}
                    onChange={(e) => setConsumerSecret(e.target.value)}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    In WordPress admin:{" "}
                    <b>
                      WooCommerce → Settings → Advanced → REST API → Add key
                    </b>
                    . Set permissions to <b>Read</b>, then copy the consumer key
                    + secret.
                  </p>
                </div>
              </>
            )}

            {(platform === "dukaan" || platform === "generic") && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  No login needed. We only read <b>publicly visible</b> product
                  pages. Works best when the store publishes a sitemap and each
                  product page has Schema.org / Open Graph tags (most modern
                  stores do).
                </AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                We only <b>read</b> from your source store. Nothing is modified
                there. Credentials are stored securely and never exposed to your
                browser.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={handleDetect} disabled={detecting}>
                {detecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Testing…
                  </>
                ) : (
                  "Test connection"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && counts && (
        <Card>
          <CardHeader>
            <CardTitle>What should we import?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <Stat label="Products" value={counts.products} />
              <Stat label="Collections" value={counts.collections} />
              <Stat label="Orders" value={counts.orders} />
              <Stat label="Customers" value={counts.customers} />
            </div>

            <div className="space-y-2">
              {ENTITIES.map((e) => {
                const Icon = e.icon;
                const checked = selectedEntities.includes(e.id);
                const disabled = e.id !== "products" && e.id !== "categories";
                return (
                  <label
                    key={e.id}
                    className={`flex items-start gap-3 rounded-lg border p-3 ${disabled ? "opacity-50" : ""}`}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={disabled}
                      onCheckedChange={(v) => {
                        setSelectedEntities((prev) =>
                          v
                            ? Array.from(new Set([...prev, e.id]))
                            : prev.filter((x) => x !== e.id),
                        );
                      }}
                    />
                    <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{e.label}</div>
                      {disabled && (
                        <div className="text-[11px] text-muted-foreground">
                          Available in the next update.
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Products will be imported as <b>drafts</b> so you can review
                before publishing. Images are mirrored to our CDN. Re-running is
                safe — already imported items are skipped.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button
                onClick={handleStart}
                disabled={starting || !selectedEntities.length}
              >
                {starting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting…
                  </>
                ) : (
                  "Start migration"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && activeJob && (
        <Card>
          <CardHeader>
            <CardTitle>Migration in progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              {activeJob.status === "completed" ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />{" "}
                  <span className="font-semibold text-emerald-700">
                    Completed
                  </span>
                </>
              ) : activeJob.status === "failed" ? (
                <>
                  <AlertCircle className="h-5 w-5 text-destructive" />{" "}
                  <span className="font-semibold text-destructive">Failed</span>
                </>
              ) : (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />{" "}
                  <span className="font-semibold">Running…</span>
                </>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span>Products</span>
                <span className="text-muted-foreground">
                  {productsDone} imported
                  {productsFailed ? ` · ${productsFailed} failed` : ""}
                  {productsTotal ? ` / ${productsTotal}` : ""}
                </span>
              </div>
              <Progress value={pct} />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Products" value={productsDone} />
              <Stat
                label="Categories"
                value={Number(activeJob.progress?.categories?.done ?? 0)}
              />
              <Stat
                label="Pages"
                value={Number(activeJob.progress?.pages?.done ?? 0)}
              />
            </div>

            {activeJob.error_log?.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  Recent warnings ({activeJob.error_log.length})
                </summary>
                <ul className="mt-2 space-y-1 list-disc pl-4">
                  {activeJob.error_log.slice(-5).map((e: any, i: number) => (
                    <li key={i}>{e.msg}</li>
                  ))}
                </ul>
              </details>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStep(1);
                  setActiveJobId(null);
                  setCounts(null);
                }}
              >
                New migration
              </Button>
              {(activeJob.status === "pending" ||
                activeJob.status === "running") && (
                <Button variant="destructive" onClick={handleCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {history && history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent migrations</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {history.map((j) => (
              <div
                key={j.id}
                className="flex items-center justify-between py-2 text-sm"
              >
                <div>
                  <div className="font-medium capitalize">
                    {j.source_platform} ·{" "}
                    {
                      new URL(
                        j.source_url.startsWith("http")
                          ? j.source_url
                          : `https://${j.source_url}`,
                      ).host
                    }
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(j.created_at).toLocaleString()} ·{" "}
                    {Number(j.progress?.products?.done ?? 0)} products
                  </div>
                </div>
                <Badge
                  variant={
                    j.status === "completed"
                      ? "default"
                      : j.status === "failed"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {j.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </AppConfigShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-lg font-bold">{value.toLocaleString()}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
