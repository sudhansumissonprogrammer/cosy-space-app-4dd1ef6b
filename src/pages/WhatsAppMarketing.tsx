import React, { useState, useMemo, useRef, useCallback } from "react";
import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";
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
  ArrowLeft, Search, Smile, MoreVertical, Check, CheckCheck, Mic,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
        const { error } = await (supabase as any).from("whatsapp_config").insert({
          store_id: storeId,
          access_token: form.access_token,
          phone_number_id: form.phone_number_id,
          waba_id: form.waba_id,
          business_phone: form.business_phone,
          marketing_mode: "own",
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

// ─── Chat Tab (WhatsApp-style) ──────────────────────────────────────

const EMOJI_LIST = ["😊", "😂", "❤️", "👍", "🙏", "🎉", "🔥", "✅", "⭐", "💯", "🛍️", "📦", "🚚", "💰", "🏷️", "👋", "😍", "🤩", "💪", "✨", "🙌", "💐", "🎁", "💳", "📱", "🛒"];

function ChatTab({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{ file: File; url: string; type: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get all conversations (grouped by phone number)
  const { data: allMessages } = useQuery({
    queryKey: ["whatsapp-all-messages", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

  // Group messages by phone number to create conversations
  const conversations = useMemo(() => {
    if (!allMessages) return [];
    const map = new Map<string, {
      phone: string;
      name: string | null;
      messages: any[];
      lastMessage: any;
      unread: number;
      lastIncomingAt: string | null;
    }>();

    for (const msg of allMessages) {
      const m = msg as any;
      const phone = m.direction === "incoming"
        ? (m.sender_phone || m.recipient_phone)
        : m.recipient_phone;
      if (!phone) continue;

      if (!map.has(phone)) {
        map.set(phone, {
          phone,
          name: msg.recipient_name,
          messages: [],
          lastMessage: msg,
          unread: 0,
          lastIncomingAt: null,
        });
      }
      const conv = map.get(phone)!;
      conv.messages.push(msg);
      if (m.direction === "incoming") {
        if (msg.status === "received") conv.unread++;
        if (!conv.lastIncomingAt || new Date(msg.created_at) > new Date(conv.lastIncomingAt)) {
          conv.lastIncomingAt = msg.created_at;
        }
      }
      if (!conv.name && msg.recipient_name) {
        conv.name = msg.recipient_name;
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
    );
  }, [allMessages]);

  // Filter conversations
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(
      (c) => c.phone.includes(q) || (c.name && c.name.toLowerCase().includes(q))
    );
  }, [conversations, searchQuery]);

  // Get messages for selected conversation (chronological)
  const selectedConversation = useMemo(() => {
    if (!selectedPhone) return [];
    const conv = conversations.find((c) => c.phone === selectedPhone);
    return conv ? [...conv.messages].reverse() : [];
  }, [selectedPhone, conversations]);

  // Current conv for header info
  const currentConv = useMemo(() =>
    conversations.find((c) => c.phone === selectedPhone),
    [selectedPhone, conversations]
  );

  // Scroll to bottom when messages change
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConversation]);

  // Typing indicator logic
  const handleTyping = useCallback(() => {
    setIsTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 2000);
  }, []);

  const sendMessage = async () => {
    if (!selectedPhone || (!message.trim() && !mediaPreview)) return;
    setSending(true);
    try {
      let mediaUrl: string | null = null;
      let mediaType: string | null = null;

      // Upload media if present
      if (mediaPreview) {
        setUploadingMedia(true);
        const ext = mediaPreview.file.name.split(".").pop() || "file";
        const filePath = `${storeId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("whatsapp-media")
          .upload(filePath, mediaPreview.file);
        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage
          .from("whatsapp-media")
          .getPublicUrl(filePath);
        mediaUrl = urlData.publicUrl;
        mediaType = mediaPreview.type;
        setUploadingMedia(false);
      }

      const res = await supabase.functions.invoke("whatsapp-send", {
        body: {
          store_id: storeId,
          recipient_phone: selectedPhone,
          message_body: message.trim() || (mediaType ? `[${mediaType}]` : ""),
          message_type: "manual",
          ...(mediaUrl ? { media_url: mediaUrl, media_type: mediaType } : {}),
        },
      });
      if (res.error) throw res.error;
      if ((res.data as any)?.error) throw new Error((res.data as any).error);
      setMessage("");
      setShowEmoji(false);
      setMediaPreview(null);
      setIsTyping(false);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-all-messages", storeId] });
      inputRef.current?.focus();
    } catch (e: any) {
      toast({ title: "Failed to send", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
      setUploadingMedia(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Determine media type
    let type = "document";
    if (file.type.startsWith("image/")) type = "image";
    else if (file.type.startsWith("video/")) type = "video";

    // 16MB limit for WhatsApp
    if (file.size > 16 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum 16MB allowed", variant: "destructive" });
      return;
    }

    const url = URL.createObjectURL(file);
    setMediaPreview({ file, url, type });
    inputRef.current?.focus();

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeMediaPreview = () => {
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview.url);
      setMediaPreview(null);
    }
  };

  const startNewChat = () => {
    if (newChatPhone.trim()) {
      const cleaned = newChatPhone.replace(/[\s\-()]/g, "").trim();
      setSelectedPhone(cleaned);
      setShowNewChat(false);
      setNewChatPhone("");
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  };

  const formatListDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return formatTime(dateStr);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const formatLastSeen = (dateStr: string | null) => {
    if (!dateStr) return "offline";
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 2) return "online";
    if (diffMin < 60) return `last seen ${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `last seen ${diffHr}h ago`;
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return `last seen today at ${formatTime(dateStr)}`;
    if (d.toDateString() === yesterday.toDateString()) return `last seen yesterday at ${formatTime(dateStr)}`;
    return `last seen ${d.toLocaleDateString([], { month: "short", day: "numeric" })} at ${formatTime(dateStr)}`;
  };

  const isOnline = (dateStr: string | null) => {
    if (!dateStr) return false;
    const diffMin = (Date.now() - new Date(dateStr).getTime()) / 60000;
    return diffMin < 2;
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "sent": return <Check className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />;
      case "delivered": return <CheckCheck className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />;
      case "read": return <CheckCheck className="h-3.5 w-3.5 text-[hsl(210,100%,55%)]" />;
      case "failed": return <XCircle className="h-3 w-3 text-[hsl(var(--destructive))]" />;
      case "received": return null;
      default: return <Clock className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />;
    }
  };

  const getInitials = (name: string | null, phone: string) => {
    if (name) {
      return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
    }
    return phone.slice(-2);
  };

  const getAvatarColor = (phone: string) => {
    const colors = [
      "bg-emerald-500", "bg-blue-500", "bg-purple-500", "bg-orange-500",
      "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-amber-500",
    ];
    const hash = phone.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const insertEmoji = (emoji: string) => {
    setMessage(prev => prev + emoji);
    inputRef.current?.focus();
  };

  // Render media in message bubble
  const renderMedia = (msg: any) => {
    const mUrl = msg.media_url;
    const mType = msg.media_type;
    if (!mUrl) return null;

    if (mType === "image") {
      return (
        <a href={mUrl} target="_blank" rel="noopener noreferrer" className="block mb-1">
          <img
            src={mUrl}
            alt="Shared image"
            className="rounded-md max-w-full max-h-[200px] object-cover cursor-pointer"
            loading="lazy"
          />
        </a>
      );
    }
    if (mType === "video") {
      return (
        <video
          src={mUrl}
          controls
          className="rounded-md max-w-full max-h-[200px] mb-1"
          preload="metadata"
        />
      );
    }
    // Document
    const fileName = mUrl.split("/").pop() || "Document";
    return (
      <a
        href={mUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 bg-[hsl(var(--muted))] rounded-md p-2 mb-1 hover:bg-[hsl(var(--accent))] transition-colors"
      >
        <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium truncate">{decodeURIComponent(fileName)}</p>
          <p className="text-[10px] text-muted-foreground">Document</p>
        </div>
      </a>
    );
  };

  // Preview summary for conversation list
  const getLastMessagePreview = (conv: any) => {
    const lm = conv.lastMessage;
    if (lm.media_type === "image") return "📷 Photo";
    if (lm.media_type === "video") return "🎥 Video";
    if (lm.media_type === "document") return "📄 Document";
    return lm.message_body;
  };

  return (
    <div className="border rounded-xl overflow-hidden bg-background shadow-sm" style={{ height: "calc(100vh - 280px)", minHeight: 450 }}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="flex h-full">
        {/* ── Conversation List (left panel) ── */}
        <div className={`${selectedPhone ? "hidden md:flex" : "flex"} flex-col w-full md:w-[340px] md:min-w-[300px] border-r`}>
          {/* Header */}
          <div className="px-4 py-3 bg-[hsl(var(--muted))] flex items-center justify-between">
            <h3 className="font-semibold text-[15px]">Chats</h3>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowSearch(!showSearch)}
              >
                <Search className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowNewChat(true)}>
                    <Plus className="h-4 w-4 mr-2" /> New chat
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* New Chat Input */}
          {showNewChat && (
            <div className="px-3 py-2 border-b bg-[hsl(var(--muted)/0.5)] space-y-2">
              <p className="text-xs font-medium text-foreground">New Conversation</p>
              <div className="flex gap-2">
                <Input
                  value={newChatPhone}
                  onChange={(e) => setNewChatPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="text-sm h-8"
                  onKeyDown={(e) => e.key === "Enter" && startNewChat()}
                />
                <Button size="sm" className="h-8 px-3" onClick={startNewChat} disabled={!newChatPhone.trim()}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Button variant="ghost" size="sm" className="h-6 text-xs w-full" onClick={() => setShowNewChat(false)}>
                Cancel
              </Button>
            </div>
          )}

          {/* Search Bar */}
          {showSearch && (
            <div className="px-3 py-2 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or phone..."
                  className="text-sm h-8 pl-8"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {!filteredConversations.length ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
                <div className="h-16 w-16 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center mb-3">
                  <MessageSquare className="h-7 w-7 opacity-50" />
                </div>
                <p className="text-sm font-medium">No conversations yet</p>
                <p className="text-xs mt-1 text-center">Click the menu icon above to start a new chat</p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isActive = selectedPhone === conv.phone;
                const online = isOnline(conv.lastIncomingAt);
                return (
                  <button
                    key={conv.phone}
                    onClick={() => setSelectedPhone(conv.phone)}
                    className={cn(
                      "w-full text-left px-3 py-3 flex items-center gap-3 transition-colors border-b border-border/50",
                      isActive ? "bg-[hsl(var(--accent))]" : "hover:bg-[hsl(var(--muted)/0.5)]"
                    )}
                  >
                    {/* Avatar with online dot */}
                    <div className="relative shrink-0">
                      <div className={cn(
                        "h-11 w-11 rounded-full flex items-center justify-center text-white font-semibold text-sm",
                        getAvatarColor(conv.phone)
                      )}>
                        {getInitials(conv.name, conv.phone)}
                      </div>
                      {online && (
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[hsl(142,72%,40%)] border-2 border-background" />
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] font-medium truncate">
                          {conv.name || conv.phone}
                        </span>
                        <span className={cn(
                          "text-[11px] shrink-0 ml-2",
                          conv.unread > 0 ? "text-[hsl(142,72%,40%)] font-medium" : "text-muted-foreground"
                        )}>
                          {formatListDate(conv.lastMessage.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-[13px] text-muted-foreground truncate flex-1 flex items-center gap-1">
                          {conv.lastMessage.direction !== "incoming" && (
                            statusIcon(conv.lastMessage.status)
                          )}
                          <span className="truncate">
                            {getLastMessagePreview(conv)}
                          </span>
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

        {/* ── Chat Area (right panel) ── */}
        <div className={`${!selectedPhone ? "hidden md:flex" : "flex"} flex-col flex-1 min-w-0`}>
          {!selectedPhone ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-[hsl(var(--muted)/0.3)]">
              <div className="h-24 w-24 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center mb-4">
                <MessageSquare className="h-12 w-12 opacity-30" />
              </div>
              <p className="text-xl font-light">WhatsApp Business</p>
              <p className="text-sm mt-2 text-center max-w-sm">
                Send and receive messages with your customers directly from your dashboard
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowNewChat(true)}
              >
                <Plus className="h-4 w-4 mr-2" /> Start a conversation
              </Button>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-3 px-3 py-2.5 border-b bg-[hsl(var(--muted))]">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 md:hidden shrink-0"
                  onClick={() => setSelectedPhone(null)}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="relative shrink-0">
                  <div className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm",
                    getAvatarColor(selectedPhone)
                  )}>
                    {getInitials(currentConv?.name || null, selectedPhone)}
                  </div>
                  {isOnline(currentConv?.lastIncomingAt || null) && (
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-[hsl(142,72%,40%)] border-2 border-[hsl(var(--muted))]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium truncate">
                    {currentConv?.name || selectedPhone}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {isOnline(currentConv?.lastIncomingAt || null)
                      ? <span className="text-[hsl(142,72%,40%)]">online</span>
                      : formatLastSeen(currentConv?.lastIncomingAt || null)
                    }
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => {
                      navigator.clipboard.writeText(selectedPhone);
                      toast({ title: "Phone copied!" });
                    }}>
                      <Phone className="h-4 w-4 mr-2" /> Copy number
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSelectedPhone(null)}>
                      <XCircle className="h-4 w-4 mr-2" /> Close chat
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Messages Area */}
              <div
                className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5"
                style={{
                  backgroundColor: "hsl(var(--muted) / 0.2)",
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }}
              >
                {selectedConversation.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="bg-[hsl(var(--muted))] rounded-lg px-4 py-2 text-center">
                      <p className="text-xs text-muted-foreground">
                        Send your first message to start the conversation
                      </p>
                    </div>
                  </div>
                ) : (
                  selectedConversation.map((msg: any, idx: number) => {
                    const isOutgoing = msg.direction !== "incoming";
                    const showDateSeparator =
                      idx === 0 ||
                      new Date(msg.created_at).toDateString() !==
                        new Date(selectedConversation[idx - 1].created_at).toDateString();

                    return (
                      <React.Fragment key={msg.id}>
                        {showDateSeparator && (
                          <div className="flex justify-center my-3">
                            <span className="text-[11px] bg-[hsl(var(--muted))] shadow-sm px-3 py-1 rounded-md text-muted-foreground font-medium">
                              {formatDate(msg.created_at)}
                            </span>
                          </div>
                        )}
                        <div className={`flex ${isOutgoing ? "justify-end" : "justify-start"} mb-0.5`}>
                          <div
                            className={cn(
                              "relative max-w-[85%] sm:max-w-[70%] rounded-lg text-[13.5px] shadow-sm overflow-hidden",
                              isOutgoing
                                ? "bg-[hsl(142,70%,90%)] dark:bg-[hsl(142,40%,25%)] text-foreground rounded-tr-none"
                                : "bg-card text-foreground rounded-tl-none",
                              msg.media_url ? "p-1" : "px-3 py-1.5"
                            )}
                          >
                            {/* Media content */}
                            {renderMedia(msg)}
                            {/* Message body */}
                            <div className={msg.media_url ? "px-2 py-1" : ""}>
                              {msg.message_body && !msg.message_body.startsWith("[") && (
                                <p className="whitespace-pre-wrap break-words leading-[1.35]">{msg.message_body}</p>
                              )}
                              {/* Time + status */}
                              <div className="flex items-center justify-end gap-1 -mb-0.5 mt-0.5">
                                <span className="text-[10px] text-muted-foreground">{formatTime(msg.created_at)}</span>
                                {isOutgoing && statusIcon(msg.status)}
                              </div>
                            </div>
                            {/* Error indicator */}
                            {msg.status === "failed" && msg.error_message && (
                              <p className="text-[10px] text-[hsl(var(--destructive))] px-2 pb-1 flex items-center gap-1">
                                <AlertCircle className="h-2.5 w-2.5" /> {msg.error_message.slice(0, 60)}
                              </p>
                            )}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}

                {/* Typing indicator */}
                {isTyping && (
                  <div className="flex justify-end mb-0.5">
                    <div className="bg-[hsl(142,70%,90%)] dark:bg-[hsl(142,40%,25%)] rounded-lg rounded-tr-none px-3 py-2 shadow-sm">
                      <div className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Media Preview */}
              {mediaPreview && (
                <div className="border-t px-3 py-2 bg-[hsl(var(--muted)/0.5)]">
                  <div className="flex items-start gap-2">
                    <div className="relative">
                      {mediaPreview.type === "image" ? (
                        <img src={mediaPreview.url} alt="Preview" className="h-16 w-16 rounded-md object-cover" />
                      ) : mediaPreview.type === "video" ? (
                        <div className="h-16 w-16 rounded-md bg-[hsl(var(--muted))] flex items-center justify-center">
                          <Eye className="h-6 w-6 text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="h-16 w-16 rounded-md bg-[hsl(var(--muted))] flex items-center justify-center">
                          <FileText className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <button
                        onClick={removeMediaPreview}
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-[hsl(var(--destructive))] text-white flex items-center justify-center"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{mediaPreview.file.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {(mediaPreview.file.size / 1024).toFixed(0)} KB · {mediaPreview.type}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Emoji Picker */}
              {showEmoji && (
                <div className="border-t px-3 py-2 bg-[hsl(var(--muted)/0.5)]">
                  <div className="flex flex-wrap gap-1.5">
                    {EMOJI_LIST.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => insertEmoji(emoji)}
                        className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-[hsl(var(--muted))] text-lg transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message Input */}
              <div className="border-t px-2 py-2 flex items-end gap-1.5 bg-[hsl(var(--muted)/0.3)]">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-9 w-9 shrink-0 rounded-full", showEmoji && "bg-[hsl(var(--accent))]")}
                  onClick={() => setShowEmoji(!showEmoji)}
                >
                  <Smile className="h-5 w-5 text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingMedia}
                >
                  {uploadingMedia
                    ? <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                    : <Plus className="h-5 w-5 text-muted-foreground" />
                  }
                </Button>
                <div className="flex-1 relative">
                  <Textarea
                    ref={inputRef}
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      handleTyping();
                    }}
                    placeholder="Type a message"
                    rows={1}
                    className="text-[14px] resize-none min-h-[38px] max-h-[120px] rounded-xl bg-background border-border pr-3"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    onFocus={() => setShowEmoji(false)}
                  />
                </div>
                {(message.trim() || mediaPreview) ? (
                  <Button
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-full bg-[hsl(142,72%,40%)] hover:bg-[hsl(142,72%,35%)] text-white"
                    onClick={sendMessage}
                    disabled={sending}
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-full bg-[hsl(142,72%,40%)] hover:bg-[hsl(142,72%,35%)] text-white"
                    disabled
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


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
function BulkMessagingTab({ storeId, initialNumbers }: { storeId: string; initialNumbers?: string[] }) {
  const queryClient = useQueryClient();
  const [numbers, setNumbers] = useState<string[]>(initialNumbers || []);
  const [manualInput, setManualInput] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, failed: 0, total: 0 });
  const [csvFileName, setCsvFileName] = useState("");
  const [sendMode, setSendMode] = useState<"text" | "template">("text");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [templateParams, setTemplateParams] = useState<string[]>([]);

  // Update numbers when initialNumbers changes
  React.useEffect(() => {
    if (initialNumbers?.length) {
      setNumbers(prev => [...new Set([...prev, ...initialNumbers])]);
    }
  }, [initialNumbers]);

  // Fetch campaign history
  const { data: campaigns } = useQuery({
    queryKey: ["bulk-campaigns", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_bulk_campaigns")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch approved Meta templates
  const { data: approvedTemplates } = useQuery({
    queryKey: ["approved-meta-templates", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .eq("store_id", storeId)
        .eq("meta_status", "APPROVED")
        .order("template_name");
      if (error) throw error;
      return data || [];
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

  const getTemplateParamCount = (bodyText: string): number => {
    const matches = bodyText.match(/\{\{\d+\}\}/g);
    if (!matches) return 0;
    const nums = matches.map((m) => parseInt(m.replace(/[{}]/g, "")));
    return Math.max(...nums);
  };

  const handleTemplateSelect = (templateName: string) => {
    setSelectedTemplate(templateName);
    const tpl = approvedTemplates?.find((t: any) => t.template_name === templateName);
    if (tpl) {
      const paramCount = getTemplateParamCount((tpl as any).body_text || "");
      setTemplateParams(new Array(paramCount).fill(""));
    }
  };

  const sendBulk = async () => {
    if (sendMode === "text" && !message.trim()) return;
    if (sendMode === "template" && !selectedTemplate) return;
    if (numbers.length === 0) return;

    setSending(true);
    setProgress({ sent: 0, failed: 0, total: numbers.length });

    // Create campaign record
    const campaignBody: any = {
      store_id: storeId,
      recipient_count: numbers.length,
      status: "sending",
      message_body: sendMode === "text" ? message.trim() : null,
      template_name: sendMode === "template" ? selectedTemplate : null,
      template_params: sendMode === "template" ? templateParams.filter((p) => p.trim()) : null,
    };
    const { data: campaign } = await (supabase as any)
      .from("whatsapp_bulk_campaigns")
      .insert(campaignBody)
      .select("id")
      .single();
    const campaignId = campaign?.id;

    let sent = 0;
    let failed = 0;

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
        if (res.error || (res.data as any)?.error) {
          failed++;
        } else {
          sent++;
        }
      } catch {
        failed++;
      }
      setProgress({ sent, failed, total: numbers.length });
      await new Promise((r) => setTimeout(r, 500));
    }

    // Update campaign record
    if (campaignId) {
      await (supabase as any)
        .from("whatsapp_bulk_campaigns")
        .update({ sent_count: sent, failed_count: failed, status: "completed", completed_at: new Date().toISOString() })
        .eq("id", campaignId);
    }

    setSending(false);
    queryClient.invalidateQueries({ queryKey: ["whatsapp-messages", storeId] });
    queryClient.invalidateQueries({ queryKey: ["whatsapp-analytics", storeId] });
    queryClient.invalidateQueries({ queryKey: ["bulk-campaigns", storeId] });
    toast({
      title: "Bulk send complete!",
      description: `✅ ${sent} sent, ❌ ${failed} failed out of ${numbers.length}`,
    });
  };

  const progressPercent = progress.total > 0 ? ((progress.sent + progress.failed) / progress.total) * 100 : 0;
  const selectedTpl = approvedTemplates?.find((t: any) => t.template_name === selectedTemplate);
  const canSend = sendMode === "text" ? message.trim() : selectedTemplate;

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
          <CardDescription>This message will be sent to all {numbers.length} recipients</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Send Mode Toggle */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Send Mode</Label>
            <div className="flex gap-2">
              <Button
                variant={sendMode === "text" ? "default" : "outline"}
                size="sm"
                className="text-xs flex-1"
                onClick={() => setSendMode("text")}
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                Plain Text
              </Button>
              <Button
                variant={sendMode === "template" ? "default" : "outline"}
                size="sm"
                className="text-xs flex-1"
                onClick={() => setSendMode("template")}
              >
                <FileCheck className="h-3 w-3 mr-1" />
                Meta Template
              </Button>
            </div>
          </div>

          {sendMode === "template" ? (
            <div className="space-y-4">
              {/* Template info banner */}
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                <p className="text-xs text-blue-800">
                  <strong>Recommended for bulk sends.</strong> Meta-approved templates have higher delivery rates and are required for business-initiated messages outside the 24hr window.
                </p>
              </div>

              {/* Template selector */}
              <div className="space-y-2">
                <Label>Select Approved Template</Label>
                {!approvedTemplates?.length ? (
                  <div className="text-center py-4 border rounded-lg">
                    <FileCheck className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">No approved templates</p>
                    <p className="text-xs text-muted-foreground mt-1">Go to the Templates tab to submit templates for Meta approval</p>
                  </div>
                ) : (
                  <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Choose a template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {approvedTemplates.map((t: any) => (
                        <SelectItem key={t.template_name} value={t.template_name}>
                          <div className="flex items-center gap-2">
                            <span>{t.template_name}</span>
                            <Badge variant="outline" className="text-[9px] ml-1">{t.meta_category}</Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Template preview */}
              {selectedTpl && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Template Preview</Label>
                    <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap border">
                      {(selectedTpl as any).body_text}
                    </div>
                  </div>

                  {/* Template parameters */}
                  {templateParams.length > 0 && (
                    <div className="space-y-2">
                      <Label>Template Parameters</Label>
                      <p className="text-[10px] text-muted-foreground">
                        Fill in the values for each variable in the template
                      </p>
                      {templateParams.map((param, i) => (
                        <div key={i} className="space-y-1">
                          <Label className="text-xs">{`{{${i + 1}}}`} — Parameter {i + 1}</Label>
                          <Input
                            value={param}
                            onChange={(e) => {
                              const updated = [...templateParams];
                              updated[i] = e.target.value;
                              setTemplateParams(updated);
                            }}
                            placeholder={`Value for {{${i + 1}}}`}
                            className="text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
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
                  ⚠️ Plain text only works for replies within 24hrs. Use Meta Templates for marketing messages.
                </p>
              </div>
            </>
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
            disabled={sending || numbers.length === 0 || !canSend}
            className="w-full"
          >
            <Send className="mr-2 h-4 w-4" />
            {sending
              ? `Sending... (${progress.sent + progress.failed}/${progress.total})`
              : sendMode === "template"
                ? `Send Template to ${numbers.length} Recipients`
                : `Send to ${numbers.length} Recipients`}
          </Button>
        </CardContent>
      </Card>

      {/* Campaign History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5" />
            Campaign History
          </CardTitle>
          <CardDescription>Track status of your bulk messaging campaigns</CardDescription>
        </CardHeader>
        <CardContent>
          {!campaigns?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">No campaigns yet. Send your first bulk message above.</p>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c: any) => (
                <div key={c.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {c.template_name || (c.message_body ? c.message_body.slice(0, 40) + "..." : "Campaign")}
                    </span>
                    <Badge className={cn(
                      "text-[10px]",
                      c.status === "completed" ? "bg-green-100 text-green-700 border-green-200" :
                      c.status === "sending" ? "bg-yellow-100 text-yellow-700 border-yellow-200" :
                      c.status === "failed" ? "bg-red-100 text-red-700 border-red-200" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {c.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{c.recipient_count} recipients</span>
                    <span>✅ {c.sent_count} sent · ❌ {c.failed_count} failed</span>
                  </div>
                  {c.recipient_count > 0 && (
                    <Progress value={((c.sent_count + c.failed_count) / c.recipient_count) * 100} className="h-1.5" />
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {format(new Date(c.created_at), "dd MMM yyyy, hh:mm a")}
                    {c.completed_at && ` — completed ${format(new Date(c.completed_at), "hh:mm a")}`}
                  </p>
                </div>
              ))}
            </div>
          )}
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
function SegmentationTab({ storeId, onSendToBulk }: { storeId: string; onSendToBulk?: (phones: string[]) => void }) {
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [segmentPhones, setSegmentPhones] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [productFilter, setProductFilter] = useState<string>("__all__");
  const [categoryFilter, setCategoryFilter] = useState<string>("__all__");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>();
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>();

  // Fetch products for filter
  const { data: products } = useQuery({
    queryKey: ["store-products-filter", storeId],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, category").eq("store_id", storeId).eq("is_active", true).order("name");
      return data || [];
    },
  });

  // Get unique categories
  const categories = useMemo(() => {
    if (!products) return [];
    return [...new Set(products.map((p: any) => p.category).filter(Boolean))].sort();
  }, [products]);

  const segments = [
    { id: "all_customers", label: "All Customers", icon: Users, desc: "Every customer with a phone number", color: "text-blue-500" },
    { id: "repeat_buyers", label: "Repeat Buyers", icon: TrendingUp, desc: "Customers with 2+ orders", color: "text-green-500" },
    { id: "high_value", label: "High Value", icon: Target, desc: "Customers with 5+ orders", color: "text-purple-500" },
    { id: "recent_30d", label: "Recent (30 days)", icon: Clock, desc: "Ordered in the last 30 days", color: "text-orange-500" },
    { id: "inactive_90d", label: "Inactive (90+ days)", icon: UserX, desc: "No orders in 90+ days", color: "text-red-500" },
    { id: "filtered", label: "Custom Filter", icon: Target, desc: "Product, category & date filters", color: "text-indigo-500" },
  ];

  const getDateRange = () => {
    const now = new Date();
    if (dateFilter === "today") {
      const start = new Date(now); start.setHours(0,0,0,0);
      return { from: start.toISOString(), to: now.toISOString() };
    }
    if (dateFilter === "7days") {
      return { from: new Date(now.getTime() - 7*24*60*60*1000).toISOString(), to: now.toISOString() };
    }
    if (dateFilter === "30days") {
      return { from: new Date(now.getTime() - 30*24*60*60*1000).toISOString(), to: now.toISOString() };
    }
    if (dateFilter === "custom" && customDateFrom) {
      return { from: customDateFrom.toISOString(), to: customDateTo ? customDateTo.toISOString() : now.toISOString() };
    }
    return null;
  };

  const loadSegment = async (segmentId: string) => {
    setLoading(true);
    setSelectedSegment(segmentId);
    try {
      if (segmentId === "filtered") {
        // Custom filter: join orders → order_items → products
        let query = supabase
          .from("orders")
          .select("customer_phone, order_items!inner(product_id, product_name)")
          .eq("store_id", storeId)
          .not("customer_phone", "is", null);

        const dateRange = getDateRange();
        if (dateRange) {
          query = query.gte("created_at", dateRange.from).lte("created_at", dateRange.to);
        }

        const { data: orderData, error } = await query;
        if (error) throw error;

        let phones: string[] = [];
        if (orderData) {
          for (const order of orderData as any[]) {
            if (!order.customer_phone) continue;
            const items = order.order_items || [];
            let matchesProduct = productFilter === "__all__";
            let matchesCategory = categoryFilter === "__all__";

            for (const item of items) {
              if (productFilter !== "__all__" && item.product_id === productFilter) matchesProduct = true;
              if (categoryFilter !== "__all__") {
                const prod = products?.find((p: any) => p.id === item.product_id);
                if (prod && (prod as any).category === categoryFilter) matchesCategory = true;
              }
            }

            if (matchesProduct && matchesCategory) {
              phones.push(order.customer_phone);
            }
          }
        }
        setSegmentPhones([...new Set(phones)]);
      } else {
        // Existing segment logic
        let query = supabase.from("customers").select("phone").eq("store_id", storeId).not("phone", "is", null);

        switch (segmentId) {
          case "repeat_buyers": query = query.gte("order_count", 2); break;
          case "high_value": query = query.gte("order_count", 5); break;
          case "recent_30d": query = query.gte("updated_at", new Date(Date.now() - 30*24*60*60*1000).toISOString()); break;
          case "inactive_90d": query = query.lt("updated_at", new Date(Date.now() - 90*24*60*60*1000).toISOString()); break;
        }

        const { data, error } = await query;
        if (error) throw error;
        setSegmentPhones((data || []).map((c: any) => c.phone).filter(Boolean));
      }
    } catch (e: any) {
      toast({ title: "Error loading segment", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Custom Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5" />
            Advanced Filters
          </CardTitle>
          <CardDescription>Filter customers by product, category, and date range</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Product</Label>
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Any product" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Any product</SelectItem>
                  {products?.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Any category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Any category</SelectItem>
                  {categories.map((c: string) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Date Range</Label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="All time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="7days">Last 7 days</SelectItem>
                  <SelectItem value="30days">Last 30 days</SelectItem>
                  <SelectItem value="custom">Custom range</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {dateFilter === "custom" && (
            <div className="flex gap-3">
              <div className="space-y-1">
                <Label className="text-[11px]">From</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("w-[140px] justify-start text-left text-xs", !customDateFrom && "text-muted-foreground")}>
                      <CalendarIcon className="mr-1.5 h-3 w-3" />
                      {customDateFrom ? format(customDateFrom, "dd MMM yyyy") : "Start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customDateFrom} onSelect={setCustomDateFrom} className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">To</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("w-[140px] justify-start text-left text-xs", !customDateTo && "text-muted-foreground")}>
                      <CalendarIcon className="mr-1.5 h-3 w-3" />
                      {customDateTo ? format(customDateTo, "dd MMM yyyy") : "End date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customDateTo} onSelect={setCustomDateTo} className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          <Button
            size="sm"
            onClick={() => loadSegment("filtered")}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Search className="h-3.5 w-3.5 mr-1" />}
            Apply Filters
          </Button>
        </CardContent>
      </Card>

      {/* Quick Segments */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {segments.filter(s => s.id !== "filtered").map((seg) => (
          <Card
            key={seg.id}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              selectedSegment === seg.id ? "ring-2 ring-primary" : ""
            )}
            onClick={() => loadSegment(seg.id)}
          >
            <CardContent className="p-4 text-center">
              <seg.icon className={`h-6 w-6 mx-auto mb-2 ${seg.color}`} />
              <p className="text-sm font-medium">{seg.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{seg.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {selectedSegment && !loading && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {segmentPhones.length} customers found
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(segmentPhones.join("\n"));
                    toast({ title: "Copied!", description: `${segmentPhones.length} numbers copied to clipboard` });
                  }}
                  disabled={!segmentPhones.length}
                >
                  Copy All
                </Button>
                {onSendToBulk && (
                  <Button
                    size="sm"
                    onClick={() => {
                      onSendToBulk(segmentPhones);
                      toast({ title: "Sent to Bulk!", description: `${segmentPhones.length} numbers added to Bulk tab` });
                    }}
                    disabled={!segmentPhones.length}
                  >
                    <Send className="h-3.5 w-3.5 mr-1" /> Send to Bulk
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-32 overflow-y-auto bg-muted/50 rounded p-2 space-y-0.5">
              {segmentPhones.slice(0, 20).map((p, i) => (
                <p key={i} className="text-xs font-mono">{p}</p>
              ))}
              {segmentPhones.length > 20 && (
                <p className="text-xs text-muted-foreground">...and {segmentPhones.length - 20} more</p>
              )}
              {segmentPhones.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">No customers match this filter</p>
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

// ─── Mode Selection Screen ──────────────────────────────────────────
function ModeSelectionScreen({ storeId, onSelect }: { storeId: string; onSelect: (mode: "storivo" | "own") => void }) {
  const queryClient = useQueryClient();
  const [selecting, setSelecting] = useState<string | null>(null);

  const selectMutation = useMutation({
    mutationFn: async (mode: "storivo" | "own") => {
      // Check if config exists
      const { data: existing } = await supabase
        .from("whatsapp_config")
        .select("id")
        .eq("store_id", storeId)
        .maybeSingle();

      if (existing) {
        const { error } = await (supabase as any)
          .from("whatsapp_config")
          .update({ marketing_mode: mode })
          .eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("whatsapp_config").insert({
          store_id: storeId,
          marketing_mode: mode,
          access_token: "",
          phone_number_id: "",
          is_active: mode === "storivo",
        });
        if (error) throw error;
      }
      return mode;
    },
    onSuccess: (mode) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-config", storeId] });
      onSelect(mode);
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setSelecting(null);
    },
  });

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-xl font-bold flex items-center justify-center gap-2">
          <MessageSquare className="h-6 w-6 text-green-600" />
          WhatsApp Marketing
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose how you want to send WhatsApp messages to your customers
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
        {/* Storivo Marketing Card */}
        <Card
          className={cn(
            "cursor-pointer transition-all hover:shadow-md border-2",
            selecting === "storivo" ? "border-green-500 bg-green-50/50" : "border-border hover:border-green-300"
          )}
          onClick={() => {
            setSelecting("storivo");
            selectMutation.mutate("storivo");
          }}
        >
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-2">
              <Zap className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-base">ShopBanao Marketing</CardTitle>
            <CardDescription className="text-xs">Recommended • No setup needed</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Messages sent from Storivo's WhatsApp number. Order confirmations, shipping updates, abandoned cart recovery — all automated instantly.
            </p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-green-500" /> Zero setup required</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-green-500" /> All automations included</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-green-500" /> Start sending immediately</li>
            </ul>
            <Button
              className="w-full"
              disabled={selectMutation.isPending}
              variant={selecting === "storivo" ? "default" : "outline"}
            >
              {selecting === "storivo" && selectMutation.isPending ? "Setting up..." : "Use Storivo Marketing"}
            </Button>
          </CardContent>
        </Card>

        {/* Own Business API Card */}
        <Card
          className={cn(
            "cursor-pointer transition-all hover:shadow-md border-2",
            selecting === "own" ? "border-blue-500 bg-blue-50/50" : "border-border hover:border-blue-300"
          )}
          onClick={() => {
            setSelecting("own");
            selectMutation.mutate("own");
          }}
        >
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
              <Settings className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle className="text-base">Your Own WhatsApp API</CardTitle>
            <CardDescription className="text-xs">Full control • Requires Meta setup</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Use your own Meta WhatsApp Business API number. Full control over messaging, branding, and conversations from your number.
            </p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-blue-500" /> Messages from your number</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-blue-500" /> Full chat & bulk messaging</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-blue-500" /> Complete control</li>
            </ul>
            <Button
              className="w-full"
              disabled={selectMutation.isPending}
              variant={selecting === "own" ? "default" : "outline"}
            >
              {selecting === "own" && selectMutation.isPending ? "Setting up..." : "Use Own Business API"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Storivo Mode Dashboard ─────────────────────────────────────────
function StorivoModeDashboard({ storeId, onSwitchMode }: { storeId: string; onSwitchMode: () => void }) {
  const [activeTab, setActiveTab] = useState("automations");
  const [bulkNumbers, setBulkNumbers] = useState<string[]>([]);

  const handleSendToBulk = (phones: string[]) => {
    setBulkNumbers(phones);
    setActiveTab("bulk");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-green-600" />
            Storivo Marketing
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Automated WhatsApp messages via Storivo's number
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-green-100 text-green-700 border-green-200">
            <Zap className="h-3 w-3 mr-1" /> Storivo Mode
          </Badge>
          <Button variant="ghost" size="sm" onClick={onSwitchMode} className="text-xs">
            Switch to Own API
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-5">
          <TabsTrigger value="automations" className="text-[11px]">
            <Zap className="h-3 w-3 mr-1" /> Auto
          </TabsTrigger>
          <TabsTrigger value="segments" className="text-[11px]">
            <Target className="h-3 w-3 mr-1" /> Segments
          </TabsTrigger>
          <TabsTrigger value="bulk" className="text-[11px]">
            <Megaphone className="h-3 w-3 mr-1" /> Bulk
          </TabsTrigger>
          <TabsTrigger value="templates" className="text-[11px]">
            <FileCheck className="h-3 w-3 mr-1" /> Templates
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-[11px]">
            <BarChart3 className="h-3 w-3 mr-1" /> Stats
          </TabsTrigger>
        </TabsList>

        <TabsContent value="automations" className="mt-4">
          <AutomationsTab storeId={storeId} />
        </TabsContent>
        <TabsContent value="segments" className="mt-4">
          <SegmentationTab storeId={storeId} onSendToBulk={handleSendToBulk} />
        </TabsContent>
        <TabsContent value="bulk" className="mt-4">
          <BulkMessagingTab storeId={storeId} initialNumbers={bulkNumbers} />
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          <MetaTemplatesTab storeId={storeId} />
        </TabsContent>
        <TabsContent value="analytics" className="mt-4">
          <AnalyticsTab storeId={storeId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Own Mode Dashboard (Full 8-tab) ────────────────────────────────
function OwnModeDashboard({ storeId, onSwitchMode }: { storeId: string; onSwitchMode: () => void }) {
  const [activeTab, setActiveTab] = useState<string | undefined>();
  const [bulkNumbers, setBulkNumbers] = useState<string[]>([]);

  const handleSendToBulk = (phones: string[]) => {
    setBulkNumbers(phones);
    setActiveTab("bulk");
  };

  const { data: config } = useQuery({
    queryKey: ["whatsapp-config-own", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_config")
        .select("id, is_active, access_token, phone_number_id" as any)
        .eq("store_id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const isConnected = !!(config?.access_token && config?.phone_number_id && config?.is_active);
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
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Badge className="bg-green-100 text-green-700 border-green-200">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              <AlertCircle className="h-3 w-3 mr-1" /> Not Connected
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={onSwitchMode} className="text-xs">
            Switch to Storivo
          </Button>
        </div>
      </div>

      <Tabs value={defaultTab} onValueChange={setActiveTab}>
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
          <SetupTab storeId={storeId} />
        </TabsContent>
        <TabsContent value="chat" className="mt-4">
          <ChatTab storeId={storeId} />
        </TabsContent>
        <TabsContent value="bulk" className="mt-4">
          <BulkMessagingTab storeId={storeId} initialNumbers={bulkNumbers} />
        </TabsContent>
        <TabsContent value="automations" className="mt-4">
          <AutomationsTab storeId={storeId} />
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          <MetaTemplatesTab storeId={storeId} />
        </TabsContent>
        <TabsContent value="segments" className="mt-4">
          <SegmentationTab storeId={storeId} onSendToBulk={handleSendToBulk} />
        </TabsContent>
        <TabsContent value="schedule" className="mt-4">
          <ScheduleTab storeId={storeId} />
        </TabsContent>
        <TabsContent value="optout" className="mt-4">
          <OptOutTab storeId={storeId} />
        </TabsContent>
        <TabsContent value="analytics" className="mt-4">
          <AnalyticsTab storeId={storeId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Coming Soon Lock Screen ────────────────────────────────────────
function WhatsAppComingSoon() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="relative mb-6">
        <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 flex items-center justify-center">
          <MessageSquare className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        <div className="absolute -top-2 -right-2 bg-amber-100 dark:bg-amber-900/50 rounded-full p-1.5">
          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">WhatsApp Marketing</h1>
      <Badge variant="outline" className="mb-4 border-amber-300 text-amber-600 dark:border-amber-500 dark:text-amber-400 text-sm px-3 py-1">
        Coming Soon
      </Badge>
      <p className="text-muted-foreground max-w-md mb-6 leading-relaxed">
        Automated order notifications, abandoned cart recovery, bulk campaigns, and more — all via WhatsApp. 
        We're putting the finishing touches on this feature.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg w-full">
        {[
          { icon: ShoppingCart, label: "Order Notifications" },
          { icon: Users, label: "Bulk Campaigns" },
          { icon: TrendingUp, label: "Cart Recovery" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-card">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────
export default function WhatsAppMarketing() {
  return <WhatsAppComingSoon />;
}
