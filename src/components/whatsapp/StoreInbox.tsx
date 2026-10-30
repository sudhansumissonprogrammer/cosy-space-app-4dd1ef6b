import React, { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { WaMediaBubble } from "@/components/whatsapp/WaMediaBubble";
import {
  MessageSquare, Send, Search, Check, CheckCheck, Clock, XCircle,
  ArrowLeft, Loader2,
} from "lucide-react";

const THREAD_PAGE = 30;
const MSG_PAGE = 40;

type Thread = {
  phone: string;
  name: string | null;
  last_body: string | null;
  last_media_type: string | null;
  last_direction: string | null;
  last_status: string | null;
  last_at: string;
  unread: number;
  last_incoming_at: string | null;
  total_threads: number;
};

type Msg = {
  id: string;
  direction: string;
  message_body: string | null;
  media_type: string | null;
  status: string | null;
  created_at: string;
};

/* ---------- display helpers ---------- */

const prettyBody = (raw: string | null | undefined) => {
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
  const map: Record<string, string> = {
    order_confirmation: "📦 Order confirmation",
    order_shipped: "🚚 Order shipped",
    payment_success: "💳 Payment received",
    order_delivered: "✅ Delivered",
    abandoned_cart: "🛒 Cart reminder",
    review_request: "⭐ Review request",
  };
  const base = m[1].replace(/_v\d+.*$/, "");
  return map[base] || base.replace(/_/g, " ");
};

const AVATAR_COLORS = [
  "bg-emerald-500", "bg-sky-500", "bg-violet-500", "bg-amber-500",
  "bg-rose-500", "bg-teal-500", "bg-indigo-500",
];
const avatarColor = (phone: string) => {
  let h = 0;
  for (let i = 0; i < phone.length; i++) h = (h * 31 + phone.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};
const initials = (name: string | null, phone: string) =>
  name?.trim() ? name.trim().slice(0, 2).toUpperCase() : phone.slice(-2);

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(today); y.setDate(y.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};
const fmtListDate = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return fmtTime(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

const statusIcon = (status: string | null) => {
  switch (status) {
    case "read": return <CheckCheck className="h-3 w-3 text-sky-500" />;
    case "delivered": return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
    case "sent": return <Check className="h-3 w-3 text-muted-foreground" />;
    case "failed": return <XCircle className="h-3 w-3 text-destructive" />;
    default: return <Clock className="h-3 w-3 text-muted-foreground" />;
  }
};

const edgeErrorMessage = async (err: any): Promise<string> => {
  try {
    const ctx = err?.context;
    if (ctx && typeof ctx.json === "function") {
      const b = await ctx.clone().json();
      if (b?.error) return String(b.details ? `${b.error}: ${b.details}` : b.error);
    }
  } catch { /* ignore */ }
  return err?.message || "Unknown error";
};

/* ---------- component ---------- */

export function StoreInbox({ storeId }: { storeId: string | undefined }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [threadFilter, setThreadFilter] = useState<"all" | "replied">("all");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevMessagesLength = useRef(0);
  const isLoadingOlderRef = useRef(false);
  const prevScrollHeightRef = useRef(0);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  /* threads — offset pagination, 30/page */
  const threadsQuery = useInfiniteQuery({
    queryKey: ["store-wa-threads", storeId, debounced, threadFilter],
    enabled: !!storeId,
    initialPageParam: 0,
    staleTime: 30_000,
    refetchInterval: 15_000,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc(threadFilter === "replied" ? "store_wa_replied_threads" : "store_wa_threads", {
        _store_id: storeId,
        _search: debounced || null,
        _limit: THREAD_PAGE,
        _offset: pageParam as number,
      });
      if (error) throw error;
      return (data || []) as Thread[];
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((n, p) => n + p.length, 0);
      const total = Number(lastPage[0]?.total_threads ?? loaded);
      return loaded < total ? loaded : undefined;
    },
  });

  const threads = useMemo(
    () => (threadsQuery.data?.pages || []).flat(),
    [threadsQuery.data],
  );

  const currentThread = useMemo(
    () => threads.find((t) => t.phone === selectedPhone) || null,
    [threads, selectedPhone],
  );

  /* messages — keyset pagination, newest first, 40/page */
  const messagesQuery = useInfiniteQuery({
    queryKey: ["store-wa-thread", storeId, selectedPhone],
    enabled: !!storeId && !!selectedPhone,
    initialPageParam: null as string | null,
    staleTime: 15_000,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("store_wa_thread_messages" as any, {
        _store_id: storeId,
        _phone: selectedPhone,
        _before: pageParam,
        _limit: MSG_PAGE,
      });
      if (error) throw error;
      return (data || []) as Msg[];
    },
    getNextPageParam: (lastPage) =>
      lastPage.length === MSG_PAGE ? lastPage[lastPage.length - 1].created_at : undefined,
  });

  // oldest → newest for rendering
  const messages = useMemo(() => {
    const flat = (messagesQuery.data?.pages || []).flat();
    return [...flat].reverse();
  }, [messagesQuery.data]);

  /* scroll behaviour:
     - initial thread open → jump to bottom
     - new message appended while user is near bottom → scroll to bottom
     - loading older messages → preserve the visual scroll position so the user
       stays at the same message rather than being yanked down */

  useEffect(() => {
    if (selectedPhone && !messagesQuery.isLoading && messages.length > 0) {
      scrollToBottom("auto");
      prevMessagesLength.current = messages.length;
    }
  }, [selectedPhone, messagesQuery.isLoading, messages.length]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (messages.length > prevMessagesLength.current) {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      if (distanceFromBottom < 200) {
        scrollToBottom();
      }
    }
    prevMessagesLength.current = messages.length;
  }, [messages.length]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !isLoadingOlderRef.current || messagesQuery.isFetchingNextPage) return;

    const addedHeight = container.scrollHeight - prevScrollHeightRef.current;
    container.scrollTop = addedHeight; // keep the prior top content pinned
    isLoadingOlderRef.current = false;
  }, [messagesQuery.isFetchingNextPage]);

  /* realtime — only this store's rows */
  useEffect(() => {
    if (!storeId) return;
    const ch = supabase
      .channel(`store-wa-inbox-${storeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_messages", filter: `store_id=eq.${storeId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["store-wa-threads", storeId] });
          queryClient.invalidateQueries({ queryKey: ["store-wa-thread", storeId] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [storeId, queryClient]);

  /* mark read on open */
  useEffect(() => {
    if (!storeId || !selectedPhone || !currentThread || currentThread.unread === 0) return;
    supabase
      .rpc("store_wa_mark_thread_read" as any, { _store_id: storeId, _phone: selectedPhone })
      .then(() => queryClient.invalidateQueries({ queryKey: ["store-wa-threads", storeId] }));
  }, [storeId, selectedPhone, currentThread, queryClient]);

  const sessionOpen = useMemo(() => {
    const at = currentThread?.last_incoming_at;
    if (!at) return false;
    return Date.now() - new Date(at).getTime() < 24 * 60 * 60 * 1000;
  }, [currentThread]);

  const lastIncomingLabel = useMemo(() => {
    const at = currentThread?.last_incoming_at;
    if (!at) return null;
    const hrs = Math.floor((Date.now() - new Date(at).getTime()) / 3_600_000);
    return hrs < 48 ? `${hrs}h ago` : `${Math.floor(hrs / 24)}d ago`;
  }, [currentThread]);

  const sendMessage = async () => {
    if (!storeId || !selectedPhone || !message.trim()) return;
    if (!sessionOpen) {
      toast({
        title: "Reply window closed",
        description: "The customer hasn't messaged in the last 24 hours. WhatsApp blocks free-form replies — an approved template is required.",
        variant: "destructive",
      });
      return;
    }
    setSending(true);
    try {
      const res = await supabase.functions.invoke("wa-platform-send", {
        body: {
          mode: "text",
          store_id: storeId,
          recipient_phone: selectedPhone,
          message_body: message.trim(),
          message_type: "text_reply",
        },
      });
      if (res.error) throw new Error(await edgeErrorMessage(res.error));
      const d = res.data as any;
      if (d?.error) throw new Error(String(d.details ? `${d.error}: ${d.details}` : d.error));
      setMessage("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["store-wa-thread", storeId, selectedPhone] }),
        queryClient.invalidateQueries({ queryKey: ["store-wa-threads", storeId] }),
      ]);
      scrollToBottom();
    } catch (e: any) {
      toast({ title: "Could not send", description: e?.message || "Unknown error", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (!storeId) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-13rem)] min-h-[480px] overflow-hidden rounded-xl border bg-background">
      {/* Thread list */}
      <div className={cn("w-full flex-col border-r md:flex md:w-[320px] md:shrink-0", selectedPhone ? "hidden md:flex" : "flex")}>
        <div className="border-b p-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or number"
              className="h-9 rounded-full pl-8 text-[13px]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <ToggleGroup
            type="single"
            value={threadFilter}
            onValueChange={(value) => {
              if (value !== "all" && value !== "replied") return;
              setThreadFilter(value);
              setSelectedPhone(null);
            }}
            aria-label="Conversation filter"
            className="sticky top-0 z-10 justify-start border-b bg-background p-2"
          >
            <ToggleGroupItem value="all" size="sm" className="flex-1 gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> All
            </ToggleGroupItem>
            <ToggleGroupItem value="replied" size="sm" className="flex-1 gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" /> Replied only
            </ToggleGroupItem>
          </ToggleGroup>
          {threadsQuery.isError ? (
            <div className="space-y-3 p-6 text-center">
              <p className="text-sm text-destructive">Could not load conversations</p>
              <Button variant="outline" size="sm" onClick={() => threadsQuery.refetch()}>Try again</Button>
            </div>
          ) : threadsQuery.isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !threads.length ? (
            <div className="flex h-full flex-col items-center justify-center p-6 text-muted-foreground">
              <MessageSquare className="mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm">{debounced ? "No matching conversations" : threadFilter === "replied" ? "No customer replies yet" : "No conversations yet"}</p>
            </div>
          ) : (
            <>
              {threads.map((t) => {
                const isActive = t.phone === selectedPhone;
                return (
                  <button
                    key={t.phone}
                    onClick={() => setSelectedPhone(t.phone)}
                    className={cn(
                      "flex w-full items-center gap-3 border-b border-border/50 px-3 py-3 text-left transition-colors",
                      isActive ? "bg-accent" : "hover:bg-muted/50",
                    )}
                  >
                    <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white", avatarColor(t.phone))}>
                      {initials(t.name, t.phone)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-[14px] font-medium">{t.name || t.phone}</span>
                        <span className="ml-2 shrink-0 text-[11px] text-muted-foreground">{fmtListDate(t.last_at)}</span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between">
                        <p className="flex-1 truncate text-[12px] text-muted-foreground">
                          {prettyBody(t.last_body).slice(0, 40)}
                        </p>
                        {t.unread > 0 && (
                          <span className="ml-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[hsl(142,72%,40%)] px-1.5 text-[11px] font-bold text-white">
                            {t.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
              {threadsQuery.hasNextPage && (
                <div className="p-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    disabled={threadsQuery.isFetchingNextPage}
                    onClick={() => threadsQuery.fetchNextPage()}
                  >
                    {threadsQuery.isFetchingNextPage ? "Loading…" : "Load older conversations"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Thread view */}
      <div className={cn("min-w-0 flex-1 flex-col", selectedPhone ? "flex" : "hidden md:flex")}>
        {!selectedPhone ? (
          <div className="flex h-full flex-col items-center justify-center bg-muted/30 text-muted-foreground">
            <MessageSquare className="mb-4 h-16 w-16 opacity-20" />
            <p className="text-lg font-light">Your WhatsApp inbox</p>
            <p className="mt-2 text-sm">Pick a conversation to read the full history</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b bg-muted px-3 py-2.5">
              <Button variant="ghost" size="icon" className="h-9 w-9 md:hidden" onClick={() => setSelectedPhone(null)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white", avatarColor(selectedPhone))}>
                {initials(currentThread?.name ?? null, selectedPhone)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">{currentThread?.name || selectedPhone}</p>
                <p className="text-[11px] text-muted-foreground">{selectedPhone}</p>
              </div>
            </div>

            <div ref={messagesContainerRef} className="flex-1 space-y-0.5 overflow-y-auto bg-muted/20 px-3 py-2">
              {messagesQuery.hasNextPage && (
                <div className="flex justify-center py-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled={messagesQuery.isFetchingNextPage}
                    onClick={() => {
                      const container = messagesContainerRef.current;
                      if (container) {
                        prevScrollHeightRef.current = container.scrollHeight;
                        isLoadingOlderRef.current = true;
                      }
                      messagesQuery.fetchNextPage();
                    }}
                  >
                    {messagesQuery.isFetchingNextPage ? "Loading…" : "Load older messages"}
                  </Button>
                </div>
              )}
              {messagesQuery.isLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isOutgoing = msg.direction !== "incoming";
                  const showDate = idx === 0 || fmtDate(msg.created_at) !== fmtDate(messages[idx - 1].created_at);
                  const raw = (msg.message_body || "").trim();
                  const hideText = msg.media_type && (!raw || raw === `[${msg.media_type}]`);
                  return (
                    <React.Fragment key={msg.id}>
                      {showDate && (
                        <div className="flex justify-center py-2">
                          <span className="rounded-lg bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">
                            {fmtDate(msg.created_at)}
                          </span>
                        </div>
                      )}
                      <div className={cn("mb-0.5 flex", isOutgoing ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[78%] rounded-lg px-3 py-1.5 shadow-sm",
                          isOutgoing ? "rounded-tr-sm bg-[hsl(142,40%,90%)]" : "rounded-tl-sm border bg-card",
                        )}>
                          {msg.media_type && <WaMediaBubble messageId={msg.id} mediaType={msg.media_type} />}
                          {!hideText && (
                            <p className="whitespace-pre-wrap break-words text-[13px]">{prettyBody(msg.message_body)}</p>
                          )}
                          <div className="mt-0.5 flex items-center justify-end gap-1">
                            <span className="text-[10px] text-muted-foreground">{fmtTime(msg.created_at)}</span>
                            {isOutgoing && statusIcon(msg.status)}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {!sessionOpen && (
              <div className="border-t bg-amber-50 px-3 py-2 text-[12px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                24-hour reply window closed{lastIncomingLabel ? ` (last customer message ${lastIncomingLabel})` : ""}. WhatsApp only allows automated templates now.
              </div>
            )}

            <div className="flex items-end gap-2 border-t bg-muted/50 px-3 py-2">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={1}
                placeholder={sessionOpen ? "Type a message" : "Reply window closed"}
                disabled={!sessionOpen}
                className="max-h-[120px] min-h-[38px] flex-1 resize-none rounded-xl bg-background text-[14px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                }}
              />
              <Button
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full bg-[hsl(142,72%,40%)] text-white hover:bg-[hsl(142,72%,35%)]"
                onClick={sendMessage}
                disabled={sending || !message.trim() || !sessionOpen}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
