import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Copy, BarChart3, Facebook, Server, Rss } from "lucide-react";

export default function StoreTracking() {
  const { storeId } = useParams<{ storeId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [facebookPixelId, setFacebookPixelId] = useState("");
  const [metaAccessToken, setMetaAccessToken] = useState("");

  const { data: store, isLoading } = useQuery({
    queryKey: ["store", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("id", storeId!)
        .eq("owner_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId && !!user,
  });

  useEffect(() => {
    if (store) {
      setFacebookPixelId((store as any).facebook_pixel_id || "");
      setMetaAccessToken((store as any).meta_access_token || "");
    }
  }, [store]);

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store", storeId] });
      toast.success("Tracking settings saved!");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update"),
  });

  const feedUrl = store?.slug
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/product-feed?slug=${store.slug}`
    : "";

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
          <Link to="/dashboard">
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
          </CardContent>
        </Card>

        {/* Server-Side CAPI */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Server className="h-5 w-5 text-emerald-600" />
              Conversions API (CAPI)
            </CardTitle>
            <CardDescription>Server-side tracking for better ad performance — bypasses ad blockers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="meta-token">Access Token</Label>
              <Input
                id="meta-token"
                type="password"
                placeholder="Enter your Meta CAPI access token"
                value={metaAccessToken}
                onChange={(e) => setMetaAccessToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Get this from Meta Events Manager → Settings → Conversions API → Generate Access Token.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Product Feed */}
        {store?.slug && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Rss className="h-5 w-5 text-orange-500" />
                Product Catalog Feed
              </CardTitle>
              <CardDescription>Use this feed URL in Meta Commerce Manager for Dynamic Product Ads</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 items-center">
                <code className="flex-1 text-xs bg-muted p-2.5 rounded-md border break-all">
                  {feedUrl}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(feedUrl);
                    toast.success("Feed URL copied!");
                  }}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Supports XML (default) and CSV (<code>?format=csv</code>) formats.
              </p>
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
