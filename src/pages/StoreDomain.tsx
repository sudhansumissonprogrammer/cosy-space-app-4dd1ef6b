import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Globe, Copy, CheckCircle2, AlertCircle, Loader2, ExternalLink } from "lucide-react";

export default function StoreDomain() {
  const { storeId } = useParams<{ storeId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [customDomain, setCustomDomain] = useState("");

  const { data: store, isLoading } = useQuery({
    queryKey: ["store", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores").select("*").eq("id", storeId!).eq("owner_id", user!.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId && !!user,
  });

  useEffect(() => {
    if (store) setCustomDomain((store as any).custom_domain || "");
  }, [store]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const domain = customDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
      const { error } = await (supabase as any)
        .from("stores")
        .update({ custom_domain: domain || null })
        .eq("id", storeId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store", storeId] });
      toast.success("Domain settings saved!");
    },
    onError: (err: any) => toast.error(err.message || "Failed to save"),
  });

  const storefrontUrl = store ? `${window.location.origin}/store/${store.slug}` : "";

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
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
          <Link to={`/dashboard/stores/${storeId}/settings`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Custom Domain</h1>
          <p className="text-sm text-muted-foreground">{store?.name}</p>
        </div>
      </div>

      {/* Current URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current Storefront URL</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
            <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
            <code className="flex-1 text-sm">{storefrontUrl}</code>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyToClipboard(storefrontUrl)}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Custom Domain Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connect Custom Domain</CardTitle>
          <CardDescription>Point your own domain to this store</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="domain">Domain Name</Label>
            <Input
              id="domain"
              placeholder="www.mybrand.com"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              maxLength={253}
            />
          </div>

          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Domain
          </Button>

          {(store as any)?.custom_domain && (
            <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0 text-warning" />
              <span className="text-muted-foreground">
                Domain saved: <strong className="text-foreground">{(store as any).custom_domain}</strong>. Follow the DNS setup below.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DNS Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">DNS Configuration</CardTitle>
          <CardDescription>Add these records at your domain registrar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Step 1 */}
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Badge variant="outline" className="h-5 w-5 items-center justify-center rounded-full p-0 text-xs">1</Badge>
              A Record (Root Domain)
            </h3>
            <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
              <div><span className="text-muted-foreground">Type:</span> <strong>A</strong></div>
              <div><span className="text-muted-foreground">Name:</span> <strong>@</strong></div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Value:</span> <strong>185.158.133.1</strong>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard("185.158.133.1")}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Badge variant="outline" className="h-5 w-5 items-center justify-center rounded-full p-0 text-xs">2</Badge>
              A Record (www Subdomain)
            </h3>
            <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
              <div><span className="text-muted-foreground">Type:</span> <strong>A</strong></div>
              <div><span className="text-muted-foreground">Name:</span> <strong>www</strong></div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Value:</span> <strong>185.158.133.1</strong>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard("185.158.133.1")}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Badge variant="outline" className="h-5 w-5 items-center justify-center rounded-full p-0 text-xs">3</Badge>
              TXT Record (Verification)
            </h3>
            <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
              <div><span className="text-muted-foreground">Type:</span> <strong>TXT</strong></div>
              <div><span className="text-muted-foreground">Name:</span> <strong>_lovable</strong></div>
              <div><span className="text-muted-foreground">Value:</span> <strong className="break-all">lovable_verify={storeId}</strong></div>
            </div>
          </div>

          <div className="rounded-lg border bg-accent/30 p-4 text-sm text-muted-foreground space-y-2">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-600" /> After setup
            </p>
            <ul className="list-inside list-disc space-y-1">
              <li>DNS propagation can take up to 72 hours</li>
              <li>SSL certificate will be provisioned automatically</li>
              <li>Add both root domain and www subdomain</li>
              <li>Use <a href="https://dnschecker.org" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">DNSChecker.org <ExternalLink className="h-3 w-3" /></a> to verify your settings</li>
            </ul>
          </div>

          <a
            href="https://docs.lovable.dev/features/custom-domain"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Read full domain setup docs <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
