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
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                <Globe className="h-4 w-4 shrink-0 text-primary" />
                <code className="flex-1 text-sm font-medium">{savedDomain}</code>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={removeDomain}>
                  Remove
                </Button>
              </div>

              <Card className="border-2 border-[#25D366]/30 bg-[#25D366]/5">
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-[#25D366]" />
                    <h3 className="font-semibold text-foreground">Domain Saved Successfully!</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    To complete the domain configuration, please contact us on WhatsApp. We'll set up DNS routing and SSL for <strong>{savedDomain}</strong>.
                  </p>
                  <Button asChild className="gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white">
                    <a
                      href={`https://wa.me/919692282485?text=${encodeURIComponent(`Hi! I want to configure my custom domain *${savedDomain}* for my store "${store?.name}". Store ID: ${storeId}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <svg viewBox="0 0 32 32" fill="currentColor" className="h-5 w-5">
                        <path d="M16.004 3.2C9.056 3.2 3.406 8.848 3.404 15.8c-.001 2.222.58 4.392 1.683 6.303L3.2 28.8l6.867-1.802A12.56 12.56 0 0 0 16 28.398h.005C22.95 28.398 28.6 22.75 28.6 15.8 28.6 8.85 22.95 3.2 16.004 3.2Zm0 22.997h-.004a10.44 10.44 0 0 1-5.318-1.457l-.382-.226-3.955 1.038 1.055-3.858-.249-.395A10.42 10.42 0 0 1 5.54 15.8c.002-5.77 4.697-10.463 10.466-10.463 5.77 0 10.463 4.695 10.463 10.464 0 5.77-4.695 10.465-10.465 10.465v-.069Zm5.74-7.835c-.315-.158-1.863-.92-2.152-1.025-.289-.105-.499-.158-.71.158-.21.315-.815 1.025-.999 1.236-.184.21-.368.236-.683.079-.315-.158-1.33-.49-2.533-1.562-.937-.835-1.568-1.867-1.752-2.182-.184-.315-.02-.486.138-.643.142-.141.315-.368.473-.552.158-.184.21-.315.315-.526.106-.21.053-.394-.026-.552-.079-.158-.71-1.71-.973-2.341-.256-.615-.517-.532-.71-.542-.184-.008-.394-.01-.604-.01s-.552.079-.841.394c-.29.315-1.104 1.078-1.104 2.63 0 1.552 1.13 3.052 1.288 3.262.158.21 2.224 3.396 5.388 4.762.753.326 1.341.52 1.8.665.756.24 1.444.206 1.988.125.607-.09 1.863-.762 2.126-1.498.263-.736.263-1.367.184-1.498-.079-.132-.289-.21-.604-.369Z" />
                      </svg>
                      Chat on WhatsApp to Configure
                    </a>
                  </Button>
                </CardContent>
              </Card>
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
