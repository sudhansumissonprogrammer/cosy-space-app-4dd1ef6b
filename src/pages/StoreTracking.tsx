import { useState, useEffect } from "react";
import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useStoreData } from "@/hooks/useStoreData";
import { supabase } from "@/integrations/supabase/client";
import { purgeStoreCache } from "@/lib/purgeStoreCache";
import { prewarmStore } from "@/lib/prewarmStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Copy, Facebook, Server, Rss, ExternalLink, CheckCircle2, AlertTriangle, Activity } from "lucide-react";
import MetaCapiSetupWizard from "@/components/dashboard/MetaCapiSetupWizard";

export default function StoreTracking() {
  const { storeId, storeSlug } = useStoreSlugParam();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [facebookPixelId, setFacebookPixelId] = useState("");
  const [metaAccessToken, setMetaAccessToken] = useState("");

  const { data: store, isLoading } = useStoreData(storeId);

  // Feed health check
  const { data: feedHealth } = useQuery({
    queryKey: ["feed-health", store?.slug],
    queryFn: async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seo-page?type=feed&slug=${store!.slug}&format=xml`
        );
        if (!res.ok) return { ok: false, count: 0, error: `HTTP ${res.status}` };
        const text = await res.text();
        const itemCount = (text.match(/<item>/g) || []).length;
        return { ok: true, count: itemCount, error: null };
      } catch (e: any) {
        return { ok: false, count: 0, error: e.message };
      }
    },
    enabled: !!store?.slug,
    staleTime: 60000,
  });

  // Marketing health: timestamp of the most-recent server-side Purchase CAPI fire.
  const { data: lastCapiPurchase } = useQuery({
    queryKey: ["last-capi-purchase", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("meta_purchase_fired_at")
        .eq("store_id", storeId!)
        .not("meta_purchase_fired_at", "is", null)
        .order("meta_purchase_fired_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as any)?.meta_purchase_fired_at as string | null;
    },
    enabled: !!storeId,
    staleTime: 60_000,
  });

  // Fetch meta_access_token via secure RPC (column revoked from direct SELECT)
  const { data: metaTokenFromDb } = useQuery({
    queryKey: ["store-meta-token", storeId],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_own_store_meta_token", { _store_id: storeId! });
      return (data as string) || "";
    },
    enabled: !!storeId,
  });

  useEffect(() => {
    if (store) {
      setFacebookPixelId((store as any).facebook_pixel_id || "");
    }
  }, [store]);

  useEffect(() => {
    if (metaTokenFromDb !== undefined) {
      setMetaAccessToken(metaTokenFromDb);
    }
  }, [metaTokenFromDb]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("stores")
        .update({
          facebook_pixel_id: facebookPixelId.trim() || null,
          meta_access_token: metaAccessToken.trim() || null,
        })
        .eq("id", storeId!);
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["store", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["store-meta-token", storeId] }),
      ]);

      if (store?.slug) {
        const purged = await purgeStoreCache(store.slug, (store as any).custom_domain);
        if (purged) void prewarmStore(store.slug, (store as any).custom_domain);
      }

      toast.success("Tracking settings saved and storefront cache refreshed!");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update"),
  });

  const feedBaseUrl = store?.slug
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seo-page?type=feed&slug=${store.slug}`
    : "";

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/dashboard/stores/${storeSlug}/products`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Tracking & Analytics</h1>
          <p className="text-sm text-muted-foreground">Connect tracking pixels and product feeds</p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateMutation.mutate();
        }}
        className="space-y-6"
      >
        {/* Marketing Health — Shopify-style status overview */}
        {(() => {
          const pixelOk = !!(store as any)?.facebook_pixel_id;
          const capiOk = pixelOk && !!metaAccessToken;
          const lastFiredAgo = lastCapiPurchase
            ? (() => {
                const ms = Date.now() - new Date(lastCapiPurchase).getTime();
                const mins = Math.floor(ms / 60_000);
                if (mins < 1) return "just now";
                if (mins < 60) return `${mins}m ago`;
                const hrs = Math.floor(mins / 60);
                if (hrs < 24) return `${hrs}h ago`;
                const days = Math.floor(hrs / 24);
                return `${days}d ago`;
              })()
            : null;
          return (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Activity className="h-5 w-5 text-primary" />
                  Marketing Health
                </CardTitle>
                <CardDescription>
                  Live status of your Meta tracking pipeline
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${pixelOk ? "bg-emerald-500" : "bg-amber-500"}`}
                    />
                    <span className="text-sm font-medium">Facebook Pixel</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {pixelOk ? "Active" : "Not configured"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        capiOk ? "bg-emerald-500" : pixelOk ? "bg-amber-500" : "bg-muted-foreground/40"
                      }`}
                    />
                    <div>
                      <div className="text-sm font-medium">Conversions API</div>
                      {pixelOk && !capiOk && (
                        <div className="text-[11px] text-amber-700 dark:text-amber-400">
                          Pixel-only mode — add token below for ~30% better ROAS
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {capiOk ? "Connected" : pixelOk ? "Optional" : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        lastFiredAgo ? "bg-emerald-500" : "bg-muted-foreground/40"
                      }`}
                    />
                    <span className="text-sm font-medium">Last server Purchase</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {lastFiredAgo ?? "No events yet"}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Facebook Pixel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Facebook className="h-5 w-5 text-blue-600" />
              Facebook Pixel
            </CardTitle>
            <CardDescription>Track visitor actions for Meta Ads optimization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fb-pixel">Pixel ID</Label>
              <Input
                id="fb-pixel"
                placeholder="e.g. 123456789012345"
                value={facebookPixelId}
                onChange={(e) => setFacebookPixelId(e.target.value)}
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">
                Automatically tracks PageView, ViewContent, AddToCart, InitiateCheckout and Purchase events.
              </p>
            </div>
            {facebookPixelId && (
              <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
                <p className="text-xs font-medium text-foreground">Events tracked automatically:</p>
                <div className="flex flex-wrap gap-1.5">
                  {["PageView", "ViewContent", "AddToCart", "InitiateCheckout", "AddPaymentInfo", "Purchase"].map((e) => (
                    <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Server-Side CAPI — Guided Setup Wizard */}
        <MetaCapiSetupWizard
          pixelId={facebookPixelId}
          accessToken={metaAccessToken}
          onAccessTokenChange={setMetaAccessToken}
        />


        {/* Product Feed */}
        {store?.slug && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Rss className="h-5 w-5 text-orange-500" />
                  Product Catalog Feed
                </CardTitle>
                {feedHealth && (
                  <Badge variant={feedHealth.ok ? "default" : "destructive"} className="text-xs">
                    {feedHealth.ok ? `${feedHealth.count} items` : "Error"}
                  </Badge>
                )}
              </div>
              <CardDescription>Use this feed URL in Meta Commerce Manager for Dynamic Product Ads</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* XML Feed */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">XML Feed (recommended for Meta)</Label>
                <div className="flex gap-2 items-center">
                  <code className="flex-1 text-xs bg-muted p-2.5 rounded-md border break-all select-all">
                    {feedBaseUrl}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(feedBaseUrl, "XML feed URL")}
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                  </Button>
                </div>
              </div>

              {/* CSV Feed */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">CSV Feed (for Google Merchant)</Label>
                <div className="flex gap-2 items-center">
                  <code className="flex-1 text-xs bg-muted p-2.5 rounded-md border break-all select-all">
                    {feedBaseUrl}&format=csv
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(`${feedBaseUrl}&format=csv`, "CSV feed URL")}
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                  </Button>
                </div>
              </div>

              {/* Test links */}
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  asChild
                >
                  <a href={feedBaseUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1 h-3 w-3" /> Preview XML
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  asChild
                >
                  <a href={`${feedBaseUrl}&format=csv`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1 h-3 w-3" /> Download CSV
                  </a>
                </Button>
              </div>

              {/* Feed info */}
              <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                <p className="text-xs font-medium text-foreground">Feed includes:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• All active products with images, prices & sale prices</li>
                  <li>• Product variants expanded as separate items (sizes, colors)</li>
                  <li>• <code className="bg-muted px-1 rounded">item_group_id</code> for variant grouping</li>
                  <li>• Up to 10 additional images per product</li>
                  <li>• Auto-refreshes with 1 hour cache</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
          {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Tracking Settings
        </Button>
      </form>
    </div>
  );
}
