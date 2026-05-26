import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Settings, Save, MessageSquare, Eye, EyeOff, Cloud, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD"];

export default function AdminSettings() {
  const queryClient = useQueryClient();
  const [platformName, setPlatformName] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("INR");
  const [waPhoneNumberId, setWaPhoneNumberId] = useState("");
  const [waAccessToken, setWaAccessToken] = useState("");
  const [waBusinessPhone, setWaBusinessPhone] = useState("");
  const [showToken, setShowToken] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ["platform-config"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("platform_config")
        .select("id, platform_name, default_currency, wa_phone_number_id, wa_access_token, wa_business_phone")
        .limit(1)
        .single();
      if (error) throw error;
      return data as { id: string; platform_name: string; default_currency: string; wa_phone_number_id: string | null; wa_access_token: string | null; wa_business_phone: string | null };
    },
  });

  useEffect(() => {
    if (config) {
      setPlatformName(config.platform_name);
      setDefaultCurrency(config.default_currency);
      setWaPhoneNumberId(config.wa_phone_number_id || "");
      setWaAccessToken(config.wa_access_token || "");
      setWaBusinessPhone(config.wa_business_phone || "");
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!config?.id) throw new Error("No config found");
      const updatePayload: Record<string, string | null> = {
        platform_name: platformName,
        default_currency: defaultCurrency,
        wa_phone_number_id: waPhoneNumberId || null,
        wa_business_phone: waBusinessPhone || null,
        updated_at: new Date().toISOString(),
      };
      if (waAccessToken.trim()) updatePayload.wa_access_token = waAccessToken.trim();

      const { error } = await (supabase as any)
        .from("platform_config")
        .update(updatePayload)
        .eq("id", config.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-config"] });
      toast.success("Settings saved");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Platform Settings</h1>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4" /> General Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="platform-name">Platform Name</Label>
            <Input
              id="platform-name"
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              placeholder="e.g. Storiva"
              maxLength={50}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="default-currency">Default Currency</Label>
            <Select value={defaultCurrency} onValueChange={setDefaultCurrency} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4 text-green-600" /> Platform WhatsApp (ShopBanao Marketing)
          </CardTitle>
          <CardDescription>
            These credentials are used for stores using ShopBanao Marketing mode. All automated messages will be sent from this number.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Phone Number ID</Label>
            <Input
              value={waPhoneNumberId}
              onChange={(e) => setWaPhoneNumberId(e.target.value)}
              placeholder="1234567890"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label>Access Token</Label>
            <div className="relative">
              <Input
                type={showToken ? "text" : "password"}
                value={waAccessToken}
                onChange={(e) => setWaAccessToken(e.target.value)}
                placeholder="EAAxxxxxxx..."
                disabled={isLoading}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Business Phone Display</Label>
            <Input
              value={waBusinessPhone}
              onChange={(e) => setWaBusinessPhone(e.target.value)}
              placeholder="+91 98765 43210"
              disabled={isLoading}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            R2 Image Migration
          </CardTitle>
          <CardDescription>
            Move existing images from Supabase Storage to Cloudflare R2 (cdn.shopbanao.in).
            Run in batches until "remaining" reaches 0. Safe to re-run.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <R2MigrationPanel />
        </CardContent>
      </Card>

      <div className="max-w-lg">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || isLoading}>
          <Save className="mr-2 h-4 w-4" />
          {saveMutation.isPending ? "Saving..." : "Save All Settings"}
        </Button>
      </div>
    </div>
  );
}

function R2MigrationPanel() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    migrated: number;
    skipped: number;
    error_count: number;
    total_remaining: number;
    errors: string[];
    dry_run?: boolean;
  } | null>(null);

  const run = async (dryRun: boolean) => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("r2-migrate-images", {
        body: { batch_size: 25, dry_run: dryRun },
      });
      if (error) throw error;
      setResult(data);
      if (dryRun) {
        toast.info(`${data.total_remaining} images remain to migrate`);
      } else {
        toast.success(`Migrated ${data.migrated}, ${data.total_remaining} remaining`);
      }
    } catch (err) {
      toast.error(`Migration failed: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setRunning(false);
    }
  };

  const runAll = async () => {
    setRunning(true);
    let totalMigrated = 0;
    try {
      for (let i = 0; i < 80; i++) {
        const { data, error } = await supabase.functions.invoke("r2-migrate-images", {
          body: { batch_size: 25 },
        });
        if (error) throw error;
        setResult(data);
        totalMigrated += data.migrated || 0;
        if ((data.total_remaining || 0) === 0) break;
        if ((data.migrated || 0) === 0) break; // no progress — stop
      }
      toast.success(`Done — migrated ${totalMigrated} total`);
    } catch (err) {
      toast.error(`Migration failed: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setRunning(false);
    }
  };

  const copyDemo = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("r2-migrate-images", {
        body: { action: "copy-demo-assets" },
      });
      if (error) throw error;
      toast.success(`Demo assets: copied ${data.copied?.length || 0}, failed ${data.failed?.length || 0}`);
    } catch (err) {
      toast.error(`Demo copy failed: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => run(true)} disabled={running}>
          {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Check remaining
        </Button>
        <Button onClick={() => run(false)} disabled={running}>
          {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Cloud className="mr-2 h-4 w-4" />}
          Migrate next batch (25)
        </Button>
        <Button variant="default" onClick={runAll} disabled={running}>
          {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Cloud className="mr-2 h-4 w-4" />}
          Migrate ALL (auto-loop)
        </Button>
        <Button variant="outline" onClick={copyDemo} disabled={running}>
          Copy demo seed assets
        </Button>
      </div>

      {result && (
        <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
          {result.dry_run && <div className="font-medium">Dry run</div>}
          <div>Migrated this batch: <span className="font-semibold">{result.migrated}</span></div>
          <div>Skipped: {result.skipped}</div>
          <div>Errors: {result.error_count}</div>
          <div>
            Total remaining:{" "}
            <span className={result.total_remaining === 0 ? "font-semibold text-green-600" : "font-semibold"}>
              {result.total_remaining}
            </span>
          </div>
          {result.errors.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-destructive">View errors</summary>
              <ul className="mt-2 list-disc pl-5 text-xs">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
