import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useStoreData } from "@/hooks/useStoreData";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Globe, Copy, ExternalLink, Loader2, CheckCircle, Info } from "lucide-react";
import { ROOT_DOMAIN } from "@/lib/subdomain";

export default function StoreDomain() {
  const { storeId } = useParams<{ storeId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: store, isLoading } = useStoreData(storeId);

  const [customDomain, setCustomDomain] = useState("");

  useEffect(() => {
    if (store?.custom_domain) {
      setCustomDomain(store.custom_domain);
    }
  }, [store?.custom_domain]);

  const subdomainUrl = store ? `https://${store.slug}.${ROOT_DOMAIN}` : "";
  const pathUrl = store ? `${window.location.origin}/store/${store.slug}` : "";

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const saveDomain = useMutation({
    mutationFn: async (domain: string) => {
      const cleanDomain = domain
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/\/+$/, "");
      const { error } = await supabase
        .from("stores")
        .update({ custom_domain: cleanDomain || null })
        .eq("id", storeId!);
      if (error) throw error;
      return cleanDomain;
    },
    onSuccess: (domain) => {
      queryClient.invalidateQueries({ queryKey: ["store", storeId] });
      toast.success(domain ? "Custom domain saved" : "Custom domain removed");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const removeDomain = () => {
    setCustomDomain("");
    saveDomain.mutate("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const savedDomain = store?.custom_domain;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/dashboard/stores/${storeId}/settings`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Store Domain</h1>
          <p className="text-sm text-muted-foreground">{store?.name}</p>
        </div>
      </div>

      {/* Subdomain URL — Primary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Store URL</CardTitle>
          <CardDescription>Share this link with your customers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2.5">
            <Globe className="h-4 w-4 shrink-0 text-primary" />
            <code className="flex-1 text-sm font-medium">{subdomainUrl}</code>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyToClipboard(subdomainUrl)}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <a href={subdomainUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Your store is live at <strong>{store?.slug}.{ROOT_DOMAIN}</strong>. Share this URL on social media, WhatsApp, or anywhere.
          </p>
        </CardContent>
      </Card>

      {/* Custom Domain */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Custom Domain</CardTitle>
          <CardDescription>Use your own domain like www.mybrand.com</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="custom-domain">Domain Name</Label>
            <div className="flex gap-2">
              <Input
                id="custom-domain"
                placeholder="mybrand.com or www.mybrand.com"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                maxLength={100}
              />
              <Button
                onClick={() => saveDomain.mutate(customDomain)}
                disabled={
                  saveDomain.isPending ||
                  customDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "") === (savedDomain || "")
                }
              >
                {saveDomain.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>

          {savedDomain && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
                <code className="flex-1 text-sm font-medium">{savedDomain}</code>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={removeDomain}>
                  Remove
                </Button>
              </div>

              {/* Step-by-step setup guide */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">Setup Guide — Follow these steps</p>
                </div>

                {/* Step 1 */}
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Step 1: Create a free Cloudflare account</p>
                  <p className="text-xs text-muted-foreground">
                    Go to{" "}
                    <a href="https://dash.cloudflare.com/sign-up" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      cloudflare.com/sign-up
                    </a>{" "}
                    and create a free account.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Step 2: Add your domain to Cloudflare</p>
                  <p className="text-xs text-muted-foreground">
                    In Cloudflare dashboard, click "Add a site" → enter <strong>{savedDomain.replace(/^www\./, "")}</strong> → choose the <strong>Free</strong> plan.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Step 3: Update nameservers at your registrar</p>
                  <p className="text-xs text-muted-foreground">
                    Cloudflare will give you 2 nameservers (e.g., <code className="bg-muted px-1 rounded">ns1.cloudflare.com</code>). Go to your domain registrar (Hostinger / GoDaddy / Namecheap) → DNS settings → replace the existing nameservers with the Cloudflare ones. This may take up to 24 hours to propagate.
                  </p>
                </div>

                {/* Step 4 */}
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Step 4: Add DNS records in Cloudflare</p>
                  <p className="text-xs text-muted-foreground">
                    Once your domain is active on Cloudflare, go to DNS → Records and add:
                  </p>
                  <div className="overflow-x-auto rounded border bg-background">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="py-2 px-3 text-left font-medium">Type</th>
                          <th className="py-2 px-3 text-left font-medium">Name</th>
                          <th className="py-2 px-3 text-left font-medium">Content</th>
                          <th className="py-2 px-3 text-left font-medium">Proxy</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        <tr className="border-b">
                          <td className="py-2 px-3">CNAME</td>
                          <td className="py-2 px-3">@</td>
                          <td className="py-2 px-3">{store?.slug}.{ROOT_DOMAIN}</td>
                          <td className="py-2 px-3">
                            <span className="inline-block rounded bg-primary/10 px-1.5 py-0.5 text-primary text-[10px] font-semibold">Proxied ☁️</span>
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3">CNAME</td>
                          <td className="py-2 px-3">www</td>
                          <td className="py-2 px-3">{store?.slug}.{ROOT_DOMAIN}</td>
                          <td className="py-2 px-3">
                            <span className="inline-block rounded bg-primary/10 px-1.5 py-0.5 text-primary text-[10px] font-semibold">Proxied ☁️</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    ⚠️ Make sure the orange cloud (Proxy) is <strong>ON</strong> for both records.
                  </p>
                </div>

                {/* Step 5 */}
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Step 5: Set SSL to Full</p>
                  <p className="text-xs text-muted-foreground">
                    In Cloudflare → SSL/TLS → set encryption mode to <strong>Full</strong>. This ensures your custom domain works with HTTPS.
                  </p>
                </div>

                {/* Step 6 */}
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Step 6: Done! 🎉</p>
                  <p className="text-xs text-muted-foreground">
                    Once DNS propagates (usually 5–30 minutes with Cloudflare), your store will be accessible at{" "}
                    <strong>https://{savedDomain}</strong>. Cloudflare provides free SSL automatically.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fallback path-based URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Alternative URL</CardTitle>
          <CardDescription>Path-based link (also works)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
            <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
            <code className="flex-1 text-sm text-muted-foreground">{pathUrl}</code>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyToClipboard(pathUrl)}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
