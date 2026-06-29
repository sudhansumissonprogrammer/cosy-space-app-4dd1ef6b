import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Settings, Save, MessageSquare, Cloud, Loader2, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD"];

export default function AdminSettings() {
  useDocumentTitle("Settings · Admin");
  const queryClient = useQueryClient();
  const [platformName, setPlatformName] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("INR");

  const { data: config, isLoading } = useQuery({
    queryKey: ["platform-config"],
    queryFn: async () => {
      // ⚠️ Never select the WhatsApp access token from the client.
      // That lives behind a secure RPC inside Admin → WhatsApp → Platform.
      const { data, error } = await (supabase as any)
        .from("platform_config")
        .select("id, platform_name, default_currency")
        .limit(1)
        .single();
      if (error) throw error;
      return data as { id: string; platform_name: string; default_currency: string };
    },
  });

  useEffect(() => {
    if (config) {
      setPlatformName(config.platform_name);
      setDefaultCurrency(config.default_currency);
    }
  }, [config]);

  const saveGeneral = useMutation({
    mutationFn: async () => {
      if (!config?.id) throw new Error("No config found");
      const { error } = await (supabase as any)
        .from("platform_config")
        .update({
          platform_name: platformName,
          default_currency: defaultCurrency,
          updated_at: new Date().toISOString(),
        })
        .eq("id", config.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-config"] });
      queryClient.invalidateQueries({ queryKey: ["platform-config-currency"] });
      toast.success("General settings saved");
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
          <Button onClick={() => saveGeneral.mutate()} disabled={saveGeneral.isPending || isLoading} size="sm">
            <Save className="mr-2 h-4 w-4" />
            {saveGeneral.isPending ? "Saving..." : "Save General"}
          </Button>
        </CardContent>
      </Card>

      {/* WhatsApp credentials moved to Admin → WhatsApp → Platform tab.
          Keeping a single source of truth: secure RPC, masked token, app secret,
          pilot cohort, tier limits, health log — all in one place. */}
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4 text-green-600" /> Platform WhatsApp
          </CardTitle>
          <CardDescription>
            WhatsApp credentials, templates, queue, health and the master kill switch
            are managed in a single secure panel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="sm" variant="default">
            <Link to="/admin/whatsapp">
              Open WhatsApp Admin <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
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
