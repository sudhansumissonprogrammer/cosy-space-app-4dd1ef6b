import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Settings, Save } from "lucide-react";
import { useState, useEffect } from "react";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD"];

export default function AdminSettings() {
  const queryClient = useQueryClient();
  const [platformName, setPlatformName] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("INR");

  const { data: config, isLoading } = useQuery({
    queryKey: ["platform-config"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("platform_config").select("*").limit(1).single();
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

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!config?.id) throw new Error("No config found");
      const { error } = await (supabase as any)
        .from("platform_config")
        .update({ platform_name: platformName, default_currency: defaultCurrency, updated_at: new Date().toISOString() })
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

          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || isLoading}>
            <Save className="mr-2 h-4 w-4" />
            {saveMutation.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
