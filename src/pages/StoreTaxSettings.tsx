import { useState, useEffect } from "react";
import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";
import { useStorePurge } from "@/hooks/useStorePurge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Receipt } from "lucide-react";

export default function StoreTaxSettings() {
  const { storeId } = useStoreSlugParam();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const purgeStore = useStorePurge(storeId);

  const [taxName, setTaxName] = useState("GST");
  const [taxRate, setTaxRate] = useState("0");
  const [isInclusive, setIsInclusive] = useState(false);
  const [isActive, setIsActive] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ["tax-config", storeId],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_tax_config")
        .select("*")
        .eq("store_id", storeId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId && !!user,
  });

  useEffect(() => {
    if (config) {
      setTaxName(config.tax_name ?? "GST");
      setTaxRate(String(config.tax_rate ?? 0));
      setIsInclusive(config.is_inclusive ?? false);
      setIsActive(config.is_active ?? false);
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        store_id: storeId!,
        tax_name: taxName.trim() || "Tax",
        tax_rate: Number(taxRate) || 0,
        is_inclusive: isInclusive,
        is_active: isActive,
      };
      if (config?.id) {
        const { error } = await (supabase as any).from("store_tax_config").update(payload).eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("store_tax_config").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-config", storeId] });
      toast.success("Tax settings saved");
      purgeStore();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tax / GST Settings</h1>
        <p className="text-sm text-muted-foreground">Configure tax for your store orders</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Tax Configuration</CardTitle>
          <CardDescription>Add a tax rate that applies to all orders.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <Label>Enable Tax</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tax Name</Label>
              <Input value={taxName} onChange={(e) => setTaxName(e.target.value)} placeholder="GST" maxLength={20} />
            </div>
            <div className="space-y-2">
              <Label>Tax Rate (%)</Label>
              <Input type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} min="0" max="100" step="0.01" placeholder="18" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={isInclusive} onCheckedChange={setIsInclusive} id="inclusive" />
            <Label htmlFor="inclusive">Prices are tax-inclusive (tax included in product price)</Label>
          </div>

          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Tax Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
