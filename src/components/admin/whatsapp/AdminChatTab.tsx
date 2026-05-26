import React, { useState, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  MessageSquare, Send, XCircle, Clock, Search,
  Check, CheckCheck, ArrowLeft, Loader2,
} from "lucide-react";

export function AdminChatTab() {
  const queryClient = useQueryClient();
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  const conversations = useMemo(() => {
    if (!allMessages) return [];
    const map = new Map<string, any>();
    for (const msg of allMessages) {
      const m = msg as any;
      const phone = m.direction === "incoming" ? (m.sender_phone || m.recipient_phone) : m.recipient_phone;
      if (!phone) continue;
      const key = `${m.store_id}_${phone}`;
      const storeName = m.stores?.name || "Unknown Store";
      if (!map.has(key)) {
        map.set(key, { phone, storeId: m.store_id, storeName, name: msg.recipient_name, messages: [], lastMessage: msg, unread: 0, lastIncomingAt: null });
      }
      const conv = map.get(key)!;
      conv.messages.push(msg);
      if (m.direction === "incoming") {
        if (msg.status === "received") conv.unread++;
        if (!conv.lastIncomingAt || new Date(msg.created_at) > new Date(conv.lastIncomingAt)) conv.lastIncomingAt = msg.created_at;
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
    return conversations.filter((c) => c.phone.includes(q) || (c.name && c.name.toLowerCase().includes(q)) || c.storeName.toLowerCase().includes(q));
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

  React.useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [selectedConversation]);

  const sendMessage = async () => {
    if (!selectedPhone || !selectedStoreId || !message.trim()) return;
    setSending(true);
    try {
      const res = await supabase.functions.invoke("whatsapp-send", {
        body: { store_id: selectedStoreId, recipient_phone: selectedPhone, message_body: message.trim(), message_type: "manual" },
      });
      if (res.error) throw res.error;
      if ((res.data as any)?.error) throw new Error((res.data as any).error);
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-whatsapp-all-messages"] });
      inputRef.current?.focus();
    } catch (e: any) {
      toast({ title: "Failed to send", description: e.message, variant: "destructive" });
    } finally { setSending(false); }
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
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSearch(!showSearch)}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
          {showSearch && (
            <div className="px-3 py-2 border-b">
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by name, phone, or store..." className="text-sm h-8" autoFocus />
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {!filteredConversations.length ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
                <MessageSquare className="h-10 w-10 opacity-30 mb-3" />
                <p className="text-sm">No conversations yet</p>
              </div>
            ) : filteredConversations.map((conv) => {
              const isActive = selectedPhone === conv.phone && selectedStoreId === conv.storeId;
              return (
                <button key={`${conv.storeId}_${conv.phone}`}
                  onClick={() => { setSelectedPhone(conv.phone); setSelectedStoreId(conv.storeId); }}
                  className={cn("w-full text-left px-3 py-3 flex items-center gap-3 transition-colors border-b border-border/50", isActive ? "bg-accent" : "hover:bg-muted/50")}>
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
                <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={() => setSelectedPhone(null)}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm", getAvatarColor(selectedPhone))}>
                  {getInitials(currentConv?.name || null, selectedPhone)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium truncate">{currentConv?.name || selectedPhone}</p>
                  <p className="text-[11px] text-muted-foreground">Store: <span className="font-medium">{currentConv?.storeName}</span></p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 bg-muted/20">
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
              <div className="flex items-end gap-2 px-3 py-2 border-t bg-muted/50">
                <Textarea ref={inputRef} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type a message" rows={1}
                  className="text-[14px] resize-none min-h-[38px] max-h-[120px] rounded-xl bg-background flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
                <Button size="icon" className="h-9 w-9 shrink-0 rounded-full bg-[hsl(142,72%,40%)] hover:bg-[hsl(142,72%,35%)] text-white"
                  onClick={sendMessage} disabled={sending || !message.trim()}>
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
