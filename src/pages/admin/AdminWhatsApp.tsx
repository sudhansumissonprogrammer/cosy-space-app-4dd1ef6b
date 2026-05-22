import React, { useState, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  MessageSquare, Send, Phone, CheckCircle2, XCircle, Clock,
  AlertCircle, Users, TrendingUp, Upload, Megaphone, Trash2,
  FileText, Plus, BarChart3, Search, MoreVertical, Check, CheckCheck,
  ArrowLeft, Loader2, FileCheck, RefreshCw, Smile,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Admin Chat Tab ─────────────────────────────────────────────────
function AdminChatTab() {
  const queryClient = useQueryClient();
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Get ALL messages across all stores (admin view)
  const { data: allMessages } = useQuery({
    queryKey: ["admin-whatsapp-all-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*, stores:store_id(name, slug)")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: (query) => (typeof document !== "undefined" && document.visibilityState === "visible") ? 60000 : false,
    refetchOnWindowFocus: true,
  });

  // Group by store+phone
  const conversations = useMemo(() => {
    if (!allMessages) return [];
    const map = new Map<string, {
      phone: string;
      storeId: string;
      storeName: string;
      name: string | null;
      messages: any[];
      lastMessage: any;
      unread: number;
      lastIncomingAt: string | null;
    }>();

    for (const msg of allMessages) {
      const m = msg as any;
      const phone = m.direction === "incoming" ? (m.sender_phone || m.recipient_phone) : m.recipient_phone;
      if (!phone) continue;
      const key = `${m.store_id}_${phone}`;
      const storeName = m.stores?.name || "Unknown Store";

      if (!map.has(key)) {
        map.set(key, {
          phone,
          storeId: m.store_id,
          storeName,
          name: msg.recipient_name,
          messages: [],
          lastMessage: msg,
          unread: 0,
          lastIncomingAt: null,
        });
      }
      const conv = map.get(key)!;
      conv.messages.push(msg);
      if (m.direction === "incoming") {
        if (msg.status === "received") conv.unread++;
        if (!conv.lastIncomingAt || new Date(msg.created_at) > new Date(conv.lastIncomingAt)) {
          conv.lastIncomingAt = msg.created_at;
        }
      }
      if (!conv.name && msg.recipient_name) conv.name = msg.recipient_name;
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
    );
  }, [allMessages]);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(
      (c) => c.phone.includes(q) || (c.name && c.name.toLowerCase().includes(q)) || c.storeName.toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  const selectedConversation = useMemo(() => {
    if (!selectedPhone || !selectedStoreId) return [];
    const conv = conversations.find((c) => c.phone === selectedPhone && c.storeId === selectedStoreId);
    return conv ? [...conv.messages].reverse() : [];
  }, [selectedPhone, selectedStoreId, conversations]);

  const currentConv = useMemo(
    () => conversations.find((c) => c.phone === selectedPhone && c.storeId === selectedStoreId),
    [selectedPhone, selectedStoreId, conversations]
  );

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConversation]);

  const sendMessage = async () => {
    if (!selectedPhone || !selectedStoreId || !message.trim()) return;
    setSending(true);
    try {
      const res = await supabase.functions.invoke("whatsapp-send", {
        body: {
          store_id: selectedStoreId,
          recipient_phone: selectedPhone,
          message_body: message.trim(),
          message_type: "manual",
        },
      });
      if (res.error) throw res.error;
      if ((res.data as any)?.error) throw new Error((res.data as any).error);
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-whatsapp-all-messages"] });
      inputRef.current?.focus();
    } catch (e: any) {
      toast({ title: "Failed to send", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const formatListDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return formatTime(dateStr);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "sent": return <Check className="h-3 w-3 text-muted-foreground" />;
      case "delivered": return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />;
      case "read": return <CheckCheck className="h-3.5 w-3.5 text-[hsl(210,100%,55%)]" />;
      case "failed": return <XCircle className="h-3 w-3 text-destructive" />;
      default: return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getInitials = (name: string | null, phone: string) => {
    if (name) return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
    return phone.slice(-2);
  };

  const getAvatarColor = (phone: string) => {
    const colors = ["bg-emerald-500", "bg-blue-500", "bg-purple-500", "bg-orange-500", "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-amber-500"];
    const hash = phone.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  return (
    <div className="border rounded-xl overflow-hidden bg-background shadow-sm" style={{ height: "calc(100vh - 220px)", minHeight: 450 }}>
      <div className="flex h-full">
        {/* Conversation List */}
        <div className={`${selectedPhone ? "hidden md:flex" : "flex"} flex-col w-full md:w-[360px] md:min-w-[320px] border-r`}>
          <div className="px-4 py-3 bg-muted flex items-center justify-between">
            <h3 className="font-semibold text-[15px]">All Chats (Admin)</h3>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSearch(!showSearch)}>
              <Search className="h-4 w-4" />
            </Button>
          </div>

          {showSearch && (
            <div className="px-3 py-2 border-b">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, phone, or store..."
                className="text-sm h-8"
                autoFocus
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {!filteredConversations.length ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
                <MessageSquare className="h-10 w-10 opacity-30 mb-3" />
                <p className="text-sm">No conversations yet</p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isActive = selectedPhone === conv.phone && selectedStoreId === conv.storeId;
                return (
                  <button
                    key={`${conv.storeId}_${conv.phone}`}
                    onClick={() => { setSelectedPhone(conv.phone); setSelectedStoreId(conv.storeId); }}
                    className={cn(
                      "w-full text-left px-3 py-3 flex items-center gap-3 transition-colors border-b border-border/50",
                      isActive ? "bg-accent" : "hover:bg-muted/50"
                    )}
                  >
                    <div className={cn("h-11 w-11 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0", getAvatarColor(conv.phone))}>
                      {getInitials(conv.name, conv.phone)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] font-medium truncate">{conv.name || conv.phone}</span>
                        <span className="text-[11px] text-muted-foreground shrink-0 ml-2">{formatListDate(conv.lastMessage.created_at)}</span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-[12px] text-muted-foreground truncate flex-1">
                          <Badge variant="outline" className="text-[9px] mr-1 py-0">{conv.storeName}</Badge>
                          {conv.lastMessage.message_body?.slice(0, 30)}
                        </p>
                        {conv.unread > 0 && (
                          <span className="ml-2 h-5 min-w-[20px] rounded-full bg-[hsl(142,72%,40%)] text-white text-[11px] font-bold flex items-center justify-center px-1.5">
                            {conv.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`${!selectedPhone ? "hidden md:flex" : "flex"} flex-col flex-1 min-w-0`}>
          {!selectedPhone ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/30">
              <MessageSquare className="h-16 w-16 opacity-20 mb-4" />
              <p className="text-lg font-light">Admin WhatsApp Hub</p>
              <p className="text-sm mt-2">Monitor all store conversations in real-time</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 px-3 py-2.5 border-b bg-muted">
                <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={() => setSelectedPhone(null)}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm", getAvatarColor(selectedPhone))}>
                  {getInitials(currentConv?.name || null, selectedPhone)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium truncate">{currentConv?.name || selectedPhone}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Store: <span className="font-medium">{currentConv?.storeName}</span>
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 bg-muted/20">
                {selectedConversation.map((msg: any, idx: number) => {
                  const isOutgoing = msg.direction !== "incoming";
                  const showDate = idx === 0 || formatDate(msg.created_at) !== formatDate(selectedConversation[idx - 1].created_at);

                  return (
                    <React.Fragment key={msg.id}>
                      {showDate && (
                        <div className="flex justify-center py-2">
                          <span className="bg-muted rounded-lg px-3 py-1 text-[11px] text-muted-foreground font-medium shadow-sm">
                            {formatDate(msg.created_at)}
                          </span>
                        </div>
                      )}
                      <div className={cn("flex mb-0.5", isOutgoing ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[75%] rounded-lg px-3 py-1.5 shadow-sm",
                          isOutgoing ? "bg-[hsl(142,40%,90%)] rounded-tr-sm" : "bg-card rounded-tl-sm border"
                        )}>
                          <p className="text-[13px] whitespace-pre-wrap break-words">{msg.message_body}</p>
                          <div className="flex items-center justify-end gap-1 mt-0.5">
                            <span className="text-[10px] text-muted-foreground">{formatTime(msg.created_at)}</span>
                            {isOutgoing && statusIcon(msg.status)}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="flex items-end gap-2 px-3 py-2 border-t bg-muted/50">
                <Textarea
                  ref={inputRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type a message"
                  rows={1}
                  className="text-[14px] resize-none min-h-[38px] max-h-[120px] rounded-xl bg-background flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                  }}
                />
                <Button
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-full bg-[hsl(142,72%,40%)] hover:bg-[hsl(142,72%,35%)] text-white"
                  onClick={sendMessage}
                  disabled={sending || !message.trim()}
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Admin Bulk Tab ─────────────────────────────────────────────────
function AdminBulkTab() {
  const queryClient = useQueryClient();
  const [numbers, setNumbers] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, failed: 0, total: 0 });
  const [csvFileName, setCsvFileName] = useState("");
  const [sendMode, setSendMode] = useState<"text" | "template">("template");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [templateParams, setTemplateParams] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  // Get platform config for store_id reference
  const { data: platformConfig } = useQuery({
    queryKey: ["platform-config-admin"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_config").select("*").limit(1).single();
      return data;
    },
  });

  // We need a store to reference — get the first store or use admin templates
  const { data: approvedTemplates } = useQuery({
    queryKey: ["admin-approved-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .eq("meta_status", "APPROVED")
        .order("template_name");
      if (error) throw error;
      // Deduplicate by template_name
      const seen = new Set<string>();
      return (data || []).filter((t: any) => {
        if (seen.has(t.template_name)) return false;
        seen.add(t.template_name);
        return true;
      });
    },
  });

  // Campaign history
  const { data: campaigns } = useQuery({
    queryKey: ["admin-bulk-campaigns"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_bulk_campaigns")
        .select("*, stores:store_id(name)")
        .eq("admin_campaign", true)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as any[];
    },
  });

  const addManualNumbers = () => {
    if (!manualInput.trim()) return;
    const newNumbers = manualInput
      .split(/[\n,;]+/)
      .map((n) => n.replace(/[\s\-()]/g, "").trim())
      .filter((n) => n.length >= 10 && /^\+?\d+$/.test(n));
    const unique = [...new Set([...numbers, ...newNumbers])];
    setNumbers(unique);
    setManualInput("");
    toast({ title: `Added ${newNumbers.length} numbers`, description: `Total: ${unique.length}` });
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      const extracted: string[] = [];
      for (const line of text.split("\n")) {
        for (const cell of line.split(",")) {
          const cleaned = cell.replace(/[\s\-()\"']/g, "").trim();
          if (cleaned.length >= 10 && /^\+?\d{10,15}$/.test(cleaned)) extracted.push(cleaned);
        }
      }
      const unique = [...new Set([...numbers, ...extracted])];
      setNumbers(unique);
      toast({ title: `Imported ${extracted.length} numbers from CSV`, description: `Total: ${unique.length}` });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const getTemplateParamCount = (bodyText: string): number => {
    const matches = bodyText.match(/\{\{\d+\}\}/g);
    if (!matches) return 0;
    return Math.max(...matches.map((m) => parseInt(m.replace(/[{}]/g, ""))));
  };

  const handleTemplateSelect = (templateName: string) => {
    setSelectedTemplate(templateName);
    const tpl = approvedTemplates?.find((t: any) => t.template_name === templateName);
    if (tpl) {
      setTemplateParams(new Array(getTemplateParamCount((tpl as any).body_text || "")).fill(""));
    }
  };

  // Need a store_id for the whatsapp-send function. Use the template's store_id.
  const sendBulk = async () => {
    if (numbers.length === 0) return;
    if (sendMode === "template" && !selectedTemplate) return;
    if (sendMode === "text" && !message.trim()) return;

    setSending(true);
    setProgress({ sent: 0, failed: 0, total: numbers.length });

    const tpl = approvedTemplates?.find((t: any) => t.template_name === selectedTemplate);
    const storeId = tpl?.store_id;

    // Create admin campaign
    let campaignId: string | null = null;
    if (storeId) {
      const { data: campaign } = await (supabase as any)
        .from("whatsapp_bulk_campaigns")
        .insert({
          store_id: storeId,
          admin_campaign: true,
          recipient_count: numbers.length,
          status: "sending",
          message_body: sendMode === "text" ? message.trim() : null,
          template_name: sendMode === "template" ? selectedTemplate : null,
          template_params: sendMode === "template" ? templateParams.filter((p) => p.trim()) : null,
        })
        .select("id")
        .single();
      campaignId = campaign?.id;
    }

    let sent = 0, failed = 0;
    for (const phone of numbers) {
      try {
        const body: any = {
          store_id: storeId,
          recipient_phone: phone,
          message_type: sendMode === "template" ? "bulk_template" : "manual",
        };
        if (sendMode === "template") {
          body.template_name = selectedTemplate;
          body.template_params = templateParams.filter((p) => p.trim());
        } else {
          body.message_body = message.trim();
        }
        const res = await supabase.functions.invoke("whatsapp-send", { body });
        if (res.error || (res.data as any)?.error) failed++;
        else sent++;
      } catch { failed++; }
      setProgress({ sent, failed, total: numbers.length });
      await new Promise((r) => setTimeout(r, 500));
    }

    if (campaignId) {
      await (supabase as any)
        .from("whatsapp_bulk_campaigns")
        .update({ sent_count: sent, failed_count: failed, status: "completed", completed_at: new Date().toISOString() })
        .eq("id", campaignId);
    }

    setSending(false);
    queryClient.invalidateQueries({ queryKey: ["admin-bulk-campaigns"] });
    toast({ title: "Bulk send complete!", description: `✅ ${sent} sent, ❌ ${failed} failed` });
  };

  const progressPercent = progress.total > 0 ? ((progress.sent + progress.failed) / progress.total) * 100 : 0;
  const selectedTpl = approvedTemplates?.find((t: any) => t.template_name === selectedTemplate);

  return (
    <div className="space-y-6">
      {/* Recipients */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" /> Recipients ({numbers.length})
          </CardTitle>
          <CardDescription>Add phone numbers manually or import from CSV</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Textarea
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder={"Enter phone numbers (one per line or comma-separated)\n+919876543210\n+918765432109"}
              rows={3}
              className="text-sm"
            />
            <Button variant="outline" size="sm" onClick={addManualNumbers} disabled={!manualInput.trim()}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Numbers
            </Button>
          </div>

          <div className="relative flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">OR</span>
            <Separator className="flex-1" />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <label className="cursor-pointer">
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                {csvFileName || "Upload CSV"}
                <input type="file" accept=".csv,.txt" className="hidden" onChange={handleCsvUpload} />
              </label>
            </Button>
            {csvFileName && <span className="text-xs text-muted-foreground">{csvFileName}</span>}
          </div>

          {numbers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">{numbers.length} Recipients</Label>
                <Button variant="ghost" size="sm" onClick={() => { setNumbers([]); setCsvFileName(""); }} className="text-xs text-destructive hover:text-destructive">
                  <Trash2 className="mr-1 h-3 w-3" /> Clear
                </Button>
              </div>
              <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                {numbers.slice(0, 50).map((num, i) => (
                  <div key={i} className="flex items-center justify-between bg-muted/50 rounded px-2 py-1 text-sm">
                    <span className="font-mono text-xs">{num}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setNumbers(numbers.filter((_, idx) => idx !== i))}>
                      <XCircle className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {numbers.length > 50 && <p className="text-xs text-muted-foreground">...and {numbers.length - 50} more</p>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compose */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Megaphone className="h-5 w-5" /> Compose Message
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button variant={sendMode === "template" ? "default" : "outline"} size="sm" className="text-xs flex-1" onClick={() => setSendMode("template")}>
              <FileCheck className="h-3 w-3 mr-1" /> Meta Template
            </Button>
            <Button variant={sendMode === "text" ? "default" : "outline"} size="sm" className="text-xs flex-1" onClick={() => setSendMode("text")}>
              <MessageSquare className="h-3 w-3 mr-1" /> Plain Text
            </Button>
          </div>

          {sendMode === "template" ? (
            <div className="space-y-3">
              <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select approved template..." />
                </SelectTrigger>
                <SelectContent>
                  {approvedTemplates?.map((t: any) => (
                    <SelectItem key={t.id} value={t.template_name}>
                      {t.template_name}
                      <Badge variant="outline" className="text-[9px] ml-2">{t.meta_category}</Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTpl && (
                <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap border">
                  {(selectedTpl as any).body_text}
                </div>
              )}
              {templateParams.length > 0 && templateParams.map((param, i) => (
                <div key={i} className="space-y-1">
                  <Label className="text-xs">{`{{${i + 1}}}`}</Label>
                  <Input
                    value={param}
                    onChange={(e) => { const u = [...templateParams]; u[i] = e.target.value; setTemplateParams(u); }}
                    placeholder={`Value for {{${i + 1}}}`}
                    className="text-sm"
                  />
                </div>
              ))}
            </div>
          ) : (
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type your message..." rows={4} className="text-sm" />
          )}

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
            disabled={sending || numbers.length === 0 || (sendMode === "template" ? !selectedTemplate : !message.trim())}
            className="w-full"
          >
            <Send className="mr-2 h-4 w-4" />
            {sending ? `Sending... (${progress.sent + progress.failed}/${progress.total})` : `Send to ${numbers.length} Recipients`}
          </Button>
        </CardContent>
      </Card>

      {/* Campaign History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign History</CardTitle>
        </CardHeader>
        <CardContent>
          {!campaigns?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">No admin campaigns yet</p>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c: any) => (
                <div key={c.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{c.template_name || "Plain text"}</span>
                    <Badge className={cn("text-[10px]",
                      c.status === "completed" ? "bg-green-100 text-green-700 border-green-200" :
                      c.status === "sending" ? "bg-yellow-100 text-yellow-700 border-yellow-200" :
                      "bg-muted text-muted-foreground"
                    )}>{c.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{c.recipient_count} recipients</span>
                    <span>✅ {c.sent_count} · ❌ {c.failed_count}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{format(new Date(c.created_at), "dd MMM yyyy, hh:mm a")}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Admin Templates Tab ────────────────────────────────────────────
function AdminTemplatesTab() {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: "", category: "MARKETING", language: "en", body: "" });

  // Get all templates across stores
  const { data: templates } = useQuery({
    queryKey: ["admin-all-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*, stores:store_id(name)")
        .neq("meta_status", "draft")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Get first store for syncing (admin context)
  const { data: stores } = useQuery({
    queryKey: ["admin-stores-for-templates"],
    queryFn: async () => {
      const { data } = await supabase.from("stores").select("id, name").limit(10);
      return data || [];
    },
  });

  const [selectedStoreId, setSelectedStoreId] = useState("");

  const syncFromMeta = async () => {
    if (!selectedStoreId) { toast({ title: "Select a store first", variant: "destructive" }); return; }
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-templates", {
        body: { action: "sync", store_id: selectedStoreId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Templates synced!", description: `${(data as any)?.count || 0} templates found` });
      queryClient.invalidateQueries({ queryKey: ["admin-all-templates"] });
    } catch (e: any) {
      toast({ title: "Sync failed", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const submitTemplate = async () => {
    if (!selectedStoreId || !newTemplate.name || !newTemplate.body) {
      toast({ title: "Fill all fields and select a store", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-templates", {
        body: {
          action: "submit",
          store_id: selectedStoreId,
          template_name: newTemplate.name,
          template_category: newTemplate.category,
          template_body: newTemplate.body,
          template_language: newTemplate.language,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Template submitted!" });
      setShowCreate(false);
      setNewTemplate({ name: "", category: "MARKETING", language: "en", body: "" });
      queryClient.invalidateQueries({ queryKey: ["admin-all-templates"] });
    } catch (e: any) {
      toast({ title: "Submit failed", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteTemplate = async (templateName: string, storeId: string) => {
    try {
      await supabase.functions.invoke("whatsapp-templates", {
        body: { action: "delete", store_id: storeId, template_name: templateName },
      });
      toast({ title: "Template deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin-all-templates"] });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "APPROVED": return <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]"><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Approved</Badge>;
      case "PENDING": return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-[10px]"><Clock className="h-2.5 w-2.5 mr-0.5" />Pending</Badge>;
      case "REJECTED": return <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]"><XCircle className="h-2.5 w-2.5 mr-0.5" />Rejected</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">All Templates</h3>
          <p className="text-sm text-muted-foreground">Manage Meta templates across all stores</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
            <SelectTrigger className="w-[180px] text-sm">
              <SelectValue placeholder="Select store..." />
            </SelectTrigger>
            <SelectContent>
              {stores?.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={syncFromMeta} disabled={syncing || !selectedStoreId}>
            {syncing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
            Sync
          </Button>
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Create
          </Button>
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create Template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={newTemplate.name} onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })} placeholder="e.g. promo_v1" className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={newTemplate.category} onValueChange={(v) => setNewTemplate({ ...newTemplate, category: v })}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MARKETING">Marketing</SelectItem>
                    <SelectItem value="UTILITY">Utility</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea value={newTemplate.body} onChange={(e) => setNewTemplate({ ...newTemplate, body: e.target.value })} rows={4} className="text-sm" placeholder="Hello {{1}}, we have a special offer..." />
            </div>
            <Button onClick={submitTemplate} disabled={submitting || !selectedStoreId}>
              {submitting ? "Submitting..." : "Submit to Meta"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {templates?.map((t: any) => (
          <Card key={t.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{t.template_name}</span>
                  {statusBadge(t.meta_status)}
                  <Badge variant="outline" className="text-[9px]">{t.meta_category}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px]">{t.stores?.name || "Unknown"}</Badge>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteTemplate(t.template_name, t.store_id)}>
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">{t.body_text}</p>
            </CardContent>
          </Card>
        ))}
        {!templates?.length && (
          <p className="text-sm text-muted-foreground text-center py-8">No templates found. Select a store and sync from Meta.</p>
        )}
      </div>
    </div>
  );
}

// ─── Admin Stats Tab ────────────────────────────────────────────────
function AdminStatsTab() {
  const { data: stats } = useQuery({
    queryKey: ["admin-whatsapp-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("status, message_type, created_at, store_id");
      if (error) throw error;

      const total = data?.length || 0;
      const sent = data?.filter((m: any) => m.status === "sent").length || 0;
      const delivered = data?.filter((m: any) => m.status === "delivered").length || 0;
      const failed = data?.filter((m: any) => m.status === "failed").length || 0;
      const today = new Date().toISOString().split("T")[0];
      const todayCount = data?.filter((m: any) => m.created_at.startsWith(today)).length || 0;
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const weekCount = data?.filter((m: any) => m.created_at >= weekAgo).length || 0;

      // By store
      const byStore: Record<string, number> = {};
      data?.forEach((m: any) => { byStore[m.store_id] = (byStore[m.store_id] || 0) + 1; });

      return { total, sent, delivered, failed, todayCount, weekCount, storeCount: Object.keys(byStore).length };
    },
  });

  const statCards = [
    { label: "Total Messages", value: stats?.total || 0, icon: MessageSquare, color: "text-primary" },
    { label: "Sent Today", value: stats?.todayCount || 0, icon: Send, color: "text-green-600" },
    { label: "This Week", value: stats?.weekCount || 0, icon: TrendingUp, color: "text-blue-600" },
    { label: "Failed", value: stats?.failed || 0, icon: XCircle, color: "text-red-500" },
    { label: "Delivered", value: stats?.delivered || 0, icon: CheckCircle2, color: "text-emerald-600" },
    { label: "Active Stores", value: stats?.storeCount || 0, icon: Users, color: "text-purple-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
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
    </div>
  );
}

// ─── Main Admin WhatsApp Page ───────────────────────────────────────
export default function AdminWhatsApp() {
  const [activeTab, setActiveTab] = useState("chat");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-green-600" />
          WhatsApp Hub
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Monitor all store conversations, send bulk messages, manage templates
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="chat" className="text-[11px]">
            <MessageSquare className="h-3 w-3 mr-1" /> Chat
          </TabsTrigger>
          <TabsTrigger value="bulk" className="text-[11px]">
            <Megaphone className="h-3 w-3 mr-1" /> Bulk
          </TabsTrigger>
          <TabsTrigger value="templates" className="text-[11px]">
            <FileCheck className="h-3 w-3 mr-1" /> Templates
          </TabsTrigger>
          <TabsTrigger value="stats" className="text-[11px]">
            <BarChart3 className="h-3 w-3 mr-1" /> Stats
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-4">
          <AdminChatTab />
        </TabsContent>
        <TabsContent value="bulk" className="mt-4">
          <AdminBulkTab />
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          <AdminTemplatesTab />
        </TabsContent>
        <TabsContent value="stats" className="mt-4">
          <AdminStatsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
