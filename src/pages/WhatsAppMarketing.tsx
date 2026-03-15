import { useState, useMemo } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "@/hooks/use-toast";
import {
  MessageSquare, Settings, BarChart3, Send, Phone, CheckCircle2,
  XCircle, Clock, AlertCircle, Zap, ShoppingCart, Package, Users,
  TrendingUp, Eye, EyeOff, Upload, Megaphone, Trash2, FileText, Plus,
  Ban, CalendarIcon, Target, UserX, Timer, FileCheck, RefreshCw, Loader2,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>WhatsApp API Connected</span>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Test Connection</Label>
                <p className="text-xs text-muted-foreground">Send a test message to verify your API is working</p>
                <div className="flex gap-2">
                  <Input
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    disabled={!testPhone.trim() || testing}
                    onClick={async () => {
                      setTesting(true);
                      try {
                        const res = await supabase.functions.invoke("whatsapp-send", {
                          body: {
                            store_id: storeId,
                            recipient_phone: testPhone.trim(),
                            message_body: "✅ This is a test message from your store dashboard. WhatsApp API is working!",
                            message_type: "manual",
                          },
                        });
                        if (res.error) throw res.error;
                        const data = res.data as any;
                        if (data?.error) throw new Error(data.error);
                        toast({ title: "✅ Test message sent!", description: "Check your WhatsApp for the message" });
                      } catch (e: any) {
                        toast({ title: "❌ Test failed", description: e.message || "Check your credentials", variant: "destructive" });
                      } finally {
                        setTesting(false);
                      }
                    }}
                  >
                    <Send className="mr-1.5 h-4 w-4" />
                    {testing ? "Sending..." : "Send Test"}
                  </Button>
                </div>
              </div>
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

const TEMPLATE_VARIABLES: Record<string, { var: string; label: string }[]> = {
  order_confirmation: [
    { var: "{{name}}", label: "Customer Name" },
    { var: "{{order_id}}", label: "Order ID" },
    { var: "{{total}}", label: "Order Total" },
    { var: "{{product_names}}", label: "Product Names" },
    { var: "{{store_name}}", label: "Store Name" },
    { var: "{{currency}}", label: "Currency" },
  ],
  shipping_update: [
    { var: "{{name}}", label: "Customer Name" },
    { var: "{{order_id}}", label: "Order ID" },
    { var: "{{tracking_url}}", label: "Tracking URL" },
    { var: "{{tracking_number}}", label: "Tracking Number" },
    { var: "{{store_name}}", label: "Store Name" },
    { var: "{{product_names}}", label: "Product Names" },
  ],
  delivery_confirmation: [
    { var: "{{name}}", label: "Customer Name" },
    { var: "{{order_id}}", label: "Order ID" },
    { var: "{{total}}", label: "Order Total" },
    { var: "{{store_name}}", label: "Store Name" },
    { var: "{{product_names}}", label: "Product Names" },
  ],
  abandoned_cart: [
    { var: "{{name}}", label: "Customer Name" },
    { var: "{{product_names}}", label: "Product Names" },
    { var: "{{cart_total}}", label: "Cart Total" },
    { var: "{{store_name}}", label: "Store Name" },
    { var: "{{currency}}", label: "Currency" },
  ],
};

function VariableChips({
  variables,
  onInsert,
}: {
  variables: { var: string; label: string }[];
  onInsert: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      <span className="text-[11px] text-muted-foreground mr-1">Insert:</span>
      {variables.map((v) => (
        <button
          key={v.var}
          type="button"
          onClick={() => onInsert(v.var)}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors cursor-pointer border border-primary/20"
        >
          <Plus className="h-2.5 w-2.5" />
          {v.label}
        </button>
      ))}
    </div>
  );
}

function AutomationsTab({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const [templates, setTemplates] = useState({
    order_confirmation: { enabled: true, body: "Hi {{name}}, thank you for your order #{{order_id}}! 🛍️\n\nItems: {{product_names}}\nTotal: {{total}}\n\nWe'll update you on shipping. — {{store_name}}" },
    shipping_update: { enabled: true, body: "Hi {{name}}, great news! Your order #{{order_id}} has been shipped! 🚚\n\nTrack here: {{tracking_url}}\nTracking #: {{tracking_number}}\n\n— {{store_name}}" },
    abandoned_cart: { enabled: true, body: "Hi {{name}}, you left some amazing items in your cart! 🛒\n\nItems: {{product_names}}\nTotal: {{cart_total}}\n\nComplete your order now before they're gone! — {{store_name}}" },
    delivery_confirmation: { enabled: true, body: "Hi {{name}}, your order #{{order_id}} has been delivered! 🎉\n\nItems: {{product_names}}\nTotal: {{total}}\n\nThank you for shopping with {{store_name}} ❤️" },
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
    order_confirmation: { label: "Order Placed", icon: Package, desc: "Sent when a new order is placed" },
    shipping_update: { label: "Order Shipped", icon: Package, desc: "Sent when order status changes to shipped" },
    abandoned_cart: { label: "Abandoned Cart Recovery", icon: ShoppingCart, desc: "Sent to recover abandoned carts" },
    delivery_confirmation: { label: "Order Delivered", icon: CheckCircle2, desc: "Sent when order is delivered" },
  };

  const insertVariable = (type: string, variable: string) => {
    const current = templates[type as keyof typeof templates];
    setTemplates({
      ...templates,
      [type]: { ...current, body: current.body + variable },
    });
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
        const vars = TEMPLATE_VARIABLES[type] || [];
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
                  rows={4}
                  className="text-sm"
                />
                <VariableChips
                  variables={vars}
                  onInsert={(v) => insertVariable(type, v)}
                />
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

// ─── Bulk Messaging Tab ─────────────────────────────────────────────
function BulkMessagingTab({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const [numbers, setNumbers] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, failed: 0, total: 0 });
  const [csvFileName, setCsvFileName] = useState("");

  const addManualNumbers = () => {
    if (!manualInput.trim()) return;
    const newNumbers = manualInput
      .split(/[\n,;]+/)
      .map((n) => n.replace(/[\s\-()]/g, "").trim())
      .filter((n) => n.length >= 10 && /^\+?\d+$/.test(n));

    const unique = [...new Set([...numbers, ...newNumbers])];
    setNumbers(unique);
    setManualInput("");
    if (newNumbers.length > 0) {
      toast({ title: `Added ${newNumbers.length} numbers`, description: `Total: ${unique.length} recipients` });
    } else {
      toast({ title: "No valid numbers found", description: "Enter phone numbers with country code (e.g. +919876543210)", variant: "destructive" });
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split("\n");
      const extracted: string[] = [];

      for (const line of lines) {
        const cells = line.split(",");
        for (const cell of cells) {
          const cleaned = cell.replace(/[\s\-()\"']/g, "").trim();
          if (cleaned.length >= 10 && /^\+?\d{10,15}$/.test(cleaned)) {
            extracted.push(cleaned);
          }
        }
      }

      const unique = [...new Set([...numbers, ...extracted])];
      setNumbers(unique);
      toast({
        title: `Imported ${extracted.length} numbers from CSV`,
        description: `Total: ${unique.length} recipients`,
      });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const removeNumber = (index: number) => {
    setNumbers(numbers.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setNumbers([]);
    setCsvFileName("");
    toast({ title: "All numbers cleared" });
  };

  const sendBulk = async () => {
    if (!message.trim() || numbers.length === 0) return;
    setSending(true);
    setProgress({ sent: 0, failed: 0, total: numbers.length });

    let sent = 0;
    let failed = 0;

    for (const phone of numbers) {
      try {
        const res = await supabase.functions.invoke("whatsapp-send", {
          body: {
            store_id: storeId,
            recipient_phone: phone,
            message_body: message.trim(),
            message_type: "manual",
          },
        });
        if (res.error || (res.data as any)?.error) {
          failed++;
        } else {
          sent++;
        }
      } catch {
        failed++;
      }
      setProgress({ sent, failed, total: numbers.length });
      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 500));
    }

    setSending(false);
    queryClient.invalidateQueries({ queryKey: ["whatsapp-messages", storeId] });
    queryClient.invalidateQueries({ queryKey: ["whatsapp-analytics", storeId] });
    toast({
      title: "Bulk send complete!",
      description: `✅ ${sent} sent, ❌ ${failed} failed out of ${numbers.length}`,
    });
  };

  const progressPercent = progress.total > 0 ? ((progress.sent + progress.failed) / progress.total) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Add Numbers Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Recipients ({numbers.length})
          </CardTitle>
          <CardDescription>Add phone numbers manually or import from a CSV file</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Manual Entry */}
          <div className="space-y-2">
            <Label>Add Numbers Manually</Label>
            <Textarea
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder={"Enter phone numbers (one per line or comma-separated)\ne.g.\n+919876543210\n+918765432109, +917654321098"}
              rows={3}
              className="text-sm"
            />
            <Button variant="outline" size="sm" onClick={addManualNumbers} disabled={!manualInput.trim()}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Numbers
            </Button>
          </div>

          <div className="relative flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">OR</span>
            <Separator className="flex-1" />
          </div>

          {/* CSV Upload */}
          <div className="space-y-2">
            <Label>Import from CSV</Label>
            <p className="text-xs text-muted-foreground">
              Upload a CSV file with phone numbers. Any column containing valid phone numbers will be detected automatically.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <label className="cursor-pointer">
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  {csvFileName || "Choose CSV File"}
                  <input type="file" accept=".csv,.txt" className="hidden" onChange={handleCsvUpload} />
                </label>
              </Button>
              {csvFileName && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="h-3 w-3" /> {csvFileName}
                </span>
              )}
            </div>
          </div>

          {/* Numbers List */}
          {numbers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">{numbers.length} Recipients</Label>
                <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs text-destructive hover:text-destructive">
                  <Trash2 className="mr-1 h-3 w-3" /> Clear All
                </Button>
              </div>
              <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                {numbers.map((num, i) => (
                  <div key={i} className="flex items-center justify-between bg-muted/50 rounded px-2 py-1 text-sm">
                    <span className="font-mono text-xs">{num}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeNumber(i)}>
                      <XCircle className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compose & Send */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Megaphone className="h-5 w-5" />
            Compose Bulk Message
          </CardTitle>
          <CardDescription>This message will be sent to all {numbers.length} recipients. Use variables to personalize.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Templates */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Quick Templates</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "🎉 New Arrival", body: "Hi! 🎉 Check out our latest arrivals at {{store_name}}! Shop now before they're gone." },
                { label: "🏷️ Sale Alert", body: "Hi! 🏷️ Exciting sale at {{store_name}}! Get amazing discounts on {{product_names}}. Shop now!" },
                { label: "📦 Restock", body: "Hi! 📦 Great news! Popular items are back in stock at {{store_name}}. Grab yours before they sell out!" },
                { label: "💌 Thank You", body: "Hi {{name}}! 💌 Thank you for being a valued customer of {{store_name}}. Here's a special offer just for you!" },
              ].map((t) => (
                <Button
                  key={t.label}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setMessage(t.body)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your broadcast message here... Use variables like {{name}} to personalize"
              rows={4}
              className="text-sm"
            />
            <VariableChips
              variables={[
                { var: "{{name}}", label: "Customer Name" },
                { var: "{{store_name}}", label: "Store Name" },
                { var: "{{product_names}}", label: "Product Names" },
              ]}
              onInsert={(v) => setMessage((prev) => prev + v)}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              ⚠️ Meta WhatsApp API has rate limits. Messages are sent with a 0.5s delay between each.
            </p>
          </div>

          {sending && (
            <div className="space-y-2">
              <Progress value={progressPercent} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>✅ {progress.sent} sent</span>
                <span>❌ {progress.failed} failed</span>
                <span>{progress.sent + progress.failed}/{progress.total}</span>
              </div>
            </div>
          )}

          <Button
            onClick={sendBulk}
            disabled={sending || numbers.length === 0 || !message.trim()}
            className="w-full"
          >
            <Send className="mr-2 h-4 w-4" />
            {sending
              ? `Sending... (${progress.sent + progress.failed}/${progress.total})`
              : `Send to ${numbers.length} Recipients`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Opt-Out Management Tab ─────────────────────────────────────────
function OptOutTab({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const [manualPhone, setManualPhone] = useState("");

  const { data: optouts, isLoading } = useQuery({
    queryKey: ["whatsapp-optouts", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_optouts")
        .select("*")
        .eq("store_id", storeId)
        .order("opted_out_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const addOptout = async () => {
    if (!manualPhone.trim()) return;
    const phone = manualPhone.replace(/[\s\-()]/g, "");
    const { error } = await (supabase as any)
      .from("whatsapp_optouts")
      .upsert({ store_id: storeId, phone, reason: "manual_add" }, { onConflict: "store_id,phone" });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Number added to opt-out list" });
      setManualPhone("");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-optouts", storeId] });
    }
  };

  const removeOptout = async (id: string) => {
    await (supabase as any).from("whatsapp_optouts").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["whatsapp-optouts", storeId] });
    toast({ title: "Number removed from opt-out list" });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Ban className="h-5 w-5" />
            Opt-Out / Unsubscribe List
          </CardTitle>
          <CardDescription>
            Customers who reply STOP are automatically added here. These numbers are excluded from all bulk messages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={manualPhone}
              onChange={(e) => setManualPhone(e.target.value)}
              placeholder="Manually add phone number..."
              className="flex-1"
            />
            <Button variant="outline" size="sm" onClick={addOptout} disabled={!manualPhone.trim()}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add
            </Button>
          </div>

          <div className="rounded-md border p-1">
            <div className="px-3 py-2 bg-muted/50 rounded text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>{optouts?.length || 0} opted-out numbers</span>
              <span>Auto-excluded from bulk sends</span>
            </div>
            {isLoading ? (
              <p className="text-center py-4 text-sm text-muted-foreground">Loading...</p>
            ) : !optouts?.length ? (
              <p className="text-center py-6 text-sm text-muted-foreground">No opt-outs yet</p>
            ) : (
              <div className="max-h-60 overflow-y-auto divide-y">
                {optouts.map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div>
                      <span className="font-mono">{o.phone}</span>
                      <span className="text-[11px] text-muted-foreground ml-2">
                        {o.reason === "customer_reply_stop" ? "Replied STOP" : "Manual"}
                      </span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeOptout(o.id)}>
                      <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook Setup</CardTitle>
          <CardDescription className="text-xs">
            To auto-detect STOP replies, configure this webhook URL in your Meta App Dashboard:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="rounded bg-muted p-3 text-xs font-mono break-all select-all">
            {`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/whatsapp-webhook`}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Verify Token: <code className="bg-muted px-1 rounded">storivo_webhook_verify</code>
          </p>
          <p className="text-[11px] text-muted-foreground">
            Subscribe to: <strong>messages</strong> and <strong>message_deliveries</strong>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Customer Segmentation Tab ──────────────────────────────────────
function SegmentationTab({ storeId }: { storeId: string }) {
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [segmentPhones, setSegmentPhones] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const segments = [
    { id: "all_customers", label: "All Customers", icon: Users, desc: "Every customer with a phone number", color: "text-blue-500" },
    { id: "repeat_buyers", label: "Repeat Buyers", icon: TrendingUp, desc: "Customers with 2+ orders", color: "text-green-500" },
    { id: "high_value", label: "High Value", icon: Package, desc: "Orders above ₹1000 total", color: "text-purple-500" },
    { id: "recent_buyers", label: "Recent Buyers", icon: Clock, desc: "Ordered in last 7 days", color: "text-orange-500" },
    { id: "inactive", label: "Inactive Customers", icon: UserX, desc: "No orders in last 30 days", color: "text-red-500" },
  ];

  const loadSegment = async (segmentId: string) => {
    setLoading(true);
    setSelectedSegment(segmentId);

    try {
      let query = (supabase as any).from("orders")
        .select("customer_phone, customer_name, total, created_at")
        .eq("store_id", storeId)
        .not("customer_phone", "is", null);

      if (segmentId === "recent_buyers") {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte("created_at", weekAgo);
      }

      const { data, error } = await query;
      if (error) throw error;

      let phones: string[] = [];
      const orders = data || [];

      if (segmentId === "all_customers") {
        phones = [...new Set(orders.map((o: any) => o.customer_phone).filter(Boolean))] as string[];
      } else if (segmentId === "repeat_buyers") {
        const counts: Record<string, number> = {};
        orders.forEach((o: any) => { counts[o.customer_phone] = (counts[o.customer_phone] || 0) + 1; });
        phones = Object.entries(counts).filter(([_, c]) => c >= 2).map(([p]) => p);
      } else if (segmentId === "high_value") {
        const totals: Record<string, number> = {};
        orders.forEach((o: any) => { totals[o.customer_phone] = (totals[o.customer_phone] || 0) + Number(o.total); });
        phones = Object.entries(totals).filter(([_, t]) => t >= 1000).map(([p]) => p);
      } else if (segmentId === "recent_buyers") {
        phones = [...new Set(orders.map((o: any) => o.customer_phone).filter(Boolean))] as string[];
      } else if (segmentId === "inactive") {
        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const recentPhones = new Set(
          orders.filter((o: any) => o.created_at >= monthAgo).map((o: any) => o.customer_phone)
        );
        const allPhones = [...new Set(orders.map((o: any) => o.customer_phone).filter(Boolean))] as string[];
        phones = allPhones.filter((p) => !recentPhones.has(p));
      }

      // Filter out opted-out numbers
      const { data: optouts } = await (supabase as any)
        .from("whatsapp_optouts")
        .select("phone")
        .eq("store_id", storeId);
      const optedOut = new Set((optouts || []).map((o: any) => o.phone));
      phones = phones.filter((p) => !optedOut.has(p.replace(/[\s\-()]/g, "")));

      setSegmentPhones(phones);
    } catch (e: any) {
      toast({ title: "Error loading segment", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(segmentPhones.join("\n"));
    toast({ title: `${segmentPhones.length} numbers copied!`, description: "Paste them in the Bulk tab to send messages" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Customer Segments</h3>
        <p className="text-sm text-muted-foreground">Target specific customer groups for your campaigns. Opted-out numbers are auto-excluded.</p>
      </div>

      <div className="grid gap-3">
        {segments.map((seg) => (
          <Card
            key={seg.id}
            className={cn(
              "cursor-pointer transition-all hover:shadow-sm",
              selectedSegment === seg.id && "ring-2 ring-primary"
            )}
            onClick={() => loadSegment(seg.id)}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <seg.icon className={cn("h-5 w-5", seg.color)} />
                <div>
                  <p className="text-sm font-medium">{seg.label}</p>
                  <p className="text-[11px] text-muted-foreground">{seg.desc}</p>
                </div>
              </div>
              {selectedSegment === seg.id && (
                <Badge variant="outline">
                  {loading ? "Loading..." : `${segmentPhones.length} contacts`}
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedSegment && segmentPhones.length > 0 && !loading && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{segmentPhones.length} numbers ready</span>
              <Button size="sm" onClick={copyToClipboard}>
                Copy All → Use in Bulk Tab
              </Button>
            </div>
            <div className="max-h-32 overflow-y-auto bg-muted/50 rounded p-2 space-y-0.5">
              {segmentPhones.slice(0, 20).map((p, i) => (
                <p key={i} className="text-xs font-mono">{p}</p>
              ))}
              {segmentPhones.length > 20 && (
                <p className="text-xs text-muted-foreground">...and {segmentPhones.length - 20} more</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Scheduling Tab ──────────────────────────────────────────────────
function ScheduleTab({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [phones, setPhones] = useState("");
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [scheduleTime, setScheduleTime] = useState("10:00");

  const { data: scheduled } = useQuery({
    queryKey: ["whatsapp-scheduled", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_scheduled")
        .select("*")
        .eq("store_id", storeId)
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const createSchedule = async () => {
    if (!message.trim() || !phones.trim() || !scheduleDate) return;

    const phoneList = phones.split(/[\n,;]+/).map((p) => p.trim()).filter(Boolean);
    const [h, m] = scheduleTime.split(":").map(Number);
    const scheduledAt = new Date(scheduleDate);
    scheduledAt.setHours(h, m, 0, 0);

    if (scheduledAt <= new Date()) {
      toast({ title: "Schedule must be in the future", variant: "destructive" });
      return;
    }

    const { error } = await (supabase as any).from("whatsapp_scheduled").insert({
      store_id: storeId,
      message_body: message.trim(),
      recipient_phones: phoneList,
      scheduled_at: scheduledAt.toISOString(),
      status: "scheduled",
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Message scheduled!", description: `Will be sent at ${format(scheduledAt, "dd MMM yyyy, hh:mm a")}` });
      setMessage("");
      setPhones("");
      setScheduleDate(undefined);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-scheduled", storeId] });
    }
  };

  const cancelSchedule = async (id: string) => {
    await (supabase as any).from("whatsapp_scheduled").update({ status: "cancelled" }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["whatsapp-scheduled", storeId] });
    toast({ title: "Schedule cancelled" });
  };

  const sendNow = async (item: any) => {
    const phoneList = item.recipient_phones || [];
    if (!phoneList.length) return;

    // Update status to sending
    await (supabase as any).from("whatsapp_scheduled").update({ status: "sending" }).eq("id", item.id);
    queryClient.invalidateQueries({ queryKey: ["whatsapp-scheduled", storeId] });

    let sent = 0, failed = 0;
    for (const phone of phoneList) {
      try {
        const res = await supabase.functions.invoke("whatsapp-send", {
          body: { store_id: storeId, recipient_phone: phone, message_body: item.message_body, message_type: "manual" },
        });
        if (res.error || (res.data as any)?.error) failed++;
        else sent++;
      } catch { failed++; }
      await new Promise((r) => setTimeout(r, 500));
    }

    await (supabase as any).from("whatsapp_scheduled")
      .update({ status: "completed", sent_count: sent, failed_count: failed })
      .eq("id", item.id);
    queryClient.invalidateQueries({ queryKey: ["whatsapp-scheduled", storeId] });
    toast({ title: "Scheduled send complete!", description: `✅ ${sent} sent, ❌ ${failed} failed` });
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      scheduled: "bg-blue-100 text-blue-700 border-blue-200",
      sending: "bg-yellow-100 text-yellow-700 border-yellow-200",
      completed: "bg-green-100 text-green-700 border-green-200",
      cancelled: "bg-muted text-muted-foreground",
    };
    return map[s] || "";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Timer className="h-5 w-5" />
            Schedule New Message
          </CardTitle>
          <CardDescription>Schedule a bulk message for a specific date and time</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Phone Numbers (one per line or comma-separated)</Label>
            <Textarea
              value={phones}
              onChange={(e) => setPhones(e.target.value)}
              placeholder={"+919876543210\n+918765432109"}
              rows={3}
              className="text-sm font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Your scheduled message..." rows={3} className="text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left text-sm", !scheduleDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {scheduleDate ? format(scheduleDate, "dd MMM yyyy") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={scheduleDate}
                    onSelect={setScheduleDate}
                    disabled={(d) => d < new Date()}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
            </div>
          </div>
          <Button onClick={createSchedule} disabled={!message.trim() || !phones.trim() || !scheduleDate} className="w-full">
            <CalendarIcon className="mr-2 h-4 w-4" />
            Schedule Message
          </Button>
        </CardContent>
      </Card>

      {/* Scheduled Messages List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scheduled Messages</CardTitle>
        </CardHeader>
        <CardContent>
          {!scheduled?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">No scheduled messages</p>
          ) : (
            <div className="space-y-3">
              {scheduled.map((item: any) => (
                <div key={item.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {format(new Date(item.scheduled_at), "dd MMM yyyy, hh:mm a")}
                      </span>
                    </div>
                    <Badge className={statusBadge(item.status)}>{item.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{item.message_body}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{(item.recipient_phones || []).length} recipients</span>
                    {item.status === "completed" && (
                      <span>✅ {item.sent_count} sent, ❌ {item.failed_count} failed</span>
                    )}
                  </div>
                  {item.status === "scheduled" && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="text-xs flex-1" onClick={() => sendNow(item)}>
                        <Send className="mr-1 h-3 w-3" /> Send Now
                      </Button>
                      <Button size="sm" variant="ghost" className="text-xs text-destructive" onClick={() => cancelSchedule(item.id)}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Meta Templates Tab ─────────────────────────────────────────────
function MetaTemplatesTab({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    category: "MARKETING",
    language: "en",
    body: "",
  });

  const { data: templates, isLoading } = useQuery({
    queryKey: ["meta-templates", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .eq("store_id", storeId)
        .neq("meta_status", "draft")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const syncFromMeta = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-templates", {
        body: { action: "sync", store_id: storeId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Templates synced!", description: `${(data as any)?.count || 0} templates found from Meta` });
      queryClient.invalidateQueries({ queryKey: ["meta-templates", storeId] });
    } catch (e: any) {
      toast({ title: "Sync failed", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const submitTemplate = async () => {
    if (!newTemplate.name || !newTemplate.body) {
      toast({ title: "Fill all fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-templates", {
        body: {
          action: "submit",
          store_id: storeId,
          template_name: newTemplate.name,
          template_category: newTemplate.category,
          template_body: newTemplate.body,
          template_language: newTemplate.language,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error + (((data as any)?.details?.error?.message) ? `: ${(data as any).details.error.message}` : ""));
      toast({ title: "Template submitted!", description: `Status: ${(data as any)?.status || "PENDING"}. Meta will review it.` });
      setShowCreate(false);
      setNewTemplate({ name: "", category: "MARKETING", language: "en", body: "" });
      queryClient.invalidateQueries({ queryKey: ["meta-templates", storeId] });
    } catch (e: any) {
      toast({ title: "Submit failed", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteTemplate = async (templateName: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-templates", {
        body: { action: "delete", store_id: storeId, template_name: templateName },
      });
      if (error) throw error;
      toast({ title: "Template deleted" });
      queryClient.invalidateQueries({ queryKey: ["meta-templates", storeId] });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]"><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Approved</Badge>;
      case "PENDING":
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-[10px]"><Clock className="h-2.5 w-2.5 mr-0.5" />Pending</Badge>;
      case "REJECTED":
        return <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]"><XCircle className="h-2.5 w-2.5 mr-0.5" />Rejected</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  const categoryBadge = (cat: string) => {
    const colors: Record<string, string> = {
      MARKETING: "bg-purple-100 text-purple-700 border-purple-200",
      UTILITY: "bg-blue-100 text-blue-700 border-blue-200",
      AUTHENTICATION: "bg-orange-100 text-orange-700 border-orange-200",
    };
    return <Badge variant="outline" className={`text-[10px] ${colors[cat] || ""}`}>{cat}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Meta Message Templates</h3>
          <p className="text-sm text-muted-foreground">
            Required for sending business-initiated messages (bulk, abandoned cart, etc.)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={syncFromMeta} disabled={syncing}>
            {syncing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
            Sync
          </Button>
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Create
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="p-4">
          <div className="flex gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-800 space-y-1">
              <p className="font-medium">Why do I need Meta-approved templates?</p>
              <ul className="text-xs space-y-0.5 list-disc pl-4">
                <li><strong>Bulk messages</strong> & <strong>marketing campaigns</strong> require approved templates</li>
                <li><strong>Order notifications</strong> (confirmation, shipping) use UTILITY templates</li>
                <li><strong>Abandoned cart recovery</strong> uses MARKETING templates</li>
                <li>Templates are reviewed by Meta in <strong>~24-48 hours</strong></li>
                <li>Use <strong>{'{{1}}'}, {'{{2}}'}</strong> etc. for dynamic variables in the body text</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Template Form */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submit New Template to Meta</CardTitle>
            <CardDescription>Templates must follow Meta's guidelines to get approved</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  placeholder="e.g. order_confirmation_v1"
                  className="text-sm"
                />
                <p className="text-[10px] text-muted-foreground">Lowercase, letters, numbers, underscores only</p>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={newTemplate.category}
                  onValueChange={(v) => setNewTemplate({ ...newTemplate, category: v })}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MARKETING">Marketing (promotions, offers)</SelectItem>
                    <SelectItem value="UTILITY">Utility (order updates, alerts)</SelectItem>
                    <SelectItem value="AUTHENTICATION">Authentication (OTPs)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Language</Label>
              <Select
                value={newTemplate.language}
                onValueChange={(v) => setNewTemplate({ ...newTemplate, language: v })}
              >
                <SelectTrigger className="text-sm w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="en_US">English (US)</SelectItem>
                  <SelectItem value="hi">Hindi</SelectItem>
                  <SelectItem value="ta">Tamil</SelectItem>
                  <SelectItem value="te">Telugu</SelectItem>
                  <SelectItem value="mr">Marathi</SelectItem>
                  <SelectItem value="bn">Bengali</SelectItem>
                  <SelectItem value="gu">Gujarati</SelectItem>
                  <SelectItem value="kn">Kannada</SelectItem>
                  <SelectItem value="ml">Malayalam</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Body Text</Label>
              <Textarea
                value={newTemplate.body}
                onChange={(e) => setNewTemplate({ ...newTemplate, body: e.target.value })}
                placeholder={"Hi {{1}}, your order #{{2}} has been confirmed! 🛍️\n\nTotal: {{3}}\nWe'll update you when it ships.\n\nThank you for shopping with us!"}
                rows={5}
                className="text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Use {'{{1}}'}, {'{{2}}'}, {'{{3}}'} etc. for dynamic variables. Meta requires numbered placeholders.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={submitTemplate} disabled={submitting}>
                {submitting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                Submit to Meta
              </Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Templates List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Templates</CardTitle>
          <CardDescription>Click "Sync" to fetch latest statuses from Meta</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading templates...</p>
          ) : !templates?.length ? (
            <div className="text-center py-8 space-y-2">
              <FileCheck className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No Meta templates found</p>
              <p className="text-xs text-muted-foreground">Click "Sync" to fetch existing templates or "Create" to submit a new one</p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((t: any) => (
                <div key={t.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium font-mono">{t.template_name}</span>
                        {statusBadge(t.meta_status)}
                        {categoryBadge(t.meta_category || "MARKETING")}
                      </div>
                      <p className="text-xs text-muted-foreground">{t.language_code}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => deleteTemplate(t.template_name)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-sm bg-muted/50 rounded p-2 whitespace-pre-wrap">{t.body_text}</p>
                  {t.meta_rejected_reason && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <XCircle className="h-3 w-3" /> Rejection reason: {t.meta_rejected_reason}
                    </p>
                  )}
                  {t.meta_template_id && (
                    <p className="text-[10px] text-muted-foreground">Template ID: {t.meta_template_id}</p>
                  )}
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
  const [activeTab, setActiveTab] = useState<string | undefined>();

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
  const defaultTab = activeTab || (isConnected ? "chat" : "setup");

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

      <Tabs value={defaultTab} onValueChange={setActiveTab}>
        {/* Row 1: Core tabs */}
        <TabsList className="w-full grid grid-cols-5 mb-1">
          <TabsTrigger value="setup" className="text-[11px]">
            <Settings className="h-3 w-3 mr-1" /> Setup
          </TabsTrigger>
          <TabsTrigger value="chat" disabled={!isConnected} className="text-[11px]">
            <Send className="h-3 w-3 mr-1" /> Chat
          </TabsTrigger>
          <TabsTrigger value="bulk" disabled={!isConnected} className="text-[11px]">
            <Megaphone className="h-3 w-3 mr-1" /> Bulk
          </TabsTrigger>
          <TabsTrigger value="automations" disabled={!isConnected} className="text-[11px]">
            <Zap className="h-3 w-3 mr-1" /> Auto
          </TabsTrigger>
          <TabsTrigger value="templates" disabled={!isConnected} className="text-[11px]">
            <FileCheck className="h-3 w-3 mr-1" /> Templates
          </TabsTrigger>
        </TabsList>
        {/* Row 2: Advanced tabs */}
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="segments" disabled={!isConnected} className="text-[11px]">
            <Target className="h-3 w-3 mr-1" /> Segments
          </TabsTrigger>
          <TabsTrigger value="schedule" disabled={!isConnected} className="text-[11px]">
            <Timer className="h-3 w-3 mr-1" /> Schedule
          </TabsTrigger>
          <TabsTrigger value="optout" disabled={!isConnected} className="text-[11px]">
            <Ban className="h-3 w-3 mr-1" /> Opt-Out
          </TabsTrigger>
          <TabsTrigger value="analytics" disabled={!isConnected} className="text-[11px]">
            <BarChart3 className="h-3 w-3 mr-1" /> Stats
          </TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="mt-4">
          <SetupTab storeId={storeId!} />
        </TabsContent>
        <TabsContent value="chat" className="mt-4">
          <ChatTab storeId={storeId!} />
        </TabsContent>
        <TabsContent value="bulk" className="mt-4">
          <BulkMessagingTab storeId={storeId!} />
        </TabsContent>
        <TabsContent value="automations" className="mt-4">
          <AutomationsTab storeId={storeId!} />
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          <MetaTemplatesTab storeId={storeId!} />
        </TabsContent>
        <TabsContent value="segments" className="mt-4">
          <SegmentationTab storeId={storeId!} />
        </TabsContent>
        <TabsContent value="schedule" className="mt-4">
          <ScheduleTab storeId={storeId!} />
        </TabsContent>
        <TabsContent value="optout" className="mt-4">
          <OptOutTab storeId={storeId!} />
        </TabsContent>
        <TabsContent value="analytics" className="mt-4">
          <AnalyticsTab storeId={storeId!} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
