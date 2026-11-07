import React, { useState, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppMode } from "@/hooks/useWhatsAppMode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { WaMediaBubble } from "@/components/whatsapp/WaMediaBubble";
import {
  MessageSquare, Send, XCircle, Clock, Search,
  Check, CheckCheck, ArrowLeft, Loader2,
} from "lucide-react";

export function AdminChatTab() {
  const queryClient = useQueryClient();
  const { isPlatformOnly } = useWhatsAppMode();
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [inboxFilter, setInboxFilter] = useState("incoming");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: allMessages, isPending, error: inboxError, refetch } = useQuery({
    queryKey: ["admin-whatsapp-all-messages", inboxFilter],
    queryFn: async () => {
      // Paginate so busy platform inboxes don't lose older threads at 1000.
      const PAGE = 1000;
      const rows: any[] = [];
      for (let from = 0; from < 10_000; from += PAGE) {
        let request = supabase
          .from("whatsapp_messages")
          .select("*, stores:store_id(name, slug)")
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (inboxFilter === "incoming") request = request.eq("direction", "incoming");
        const { data, error } = await request;
        if (error) throw error;
        const batch = (data || []) as any[];
        rows.push(...batch);
        if (batch.length < PAGE) break;
      }
      return rows;
    },
    refetchInterval: () => (typeof document !== "undefined" && document.visibilityState === "visible") ? 15000 : false,
    refetchOnWindowFocus: true,
  });

  // 🔴 Realtime — new messages (incoming webhook or outbound send) appear instantly
  // instead of waiting up to 60s for the poll.
  React.useEffect(() => {
    const ch = supabase
      .channel("admin-wa-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_messages" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-whatsapp-all-messages"] });
        queryClient.invalidateQueries({ queryKey: ["admin-whatsapp-thread"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  const prettyTemplateName = (raw: string | null | undefined) => {
    if (!raw) return "";
    const media: Record<string, string> = {
      "[audio]": "🎤 Voice message",
      "[image]": "🖼️ Photo",
      "[video]": "🎬 Video",
      "[document]": "📄 Document",
    };
    if (media[raw]) return media[raw];
    const m = /\[template:([^\]]+)\]/.exec(raw);
    if (!m) return raw;
    // order_confirmation_v2 → "📦 Order confirmation"
    const map: Record<string, string> = {
      order_confirmation: "📦 Order confirmation",
      order_shipped: "🚚 Order shipped",
      payment_success: "💳 Payment received",
      order_delivered: "✅ Delivered",
      abandoned_cart: "🛒 Cart reminder",
      review_request: "⭐ Review request",
    };
    const base = m[1].replace(/_v\d+$/, "");
    return map[base] || base.replace(/_/g, " ");
  };

  const conversations = useMemo(() => {
    if (!allMessages) return [];
    // Pass 1: build a phone → best-known store_id index so orphaned rows
    // (incoming messages that arrived before we could resolve a store) merge
    // into the same customer thread instead of creating an "Unknown Store" ghost.
    const phoneToStore = new Map<string, string>();
    for (const m of allMessages as any[]) {
      const phone = m.direction === "incoming" ? (m.sender_phone || m.recipient_phone) : m.recipient_phone;
      if (!phone || !m.store_id) continue;
      if (!phoneToStore.has(phone)) phoneToStore.set(phone, m.store_id);
    }

    const map = new Map<string, any>();
    for (const msg of allMessages) {
      const m = msg as any;
      const phone = m.direction === "incoming" ? (m.sender_phone || m.recipient_phone) : m.recipient_phone;
      if (!phone) continue;
      const effectiveStoreId = m.store_id || phoneToStore.get(phone) || null;
      const key = `${effectiveStoreId}_${phone}`;
      const storeName = m.stores?.name || "ShopBanao · Unassigned";
      // "there" is the template fallback we send when we have no real name —
      // don't treat it as a customer name in the inbox.
      const cleanName = (n: string | null | undefined) =>
        n && n.trim() && n.trim().toLowerCase() !== "there" ? n.trim() : null;
      if (!map.has(key)) {
        map.set(key, { phone, storeId: effectiveStoreId, storeName, name: cleanName(msg.recipient_name), messages: [], lastMessage: msg, unread: 0, lastIncomingAt: null });
      }
      const conv = map.get(key);
      if (!conv) continue;
      // storeName: prefer any non-Unknown label we encounter.
      if (conv.storeName === "ShopBanao · Unassigned" && m.stores?.name) conv.storeName = m.stores.name;
      conv.messages.push(msg);
      if (m.direction === "incoming") {
        if (msg.status === "received") conv.unread++;
        if (!conv.lastIncomingAt || new Date(msg.created_at) > new Date(conv.lastIncomingAt)) conv.lastIncomingAt = msg.created_at;
      }
      if (!conv.name) {
        const cn = cleanName(msg.recipient_name);
        if (cn) conv.name = cn;
      }
      // Newest message wins for the list preview.
      if (new Date(msg.created_at) > new Date(conv.lastMessage.created_at)) conv.lastMessage = msg;
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
    );
  }, [allMessages]);


  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => c.phone.includes(q) || (c.name && c.name.toLowerCase().includes(q)) || c.storeName.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  const { data: selectedConversation = [], error: threadError, isPending: threadPending } = useQuery({
    queryKey: ["admin-whatsapp-thread", selectedPhone, selectedStoreId],
    enabled: !!selectedPhone,
    queryFn: async () => {
      if (!selectedPhone) return [];
      let request = supabase.from("whatsapp_messages").select("*")
        .eq("recipient_phone", selectedPhone).order("created_at", { ascending: false }).limit(100);
      request = selectedStoreId ? request.eq("store_id", selectedStoreId) : request.is("store_id", null);
      const { data, error } = await request;
      if (error) throw error;
      return [...(data || [])].reverse();
    },
    refetchInterval: () => document.visibilityState === "visible" ? 15000 : false,
  });

  const currentConv = useMemo(
    () => conversations.find((c) => c.phone === selectedPhone && (c.storeId ?? null) === (selectedStoreId ?? null)),
    [selectedPhone, selectedStoreId, conversations]
  );

  React.useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [selectedConversation]);

  // Auto-mark the thread as read the moment it's opened (WhatsApp-style).
  React.useEffect(() => {
    if (!selectedPhone || !currentConv || currentConv.unread === 0) return;
    supabase.rpc("admin_wa_mark_thread_read" as any, { _phone: selectedPhone, _store_id: selectedStoreId })
      .then(() => queryClient.invalidateQueries({ queryKey: ["admin-whatsapp-all-messages"] }));
  }, [selectedPhone, selectedStoreId, currentConv, queryClient]);


  // 24h session window — Meta rejects free-form text after 24h since last inbound.
  // Compute it client-side so the admin sees WHY instead of a raw non-2xx error.
  const sessionWindowOpen = useMemo(() => {
    const at = currentConv?.lastIncomingAt;
    if (!at) return false;
    return Date.now() - new Date(at).getTime() < 24 * 60 * 60 * 1000;
  }, [currentConv]);

  const lastIncomingLabel = useMemo(() => {
    const at = currentConv?.lastIncomingAt;
    if (!at) return null;
    const hrs = Math.floor((Date.now() - new Date(at).getTime()) / 3_600_000);
    if (hrs < 48) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }, [currentConv]);

  // supabase-js masks edge-function failures as "non-2xx status code".
  // Read the JSON body so the real reason reaches the toast.
  const edgeErrorMessage = async (err: any): Promise<string> => {
    try {
      const ctx = err?.context;
      if (ctx && typeof ctx.json === "function") {
        const b = await ctx.clone().json();
        if (b?.error) return String(b.details ? `${b.error}: ${b.details}` : b.error);
      }
    } catch { /* fall through */ }
    return err?.message || "Unknown error";
  };

  const REASONS: Record<string, string> = {
    outside_24h_session: "The customer hasn't messaged in the last 24 hours. WhatsApp blocks free-form replies — send an approved template instead.",
    wa_disabled: "Platform WhatsApp is disabled or credentials are missing.",
    opted_out: "This number has opted out of messages.",
    forbidden: "You don't have permission to send for this store.",
    send_failed: "Meta rejected the message.",
  };

  const sendMessage = async () => {
    if (!selectedPhone || !message.trim()) return;
    if (!sessionWindowOpen) {
      toast({ title: "Reply window closed", description: REASONS.outside_24h_session, variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      if (isPlatformOnly) {
        // Platform shared number — free-form text reply within the 24h session window.
        const res = await supabase.functions.invoke("wa-platform-send", {
          body: {
            mode: "text",
            store_id: selectedStoreId,
            recipient_phone: selectedPhone,
            message_body: message.trim(),
            message_type: "text_reply",
          },
        });
        if (res.error) throw new Error(await edgeErrorMessage(res.error));
        const d = res.data as any;
        if (d?.error) throw new Error(String(d.error));
        if (d?.skipped) throw new Error(REASONS[d.reason] || `Skipped: ${d.reason}`);
      } else {
        if (!selectedStoreId) return;
        const res = await supabase.functions.invoke("whatsapp-send", {
          body: { store_id: selectedStoreId, recipient_phone: selectedPhone, message_body: message.trim(), message_type: "manual" },
        });
        if (res.error) throw new Error(await edgeErrorMessage(res.error));
        if ((res.data as any)?.error) throw new Error((res.data as any).error);
      }
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-whatsapp-all-messages"] });
      queryClient.invalidateQueries({ queryKey: ["admin-whatsapp-thread"] });
      inputRef.current?.focus();
    } catch (e: any) {
      const raw = String(e?.message || "");
      const key = Object.keys(REASONS).find((k) => raw.includes(k));
      toast({ title: "Failed to send", description: key ? REASONS[key] : raw || "Unknown error", variant: "destructive" });
    } finally { setSending(false); }
  };


  const markThreadRead = async () => {
    if (!selectedPhone) return;
    await supabase.rpc("admin_wa_mark_thread_read" as any, { _phone: selectedPhone, _store_id: selectedStoreId });
    queryClient.invalidateQueries({ queryKey: ["admin-whatsapp-all-messages"] });
  };


  const formatTime = (s: string) => new Date(s).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const formatListDate = (s: string) => {
    const d = new Date(s); const today = new Date();
    if (d.toDateString() === today.toDateString()) return formatTime(s);
    const y = new Date(today); y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };
  const formatDate = (s: string) => {
    const d = new Date(s); const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    const y = new Date(today); y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return "Yesterday";
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
  const getInitials = (name: string | null, phone: string) =>
    name ? name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) : phone.slice(-2);
  const getAvatarColor = (phone: string) => {
    const colors = ["bg-emerald-500", "bg-blue-500", "bg-purple-500", "bg-orange-500", "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-amber-500"];
    const hash = phone.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  return (
    <div className="border rounded-xl overflow-hidden bg-background shadow-sm" style={{ height: "calc(100vh - 220px)", minHeight: 450 }}>
      <div className="flex h-full">
        <div className={`${selectedPhone ? "hidden md:flex" : "flex"} flex-col w-full md:w-[360px] md:min-w-[320px] border-r`}>
          <div className="px-4 py-3 bg-muted flex items-center justify-between">
            <h3 className="font-semibold text-[15px]">All Chats (Admin)</h3>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setShowSearch(!showSearch)}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
          <RadioGroup value={inboxFilter} onValueChange={setInboxFilter} className="flex gap-4 border-b px-4 py-2">
            <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="incoming" />Incoming</label>
            <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="all" />All messages</label>
          </RadioGroup>
          {showSearch && (
            <div className="px-3 py-2 border-b">
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by name, phone, or store..." className="text-sm h-8" autoFocus />
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {isPending ? <div role="status" className="p-6 text-muted-foreground">Loading messages…</div> : inboxError ? (
              <div role="alert" className="p-6 text-destructive">Messages couldn’t load.<Button variant="outline" onClick={() => refetch()}>Try again</Button></div>
            ) : !filteredConversations.length ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
                <MessageSquare className="h-10 w-10 opacity-30 mb-3" />
                <p className="text-sm">No conversations yet</p>
              </div>
            ) : filteredConversations.map((conv) => {
              const isActive = selectedPhone === conv.phone && selectedStoreId === conv.storeId;
              return (
                <Button variant="ghost" key={`${conv.storeId}_${conv.phone}`}
                  onClick={() => { setSelectedPhone(conv.phone); setSelectedStoreId(conv.storeId); }}
                  className={cn("h-auto rounded-none w-full text-left px-3 py-3 flex items-center gap-3 transition-colors border-b border-border/50", isActive ? "bg-accent" : "hover:bg-muted/50")}>
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
                        {prettyTemplateName(conv.lastMessage.message_body)?.slice(0, 32)}
                      </p>
                      {conv.unread > 0 && (
                        <span className="ml-2 h-5 min-w-[20px] rounded-full bg-[hsl(142,72%,40%)] text-white text-[11px] font-bold flex items-center justify-center px-1.5">
                          {conv.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        </div>

        <div className={`${!selectedPhone ? "hidden md:flex" : "flex"} flex-col flex-1 min-w-0`}>
          {!selectedPhone ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/30">
              <MessageSquare className="h-16 w-16 opacity-20 mb-4" />
              <p className="text-lg font-light">Admin WhatsApp Hub</p>
              <p className="text-sm mt-2">Monitor all store conversations in real-time</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-3 py-2.5 border-b bg-muted">
                <Button variant="ghost" size="icon" className="h-9 w-9 md:hidden" onClick={() => setSelectedPhone(null)}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm", getAvatarColor(selectedPhone))}>
                  {getInitials(currentConv?.name || null, selectedPhone)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium truncate">{currentConv?.name || selectedPhone}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Store: <span className="font-medium">{currentConv?.storeName}</span>
                    {isPlatformOnly && <span className="ml-2 text-[10px] uppercase tracking-wide text-emerald-700">· shared #</span>}
                  </p>
                </div>
                {(currentConv?.unread ?? 0) > 0 && (
                  <Button size="sm" variant="outline" onClick={markThreadRead}>Mark read</Button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 bg-muted/20">
                {threadPending && <p role="status" className="text-sm text-muted-foreground">Loading conversation…</p>}
                {threadError && <p role="alert" className="text-sm text-destructive">Conversation couldn’t load.</p>}
                {selectedConversation.map((msg: any, idx: number) => {
                  const isOutgoing = msg.direction !== "incoming";
                  const showDate = idx === 0 || formatDate(msg.created_at) !== formatDate(selectedConversation[idx - 1].created_at);
                  return (
                    <React.Fragment key={msg.id}>
                      {showDate && (
                        <div className="flex justify-center py-2">
                          <span className="bg-muted rounded-lg px-3 py-1 text-[11px] text-muted-foreground font-medium shadow-sm">{formatDate(msg.created_at)}</span>
                        </div>
                      )}
                      <div className={cn("flex mb-0.5", isOutgoing ? "justify-end" : "justify-start")}>
                        <div className={cn("max-w-[75%] rounded-lg px-3 py-1.5 shadow-sm", isOutgoing ? "bg-[hsl(142,40%,90%)] rounded-tr-sm" : "bg-card rounded-tl-sm border")}>
                          {msg.media_type && (
                            <WaMediaBubble messageId={msg.id} mediaType={msg.media_type} />
                          )}
                          {(() => {
                            const raw = (msg.message_body || "").trim();
                            // "[audio]" / "[image]" is only a placeholder — the player replaces it.
                            if (msg.media_type && (!raw || raw === `[${msg.media_type}]`)) return null;
                            return <p className="text-[13px] whitespace-pre-wrap break-words">{prettyTemplateName(msg.message_body)}</p>;
                          })()}
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
              {!sessionWindowOpen && (
                <div className="border-t bg-amber-50 px-3 py-2 text-[12px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                  24-hour reply window closed{lastIncomingLabel ? ` (last customer message ${lastIncomingLabel})` : ""}. WhatsApp only allows an approved template now — use Campaigns / Templates.
                </div>
              )}
              <div className="flex items-end gap-2 px-3 py-2 border-t bg-muted/50">
                <Textarea ref={inputRef} value={message} onChange={(e) => setMessage(e.target.value)} rows={1}
                  placeholder={sessionWindowOpen ? "Type a message" : "Reply window closed — send a template instead"}
                  disabled={!sessionWindowOpen}
                  className="text-[14px] resize-none min-h-[38px] max-h-[120px] rounded-xl bg-background flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
                <Button size="icon" className="h-9 w-9 shrink-0 rounded-full bg-[hsl(142,72%,40%)] hover:bg-[hsl(142,72%,35%)] text-white"
                  onClick={sendMessage} disabled={sending || !message.trim() || !sessionWindowOpen}>
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
