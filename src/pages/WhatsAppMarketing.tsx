import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import {
  MessageSquare, Settings, BarChart3, Send, Phone, CheckCircle2,
  XCircle, Clock, AlertCircle, Zap, ShoppingCart, Package, Users,
  TrendingUp, Eye, EyeOff,
} from "lucide-react";

// ─── Setup Tab ───────────────────────────────────────────────────────
function SetupTab({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const [showToken, setShowToken] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);
  const [form, setForm] = useState({
    access_token: "",
    phone_number_id: "",
    waba_id: "",
    business_phone: "",
  });

  const { data: config, isLoading } = useQuery({
    queryKey: ["whatsapp-config", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_config")
        .select("*")
        .eq("store_id", storeId)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setForm({
          access_token: (data as any).access_token || "",
          phone_number_id: (data as any).phone_number_id || "",
          waba_id: (data as any).waba_id || "",
          business_phone: (data as any).business_phone || "",
        });
      }
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (config) {
        const { error } = await supabase
          .from("whatsapp_config")
          .update({
            access_token: form.access_token,
            phone_number_id: form.phone_number_id,
            waba_id: form.waba_id,
            business_phone: form.business_phone,
          })
          .eq("id", (config as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("whatsapp_config").insert({
          store_id: storeId,
          access_token: form.access_token,
          phone_number_id: form.phone_number_id,
          waba_id: form.waba_id,
          business_phone: form.business_phone,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-config", storeId] });
      toast({ title: "WhatsApp API configured!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5" />
            Meta WhatsApp Business API
          </CardTitle>
          <CardDescription>
            Connect your WhatsApp Business account to send automated messages.
            Get credentials from{" "}
            <a
              href="https://developers.facebook.com/apps/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Meta Developer Portal
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Permanent Access Token</Label>
            <div className="relative">
              <Input
                type={showToken ? "text" : "password"}
                value={form.access_token}
                onChange={(e) => setForm({ ...form, access_token: e.target.value })}
                placeholder="EAAxxxxxxx..."
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
            <Label>Phone Number ID</Label>
            <Input
              value={form.phone_number_id}
              onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })}
              placeholder="1234567890"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>WABA ID (optional)</Label>
              <Input
                value={form.waba_id}
                onChange={(e) => setForm({ ...form, waba_id: e.target.value })}
                placeholder="1234567890"
              />
            </div>
            <div className="space-y-2">
              <Label>Business Phone Display</Label>
              <Input
                value={form.business_phone}
                onChange={(e) => setForm({ ...form, business_phone: e.target.value })}
                placeholder="+91 98765 43210"
              />
            </div>
          </div>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!form.access_token || !form.phone_number_id || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : config ? "Update Configuration" : "Save & Connect"}
          </Button>
          {config && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span>WhatsApp API Connected</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How to get your API credentials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal pl-5 space-y-2">
            <li>Go to <a href="https://business.facebook.com/" target="_blank" className="text-primary underline">Meta Business Suite</a> and create a Business Account</li>
            <li>Go to <a href="https://developers.facebook.com/apps/" target="_blank" className="text-primary underline">Meta Developer Portal</a> → Create App → Business type</li>
            <li>Add the <strong>WhatsApp</strong> product to your app</li>
            <li>Under WhatsApp → API Setup, get your <strong>Phone Number ID</strong> and <strong>Temporary Access Token</strong></li>
            <li>For production, generate a <strong>Permanent Token</strong> from System Users in Business Settings</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Chat Tab ───────────────────────────────────────────────────────
function ChatTab({ storeId }: { storeId: string }) {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const { data: recentMessages } = useQuery({
    queryKey: ["whatsapp-messages", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const sendMessage = async () => {
    if (!phone || !message) return;
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("whatsapp-send", {
        body: {
          store_id: storeId,
          recipient_phone: phone,
          message_body: message,
          message_type: "manual",
        },
      });
      if (res.error) throw res.error;
      toast({ title: "Message sent!" });
      setMessage("");
    } catch (e: any) {
      toast({ title: "Failed to send", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "sent": return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
      case "failed": return <XCircle className="h-3.5 w-3.5 text-red-500" />;
      case "delivered": return <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />;
      default: return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Send className="h-5 w-5" />
            Send Message
          </CardTitle>
          <CardDescription>Send a direct WhatsApp message to any customer</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Recipient Phone Number</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
            />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here..."
              rows={4}
            />
          </div>
          <Button onClick={sendMessage} disabled={sending || !phone || !message}>
            <Send className="mr-2 h-4 w-4" />
            {sending ? "Sending..." : "Send WhatsApp Message"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Messages</CardTitle>
        </CardHeader>
        <CardContent>
          {!recentMessages?.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No messages sent yet</p>
          ) : (
            <div className="space-y-3">
              {recentMessages.map((msg: any) => (
                <div key={msg.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <div className="mt-0.5">{statusIcon(msg.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{msg.recipient_phone}</span>
                      <Badge variant="outline" className="text-[10px]">{msg.message_type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">{msg.message_body}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {new Date(msg.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Automations Tab ─────────────────────────────────────────────────
function AutomationsTab({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const [templates, setTemplates] = useState({
    order_confirmation: { enabled: true, body: "Hi {{name}}, thank you for your order #{{order_id}}! Total: {{total}}. We'll update you on shipping." },
    shipping_update: { enabled: true, body: "Hi {{name}}, your order #{{order_id}} has been shipped! Track it here: {{tracking_url}}" },
    abandoned_cart: { enabled: true, body: "Hi {{name}}, you left items in your cart! Complete your order now and get free shipping 🛒" },
    delivery_confirmation: { enabled: true, body: "Hi {{name}}, your order #{{order_id}} has been delivered! Thank you for shopping with us ❤️" },
  });

  const { data: savedTemplates } = useQuery({
    queryKey: ["whatsapp-templates", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .eq("store_id", storeId);
      if (error) throw error;
      if (data?.length) {
        const updated = { ...templates };
        data.forEach((t: any) => {
          if (updated[t.template_type as keyof typeof updated]) {
            updated[t.template_type as keyof typeof updated] = {
              enabled: t.is_active,
              body: t.body_text,
            };
          }
        });
        setTemplates(updated);
      }
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const [type, config] of Object.entries(templates)) {
        const existing = savedTemplates?.find((t: any) => t.template_type === type);
        if (existing) {
          await supabase
            .from("whatsapp_templates")
            .update({ body_text: config.body, is_active: config.enabled })
            .eq("id", (existing as any).id);
        } else {
          await supabase.from("whatsapp_templates").insert({
            store_id: storeId,
            template_name: type,
            template_type: type,
            body_text: config.body,
            is_active: config.enabled,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates", storeId] });
      toast({ title: "Automation templates saved!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const templateLabels: Record<string, { label: string; icon: React.ElementType; desc: string }> = {
    order_confirmation: { label: "Order Confirmation", icon: Package, desc: "Sent when a new order is placed" },
    shipping_update: { label: "Shipping Update", icon: Package, desc: "Sent when order status changes to shipped" },
    abandoned_cart: { label: "Abandoned Cart Recovery", icon: ShoppingCart, desc: "Sent after cart is abandoned for 1 hour" },
    delivery_confirmation: { label: "Delivery Confirmation", icon: CheckCircle2, desc: "Sent when order is delivered" },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Automation Templates</h3>
          <p className="text-sm text-muted-foreground">Configure automatic messages for key events</p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving..." : "Save All"}
        </Button>
      </div>

      {Object.entries(templates).map(([type, config]) => {
        const meta = templateLabels[type];
        return (
          <Card key={type}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <meta.icon className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-base">{meta.label}</CardTitle>
                    <CardDescription className="text-xs">{meta.desc}</CardDescription>
                  </div>
                </div>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(checked) =>
                    setTemplates({ ...templates, [type]: { ...config, enabled: checked } })
                  }
                />
              </div>
            </CardHeader>
            {config.enabled && (
              <CardContent>
                <Textarea
                  value={config.body}
                  onChange={(e) =>
                    setTemplates({ ...templates, [type]: { ...config, body: e.target.value } })
                  }
                  rows={3}
                  className="text-sm"
                />
                <p className="text-[11px] text-muted-foreground mt-2">
                  Variables: {"{{name}}, {{order_id}}, {{total}}, {{tracking_url}}, {{store_name}}"}
                </p>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ─── Analytics Tab ──────────────────────────────────────────────────
function AnalyticsTab({ storeId }: { storeId: string }) {
  const { data: stats } = useQuery({
    queryKey: ["whatsapp-analytics", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("status, message_type, created_at")
        .eq("store_id", storeId);
      if (error) throw error;

      const total = data?.length || 0;
      const sent = data?.filter((m: any) => m.status === "sent").length || 0;
      const failed = data?.filter((m: any) => m.status === "failed").length || 0;
      const delivered = data?.filter((m: any) => m.status === "delivered").length || 0;

      const byType: Record<string, number> = {};
      data?.forEach((m: any) => {
        byType[m.message_type] = (byType[m.message_type] || 0) + 1;
      });

      // Today's messages
      const today = new Date().toISOString().split("T")[0];
      const todayCount = data?.filter((m: any) => m.created_at.startsWith(today)).length || 0;

      // Last 7 days
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const weekCount = data?.filter((m: any) => m.created_at >= weekAgo).length || 0;

      return { total, sent, failed, delivered, byType, todayCount, weekCount };
    },
  });

  const statCards = [
    { label: "Total Messages", value: stats?.total || 0, icon: MessageSquare, color: "text-primary" },
    { label: "Sent Today", value: stats?.todayCount || 0, icon: Send, color: "text-green-600" },
    { label: "This Week", value: stats?.weekCount || 0, icon: TrendingUp, color: "text-blue-600" },
    { label: "Failed", value: stats?.failed || 0, icon: XCircle, color: "text-red-500" },
  ];

  const typeLabels: Record<string, string> = {
    order_confirmation: "Order Confirmations",
    shipping_update: "Shipping Updates",
    abandoned_cart: "Cart Recovery",
    delivery_confirmation: "Delivery Confirmations",
    manual: "Manual Messages",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <s.icon className={`h-5 w-5 ${s.color}`} />
                <span className="text-2xl font-bold">{s.value}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Messages by Type</CardTitle>
        </CardHeader>
        <CardContent>
          {!stats?.byType || Object.keys(stats.byType).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No messages yet</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(stats.byType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm">{typeLabels[type] || type}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 bg-primary/20 rounded-full w-32">
                      <div
                        className="h-2 bg-primary rounded-full"
                        style={{ width: `${Math.min((count / (stats.total || 1)) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────
export default function WhatsAppMarketing() {
  const { storeId } = useParams();

  const { data: config } = useQuery({
    queryKey: ["whatsapp-config", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_config")
        .select("id, is_active")
        .eq("store_id", storeId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  const isConnected = !!config;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-green-600" />
            WhatsApp Marketing
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Send automated messages & manage conversations
          </p>
        </div>
        {isConnected ? (
          <Badge className="bg-green-100 text-green-700 border-green-200">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Connected
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            <AlertCircle className="h-3 w-3 mr-1" /> Not Connected
          </Badge>
        )}
      </div>

      <Tabs defaultValue={isConnected ? "chat" : "setup"}>
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="setup" className="text-xs">
            <Settings className="h-3.5 w-3.5 mr-1" /> Setup
          </TabsTrigger>
          <TabsTrigger value="chat" disabled={!isConnected} className="text-xs">
            <Send className="h-3.5 w-3.5 mr-1" /> Chat
          </TabsTrigger>
          <TabsTrigger value="automations" disabled={!isConnected} className="text-xs">
            <Zap className="h-3.5 w-3.5 mr-1" /> Auto
          </TabsTrigger>
          <TabsTrigger value="analytics" disabled={!isConnected} className="text-xs">
            <BarChart3 className="h-3.5 w-3.5 mr-1" /> Stats
          </TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="mt-4">
          <SetupTab storeId={storeId!} />
        </TabsContent>
        <TabsContent value="chat" className="mt-4">
          <ChatTab storeId={storeId!} />
        </TabsContent>
        <TabsContent value="automations" className="mt-4">
          <AutomationsTab storeId={storeId!} />
        </TabsContent>
        <TabsContent value="analytics" className="mt-4">
          <AnalyticsTab storeId={storeId!} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
