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
import { Loader2, ArrowLeft, Copy, Facebook, Server, Rss, ExternalLink, CheckCircle2, AlertTriangle, Activity, ShieldOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import MetaCapiSetupWizard from "@/components/dashboard/MetaCapiSetupWizard";
import MetaEventIssuesCard from "@/components/dashboard/MetaEventIssuesCard";

export default function StoreTracking() {
  const { storeId, storeSlug } = useStoreSlugParam();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [facebookPixelId, setFacebookPixelId] = useState("");
  const [facebookPixelIdTouched, setFacebookPixelIdTouched] = useState(false);
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [metaAccessTokenTouched, setMetaAccessTokenTouched] = useState(false);

  const { data: store, isLoading } = useStoreData(storeId);

  // Pixel is business-critical and must not depend on the wider store cache.
  // Fetch it directly so the Tracking page never shows blank/"Not configured"
  // when the saved backend value exists but the store settings cache is stale.
  const { data: pixelFromDb } = useQuery({
    queryKey: ["store-facebook-pixel", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("facebook_pixel_id")
        .eq("id", storeId!)
        .maybeSingle();
      if (error) throw error;
      return ((data as any)?.facebook_pixel_id as string | null) || "";
    },
    enabled: !!storeId,
    staleTime: 0,
  });

  const savedFacebookPixelId =
    (pixelFromDb !== undefined ? pixelFromDb : (store as any)?.facebook_pixel_id) || "";
  const effectiveFacebookPixelId = facebookPixelId.trim() || savedFacebookPixelId.trim();

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
  const { data: metaTokenFromDb, isLoading: metaTokenLoading } = useQuery({
    queryKey: ["store-meta-token", storeId],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_own_store_meta_token", { _store_id: storeId! });
      return (data as string) || "";
    },
    enabled: !!storeId,
  });

  useEffect(() => {
    if (!facebookPixelIdTouched) {
      setFacebookPixelId(savedFacebookPixelId);
    }
  }, [savedFacebookPixelId, facebookPixelIdTouched]);

  useEffect(() => {
    if (metaTokenFromDb !== undefined && !metaAccessTokenTouched) {
      setMetaAccessToken(metaTokenFromDb);
    }
  }, [metaTokenFromDb, metaAccessTokenTouched]);

  const handleMetaAccessTokenChange = (value: string) => {
    setMetaAccessTokenTouched(true);
    setMetaAccessToken(value);
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      const trimmedPixel = facebookPixelId.trim();
      if (trimmedPixel && !/^\d{6,20}$/.test(trimmedPixel)) {
        throw new Error("Facebook Pixel ID must be 6–20 digits (numbers only). Copy it from Meta Events Manager.");
      }
      const updatePayload: Record<string, any> = {};
      // Only write pixel if the user actually edited the Pixel ID field.
      // This prevents wiping a saved pixel when any cache/RPC path is stale,
      // slow, or returns a partial store object without facebook_pixel_id.
      if (facebookPixelIdTouched) {
        updatePayload.facebook_pixel_id = trimmedPixel || null;
      }
      // Do not wipe a saved CAPI token if the secure token RPC has not loaded yet.
      const trimmedToken = metaAccessToken.trim();
      if (metaTokenFromDb !== undefined || metaAccessTokenTouched) {
        if (trimmedToken) {
          // Meta System User CAPI tokens always start with "EAA" and are 150+ chars long.
          // Reject passwords, short strings, and anything with spaces — this prevents
          // accidental overwrite of a real token with a password-style value.
          if (!/^EAA[A-Za-z0-9_-]{100,}$/.test(trimmedToken)) {
            throw new Error(
              "Invalid Meta CAPI token. It must start with 'EAA' and be 100+ characters. Generate it in Meta Events Manager → Settings → Conversions API → Generate access token."
            );
          }
        }
        updatePayload.meta_access_token = trimmedToken || null;
      }

      // SAVE-GUARD 1: an empty payload makes PostgREST reject the request with
      // a confusing "failed to update". Tell the merchant nothing changed
      // instead, and let onSuccess still refresh the storefront cache.
      if (Object.keys(updatePayload).length === 0) {
        return { pixelOk: true, tokenOk: true, noop: true as const };
      }

      const { error } = await (supabase as any)
        .from("stores")
        .update(updatePayload)
        .eq("id", storeId!);
      if (error) throw error;

      // SAVE-GUARD 2: read back from the database and confirm the values really
      // landed. RLS / column-grant / trigger failures can make an update apply
      // to ZERO rows without raising an error — that is exactly how a merchant
      // ends up seeing "saved" while the pixel is still missing in the DB and
      // their ads run untracked. Now a silent no-write is impossible.
      const { data: verifyRow, error: verifyErr } = await (supabase as any)
        .from("stores")
        .select("facebook_pixel_id")
        .eq("id", storeId!)
        .maybeSingle();
      if (verifyErr) throw verifyErr;

      const pixelOk =
        !("facebook_pixel_id" in updatePayload) ||
        ((verifyRow?.facebook_pixel_id || "") === (trimmedPixel || ""));

      let tokenOk = true;
      if ("meta_access_token" in updatePayload) {
        const { data: savedToken } = await supabase.rpc("get_own_store_meta_token", { _store_id: storeId! });
        tokenOk = ((savedToken as string) || "") === trimmedToken;
      }

      if (!pixelOk || !tokenOk) {
        throw new Error(
          `Save did not persist (${!pixelOk ? "Pixel ID" : "CAPI token"}). You may not have permission on this store — reload the page and try again, or contact support.`
        );
      }

      return { pixelOk, tokenOk, noop: false as const };
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["store", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["store-facebook-pixel", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["store-meta-token", storeId] }),
      ]);

      if (store?.slug) {
        // shell:true is REQUIRED — tracking pixel IDs are baked into the
        // prebuilt HTML shell (__STOREFRONT_DATA__.store.facebook_pixel_id).
        // Without it the cached HTML keeps the OLD pixel id and Meta Pixel
        // Helper still shows "No Pixels found" after a save.
        //
        // Retry: one failed purge used to leave the whole storefront serving a
        // pixel-less shell until the 24h edge TTL expired — the single biggest
        // cause of "I saved my pixel but Meta sees nothing".
        let purged = false;
        for (let attempt = 0; attempt < 3 && !purged; attempt++) {
          if (attempt > 0) await new Promise((r) => setTimeout(r, 1200));
          purged = await purgeStoreCache(store.slug, (store as any).custom_domain, { shell: true, force: true });
        }
        await prewarmStore(store.slug, (store as any).custom_domain, { force: true });
        if (!purged) {
          toast.warning(
            "Saved to your account, but the storefront cache purge failed. Your pixel still activates on the next page load — refresh your store to confirm."
          );
        }
      }

      toast.success("Tracking settings saved and pixel is live on your storefront!");
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
        <Button variant="ghost" size="icon" asChild aria-label="Back to products">
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
          // Use the form-hydrated state as source of truth — it always mirrors
          // the latest DB value (via useEffect on `store`) AND reflects an
          // in-progress edit immediately after Save without waiting for a
          // react-query refetch. Prevents "Not configured" showing when the
          // pixel is actually saved but cache is stale.
          const pixelOk = !!effectiveFacebookPixelId;
          const capiOk = pixelOk && !!metaAccessToken.trim();
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
                      className={`h-2.5 w-2.5 rounded-full ${pixelOk ? "bg-success" : "bg-warning"}`}
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
                        capiOk ? "bg-success" : pixelOk ? "bg-warning" : "bg-muted-foreground/40"
                      }`}
                    />
                    <div>
                      <div className="text-sm font-medium">Conversions API</div>
                      {pixelOk && !capiOk && (
                        <div className="text-[11px] text-warning">
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
                        lastFiredAgo ? "bg-success" : "bg-muted-foreground/40"
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

        {/* Recent Meta rejections, in plain language */}
        <MetaEventIssuesCard storeId={storeId} />

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
                name="fb-pixel-id-field"
                inputMode="numeric"
                placeholder="e.g. 123456789012345"
                value={facebookPixelId}
                onChange={(e) => {
                  setFacebookPixelIdTouched(true);
                  // Pixel IDs are numeric only — strip anything a password
                  // manager / browser autofill may inject (e.g. an email).
                  setFacebookPixelId(e.target.value.replace(/\D/g, ""));
                }}
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore
                data-form-type="other"
                spellCheck={false}
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">
                Automatically tracks PageView, ViewContent, AddToCart, InitiateCheckout and Purchase events.
              </p>
            </div>
            {effectiveFacebookPixelId && (
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
          storeId={storeId!}
          pixelId={effectiveFacebookPixelId}
          accessToken={metaAccessToken}
          tokenLoading={metaTokenLoading}
          onAccessTokenChange={handleMetaAccessTokenChange}
        />

        {/* CAPI Kill-Switch — keeps browser Pixel running, silences server events */}
        {(effectiveFacebookPixelId || (store as any)?.capi_disabled) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldOff className="h-5 w-5 text-warning" />
                Pause Server-Side CAPI
              </CardTitle>
              <CardDescription>
                Temporarily stop sending server-side conversion events to Meta (Pixel keeps firing in the browser). Use this while appealing a Meta account restriction.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">CAPI paused</p>
                  <p className="text-xs text-muted-foreground">
                    {(store as any)?.capi_disabled
                      ? "Server-side events are OFF for this store. Turn back on to restore full attribution."
                      : "All server events currently sending. Turn on only if Meta support asks you to."}
                  </p>
                </div>
                <Switch
                  checked={!!(store as any)?.capi_disabled}
                  onCheckedChange={async (checked) => {
                    const { error } = await (supabase as any)
                      .from("stores")
                      .update({ capi_disabled: checked })
                      .eq("id", storeId!);
                    if (error) {
                      toast.error("Failed to update: " + error.message);
                      return;
                    }
                    if (store?.slug) {
                      await purgeStoreCache(store.slug, (store as any).custom_domain ?? null, { shell: true });
                      prewarmStore(store.slug).catch(() => {});
                    }
                    await queryClient.invalidateQueries({ queryKey: ["store", storeId] });
                    toast.success(checked ? "CAPI paused for this store" : "CAPI re-enabled");
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}



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
