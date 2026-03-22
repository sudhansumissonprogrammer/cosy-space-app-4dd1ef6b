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
import { ArrowLeft, Globe, Copy, ExternalLink, Loader2, CheckCircle, AlertCircle, Shield, Server, FileText } from "lucide-react";
import { ROOT_DOMAIN } from "@/lib/subdomain";

const FALLBACK_ORIGIN = `fallback.${ROOT_DOMAIN}`;
const NAMESERVER_IP = "185.158.133.1";

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  purpose: string;
}

function getDnsRecords(domain: string): DnsRecord[] {
  const isWww = domain.startsWith("www.");
  const rootDomain = isWww ? domain.replace(/^www\./, "") : domain;

  return [
    {
      type: "A",
      name: "@",
      value: NAMESERVER_IP,
      purpose: `Points ${rootDomain} to your store`,
    },
    {
      type: "A",
      name: "www",
      value: NAMESERVER_IP,
      purpose: `Points www.${rootDomain} to your store`,
    },
  ];
}

function DnsRecordRow({ record, onCopy }: { record: DnsRecord; onCopy: (v: string) => void }) {
  return (
    <div className="grid grid-cols-[60px_1fr_1fr_auto] items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm">
      <span className="rounded bg-primary/10 px-2 py-0.5 text-center text-xs font-bold text-primary">
        {record.type}
      </span>
      <code className="font-mono text-foreground">{record.name}</code>
      <code className="font-mono text-muted-foreground truncate">{record.value}</code>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onCopy(record.value)}>
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}

export default function StoreDomain() {
  const { storeId } = useParams<{ storeId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: store, isLoading } = useStoreData(storeId);

  const [customDomain, setCustomDomain] = useState("");
  const [domainError, setDomainError] = useState("");

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

  const validateDomain = (domain: string): boolean => {
    setDomainError("");
    if (!domain) return true;
    const cleaned = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    
    if (cleaned.endsWith(`.${ROOT_DOMAIN}`)) {
      setDomainError(`Cannot use a ${ROOT_DOMAIN} subdomain as custom domain`);
      return false;
    }
    const domainRegex = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;
    if (!domainRegex.test(cleaned)) {
      setDomainError("Please enter a valid domain (e.g. mybrand.com or www.mybrand.com)");
      return false;
    }
    return true;
  };

  const saveDomain = useMutation({
    mutationFn: async (domain: string) => {
      const cleanDomain = domain
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/\/+$/, "");

      if (cleanDomain && !validateDomain(cleanDomain)) {
        throw new Error(domainError || "Invalid domain");
      }

      const { error } = await supabase
        .from("stores")
        .update({ custom_domain: cleanDomain || null })
        .eq("id", storeId!);
      if (error) throw error;
      return cleanDomain;
    },
    onSuccess: (domain) => {
      queryClient.invalidateQueries({ queryKey: ["store", storeId] });
      toast.success(domain ? "Custom domain saved! Now configure your DNS records below." : "Custom domain removed");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const removeDomain = () => {
    setCustomDomain("");
    setDomainError("");
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
  const dnsRecords = savedDomain ? getDnsRecords(savedDomain) : [];

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
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Custom Domain
          </CardTitle>
          <CardDescription>Connect your own domain like mybrand.com</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="custom-domain">Domain Name</Label>
            <div className="flex gap-2">
              <Input
                id="custom-domain"
                placeholder="mybrand.com"
                value={customDomain}
                onChange={(e) => {
                  setCustomDomain(e.target.value);
                  setDomainError("");
                }}
                maxLength={100}
              />
              <Button
                onClick={() => {
                  if (validateDomain(customDomain)) {
                    saveDomain.mutate(customDomain);
                  }
                }}
                disabled={
                  saveDomain.isPending ||
                  customDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "") === (savedDomain || "")
                }
              >
                {saveDomain.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
            {domainError && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {domainError}
              </p>
            )}
          </div>

          {savedDomain && (
            <div className="space-y-5">
              {/* Saved domain badge */}
              <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
                <code className="flex-1 text-sm font-medium">{savedDomain}</code>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={removeDomain}>
                  Remove
                </Button>
              </div>

              {/* DNS Setup Instructions */}
              <div className="rounded-xl border-2 border-dashed border-primary/20 bg-muted/30 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-foreground">DNS Configuration</h3>
                </div>

                <p className="text-sm text-muted-foreground">
                  Add these DNS records at your domain registrar (GoDaddy, Namecheap, Hostinger, etc.):
                </p>

                <div className="space-y-2">
                  {dnsRecords.map((record, i) => (
                    <DnsRecordRow key={i} record={record} onCopy={copyToClipboard} />
                  ))}
                </div>

                {/* Step-by-step guide */}
                <div className="rounded-lg bg-card border p-4 space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Setup Steps
                  </h4>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>Login to your domain registrar (where you bought the domain)</li>
                    <li>Go to <strong>DNS Settings</strong> or <strong>DNS Management</strong></li>
                    <li>
                      Add an <strong>A Record</strong> with Name: <code className="bg-muted px-1 rounded text-xs">@</code> and Value: <code className="bg-muted px-1 rounded text-xs">{NAMESERVER_IP}</code>
                    </li>
                    <li>
                      Add another <strong>A Record</strong> with Name: <code className="bg-muted px-1 rounded text-xs">www</code> and Value: <code className="bg-muted px-1 rounded text-xs">{NAMESERVER_IP}</code>
                    </li>
                    <li>Delete any existing A or CNAME records for <code className="bg-muted px-1 rounded text-xs">@</code> and <code className="bg-muted px-1 rounded text-xs">www</code></li>
                    <li>Save and wait for DNS propagation (usually 5–30 minutes, max 48 hours)</li>
                  </ol>
                </div>

                {/* Important notes */}
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-amber-600" />
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Important Notes</p>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                    <li>If your domain uses Cloudflare, set DNS records to <strong>DNS-only (grey cloud)</strong>, not Proxied</li>
                    <li>Remove any conflicting A, AAAA, or CNAME records for @ and www</li>
                    <li>SSL certificate will be provisioned automatically after DNS is active</li>
                    <li>Your subdomain ({store?.slug}.{ROOT_DOMAIN}) will auto-redirect to your custom domain</li>
                  </ul>
                </div>

                {/* Check DNS tool */}
                <div className="flex items-center gap-2 pt-1">
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={`https://dnschecker.org/#A/${savedDomain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="gap-1.5"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Check DNS Propagation
                    </a>
                  </Button>
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
