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
      const { data, error } = await (supabase as any).from("platform_config").select("*").limit(1).single();
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
      const { error } = await (supabase as any)
        .from("platform_config")
        .update({
          platform_name: platformName,
          default_currency: defaultCurrency,
          wa_phone_number_id: waPhoneNumberId || null,
          wa_access_token: waAccessToken || null,
          wa_business_phone: waBusinessPhone || null,
          updated_at: new Date().toISOString(),
        })
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

      <div className="max-w-lg">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || isLoading}>
          <Save className="mr-2 h-4 w-4" />
          {saveMutation.isPending ? "Saving..." : "Save All Settings"}
        </Button>
      </div>
    </div>
  );
}
