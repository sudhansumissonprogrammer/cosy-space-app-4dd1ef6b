// src/components/dashboard/PushNotificationManager.tsx
// Settings card to enable/disable push notifications on the current device.

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, Smartphone, AlertCircle, CheckCircle2, Loader2, Volume2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  isPushSupported,
  getPushPermission,
  subscribePush,
  unsubscribePush,
  isCurrentDeviceSubscribed,
  sendTestPush,
  installForegroundPushListener,
} from "@/lib/ownerPush";

interface DeviceRow {
  id: string;
  device_label: string | null;
  enabled: boolean;
  last_used_at: string;
  endpoint: string;
}

interface Props {
  storeId?: string;
}

export default function PushNotificationManager({ storeId }: Props) {
  const { toast } = useToast();
  const [supported, setSupported] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [thisDeviceSubscribed, setThisDeviceSubscribed] = useState(false);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [thisEndpoint, setThisEndpoint] = useState<string | null>(null);

  useEffect(() => {
    setSupported(isPushSupported());
    setPermission(getPushPermission());
    isCurrentDeviceSubscribed().then(setThisDeviceSubscribed);
    refreshDevices();
    const cleanup = installForegroundPushListener();

    // Get current device endpoint to mark it in the list
    if (isPushSupported()) {
      navigator.serviceWorker.ready
        .then((r) => r.pushManager.getSubscription())
        .then((s) => setThisEndpoint(s?.endpoint || null))
        .catch(() => {});
    }
    return cleanup;
  }, []);

  async function refreshDevices() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return;
    const { data } = await supabase
      .from("push_subscriptions")
      .select("id, device_label, enabled, last_used_at, endpoint")
      .eq("user_id", auth.user.id)
      .order("last_used_at", { ascending: false });
    setDevices((data || []) as DeviceRow[]);
  }

  async function handleEnable() {
    setLoading(true);
    const res = await subscribePush(storeId);
    setLoading(false);
    if (!res.ok) {
      const msgs: Record<string, string> = {
        unsupported: "Your browser does not support push notifications.",
        iframe_blocked:
          "Notifications can't be enabled inside the Lovable preview. Please open your live site (shopbanao.in or your custom domain) and enable from there.",
        not_authenticated: "Please sign in first.",
        permission_denied:
          "Notification permission was blocked. Enable it in your browser settings to receive order alerts.",
      };
      toast({
        title: "Couldn't enable notifications",
        description: msgs[res.reason || ""] || res.reason || "Unknown error",
        variant: "destructive",
      });
      return;
    }
    setThisDeviceSubscribed(true);
    setPermission(getPushPermission());
    await refreshDevices();
    const reg = await navigator.serviceWorker.ready;
    const s = await reg.pushManager.getSubscription();
    setThisEndpoint(s?.endpoint || null);
    toast({
      title: "🔔 Notifications enabled",
      description: "You'll get instant alerts on this device for new orders.",
    });
  }

  async function handleDisable() {
    setLoading(true);
    await unsubscribePush();
    setLoading(false);
    setThisDeviceSubscribed(false);
    setThisEndpoint(null);
    await refreshDevices();
    toast({ title: "Notifications disabled on this device" });
  }

  async function handleTest() {
    setTesting(true);
    const res = await sendTestPush();
    setTesting(false);
    toast({
      title: res.ok ? "Test sent ✅" : "Test failed",
      description: res.message,
      variant: res.ok ? "default" : "destructive",
    });
  }

  async function toggleDevice(id: string, enabled: boolean) {
    await supabase.from("push_subscriptions").update({ enabled }).eq("id", id);
    await refreshDevices();
  }

  async function removeDevice(id: string) {
    await supabase.from("push_subscriptions").delete().eq("id", id);
    await refreshDevices();
    // If this was the current device, also unsubscribe locally
    const dev = devices.find((d) => d.id === id);
    if (dev?.endpoint === thisEndpoint) {
      await unsubscribePush();
      setThisDeviceSubscribed(false);
      setThisEndpoint(null);
    }
  }

  if (!supported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BellOff className="h-5 w-5 text-muted-foreground" /> Push Notifications
          </CardTitle>
          <CardDescription>Not supported on this browser/device</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Try Chrome on Android, or install the app to your home screen on iOS 16.4+.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5 text-primary" /> Push Notifications
        </CardTitle>
        <CardDescription>
          Get instant alerts on your phone the moment a customer places an order — like Shopify.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Current device controls */}
        <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <Smartphone className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold">This device</p>
              <p className="text-xs text-muted-foreground">
                {thisDeviceSubscribed ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="h-3 w-3" /> Receiving notifications
                  </span>
                ) : permission === "denied" ? (
                  <span className="inline-flex items-center gap-1 text-destructive">
                    <AlertCircle className="h-3 w-3" /> Blocked — enable in browser settings
                  </span>
                ) : (
                  "Not enabled"
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {thisDeviceSubscribed ? (
              <>
                <Button size="sm" variant="outline" onClick={handleTest} disabled={testing}>
                  {testing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                  <span className="ml-1">Test</span>
                </Button>
                <Button size="sm" variant="outline" onClick={handleDisable} disabled={loading}>
                  Disable
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={handleEnable} disabled={loading || permission === "denied"}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enable"}
              </Button>
            )}
          </div>
        </div>

        {/* Device list */}
        {devices.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Your devices ({devices.length})
            </p>
            <div className="space-y-2">
              {devices.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Smartphone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {d.device_label || "Unknown device"}
                        {d.endpoint === thisEndpoint && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            This device
                          </Badge>
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Last used: {new Date(d.last_used_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={d.enabled}
                      onCheckedChange={(v) => toggleDevice(d.id, v)}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeDevice(d.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          📱 Tip: Install ShopBanao to your home screen to get app-like notifications even when
          the browser is closed. iOS requires iOS 16.4+ and home-screen install.
        </p>
      </CardContent>
    </Card>
  );
}
