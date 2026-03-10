import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Globe, Copy, ExternalLink } from "lucide-react";
import { ROOT_DOMAIN } from "@/lib/subdomain";

export default function StoreDomain() {
  const { storeId } = useParams<{ storeId: string }>();
  const { user } = useAuth();

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

  const subdomainUrl = store ? `https://${store.slug}.${ROOT_DOMAIN}` : "";
  const pathUrl = store ? `${window.location.origin}/store/${store.slug}` : "";

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
