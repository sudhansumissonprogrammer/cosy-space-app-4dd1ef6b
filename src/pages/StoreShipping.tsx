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
import { Loader2, Truck } from "lucide-react";

export default function StoreShipping() {
  const { storeId } = useStoreSlugParam();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [flatRate, setFlatRate] = useState("0");
  const [freeAbove, setFreeAbove] = useState("");
  const [isActive, setIsActive] = useState(true);

  const { data: config, isLoading } = useQuery({
    queryKey: ["shipping-config", storeId],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_shipping_config")
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
      setFlatRate(String(config.flat_rate ?? 0));
      setFreeAbove(config.free_shipping_above != null ? String(config.free_shipping_above) : "");
      setIsActive(config.is_active ?? true);
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        store_id: storeId!,
        flat_rate: Number(flatRate) || 0,
        free_shipping_above: freeAbove ? Number(freeAbove) : null,
        is_active: isActive,
      };
      if (config?.id) {
        const { error } = await (supabase as any).from("store_shipping_config").update(payload).eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("store_shipping_config").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-config", storeId] });
      toast.success("Shipping settings saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Shipping & Delivery</h1>
        <p className="text-sm text-muted-foreground">Configure shipping charges for your store</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Shipping Settings</CardTitle>
          <CardDescription>Set a flat shipping rate and optionally offer free shipping above a threshold.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <Label>Enable Shipping Charges</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Flat Shipping Rate (₹)</Label>
              <Input type="number" value={flatRate} onChange={(e) => setFlatRate(e.target.value)} min="0" placeholder="50" />
              <p className="text-xs text-muted-foreground">Applied to every order</p>
            </div>
            <div className="space-y-2">
              <Label>Free Shipping Above (₹)</Label>
              <Input type="number" value={freeAbove} onChange={(e) => setFreeAbove(e.target.value)} min="0" placeholder="499" />
              <p className="text-xs text-muted-foreground">Leave empty for no free shipping</p>
            </div>
          </div>

          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Shipping Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
