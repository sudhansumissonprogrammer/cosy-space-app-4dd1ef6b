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
import {
  ArrowLeft, Globe, Copy, ExternalLink, Loader2, CheckCircle,
  AlertCircle, Shield, Server, FileText, Info, Clock
} from "lucide-react";
import { ROOT_DOMAIN } from "@/lib/subdomain";

const CNAME_TARGET = ROOT_DOMAIN;

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  purpose: string;
}

function getDnsRecords(domain: string): DnsRecord[] {
  const rootDomain = domain.startsWith("www.") ? domain.replace(/^www\./, "") : domain;
  return [
    { type: "CNAME", name: "@", value: CNAME_TARGET, purpose: `Points ${rootDomain} to your store` },
    { type: "CNAME", name: "www", value: CNAME_TARGET, purpose: `Points www.${rootDomain} to your store` },
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
  const [verifying, setVerifying] = useState(false);

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
      const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");

      if (cleanDomain && !validateDomain(cleanDomain)) {
        throw new Error(domainError || "Invalid domain");
      }

      if (!cleanDomain) {
        const { error } = await supabase
          .from("stores")
          .update({ custom_domain: null, domain_verification_token: null, domain_verified: false } as any)
          .eq("id", storeId!);
        if (error) throw error;
        return "";
      }

      // Generate verification token
      const token = generateToken();
      const { error } = await supabase
        .from("stores")
        .update({
          custom_domain: cleanDomain,
          domain_verification_token: token,
          domain_verified: false,
        } as any)
        .eq("id", storeId!);
      if (error) throw error;
      return cleanDomain;
    },
    onSuccess: (domain) => {
      queryClient.invalidateQueries({ queryKey: ["store", storeId] });
      toast.success(domain ? "Domain saved! Now add the TXT record to verify ownership." : "Custom domain removed");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleVerify = async () => {
    if (!store?.custom_domain || !storeId) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-domain", {
        body: { store_id: storeId, domain: store.custom_domain },
      });
      if (error) throw error;
      if (data.verified) {
        toast.success("Domain verified successfully! 🎉");
        queryClient.invalidateQueries({ queryKey: ["store", storeId] });
      } else {
        toast.error(data.message || "Verification failed. TXT record not found yet.");
      }
    } catch (err: any) {
      toast.error(err.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

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
  const verificationToken = (store as any)?.domain_verification_token;
  const domainVerified = (store as any)?.domain_verified;
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

      {/* Subdomain URL */}
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
            Your store is live at <strong>{store?.slug}.{ROOT_DOMAIN}</strong>.
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
                  if (validateDomain(customDomain)) saveDomain.mutate(customDomain);
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
                {domainVerified ? (
                  <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />
                ) : (
                  <Clock className="h-4 w-4 shrink-0 text-amber-500" />
                )}
                <code className="flex-1 text-sm font-medium">{savedDomain}</code>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${domainVerified ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {domainVerified ? "Verified" : "Pending Verification"}
                </span>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={removeDomain}>
                  Remove
                </Button>
              </div>

              {/* Step 1: TXT Verification */}
              {!domainVerified && verificationToken && (
                <Card className="border-2 border-dashed border-amber-300 bg-amber-50/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Info className="h-5 w-5 text-amber-600" />
                      DNS Verification Instructions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg bg-card border p-4 space-y-3">
                      <p className="text-sm text-muted-foreground">
                        <strong>Step 1:</strong> Add the following TXT record to your domain's DNS settings at your domain provider (like GoDaddy, Namecheap, Hostinger, Cloudflare, etc.)
                      </p>

                      <div className="space-y-3">
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-medium text-muted-foreground w-20">Type</span>
                          <span className="rounded bg-primary/10 px-3 py-1 text-sm font-bold text-primary">TXT</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-medium text-muted-foreground w-20">Name/Host</span>
                          <code className="rounded bg-muted px-3 py-1 text-sm font-mono">@</code>
                          <span className="text-xs text-muted-foreground">(or your domain name)</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-medium text-muted-foreground w-20">Value</span>
                          <code className="rounded bg-foreground text-background px-3 py-1.5 text-sm font-mono">
                            store-verify={verificationToken}
                          </code>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1.5 text-xs"
                            onClick={() => copyToClipboard(`store-verify=${verificationToken}`)}
                          >
                            <Copy className="h-3 w-3" />
                            Copy
                          </Button>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-medium text-muted-foreground w-20">TTL</span>
                          <code className="rounded bg-muted px-3 py-1 text-sm font-mono">3600</code>
                          <span className="text-xs text-muted-foreground">(or default)</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 rounded-lg bg-amber-100/50 border border-amber-200 p-3">
                      <Clock className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                      <p className="text-sm text-muted-foreground">
                        <strong>Note:</strong> After adding the record, DNS propagation may take a few minutes to several hours. Click the verify button below to check.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button onClick={handleVerify} disabled={verifying} className="gap-2">
                        {verifying ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                        Verify Now
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={`https://dnschecker.org/#TXT/${savedDomain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="gap-1.5"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Check DNS Propagation
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Step 2: CNAME Setup (shown after verification) */}
              {domainVerified && (
                <div className="rounded-xl border-2 border-dashed border-primary/20 bg-muted/30 p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-foreground">DNS Configuration (Step 2)</h3>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Domain verified! Now add these CNAME records to point your domain to your store:
                  </p>

                  <div className="space-y-2">
                    {dnsRecords.map((record, i) => (
                      <DnsRecordRow key={i} record={record} onCopy={copyToClipboard} />
                    ))}
                  </div>

                  <div className="rounded-lg bg-card border p-4 space-y-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Setup Steps
                    </h4>
                    <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                      <li>Go to <strong>DNS Settings</strong> at your domain registrar</li>
                      <li>Add a <strong>CNAME Record</strong> with Name: <code className="bg-muted px-1 rounded text-xs">@</code> and Value: <code className="bg-muted px-1 rounded text-xs">{CNAME_TARGET}</code></li>
                      <li>Add another <strong>CNAME Record</strong> with Name: <code className="bg-muted px-1 rounded text-xs">www</code> and Value: <code className="bg-muted px-1 rounded text-xs">{CNAME_TARGET}</code></li>
                      <li>Delete any existing A or CNAME records for <code className="bg-muted px-1 rounded text-xs">@</code> and <code className="bg-muted px-1 rounded text-xs">www</code></li>
                      <li>Save and wait for DNS propagation (5–30 minutes, max 48 hours)</li>
                    </ol>
                  </div>

                  <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-destructive" />
                      <p className="text-sm font-semibold text-destructive">Important Notes</p>
                    </div>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                      <li>If using Cloudflare, set DNS records to <strong>DNS-only (grey cloud)</strong></li>
                      <li>Remove any conflicting A, AAAA, or CNAME records</li>
                      <li>SSL certificate will be provisioned automatically after DNS is active</li>
                    </ul>
                  </div>

                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={`https://dnschecker.org/#CNAME/${savedDomain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="gap-1.5"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Check DNS Propagation
                    </a>
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alternative URL */}
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
