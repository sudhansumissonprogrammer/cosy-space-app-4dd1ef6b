import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Bell, Check } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

export function NotificationsBell({ partnerId }: { partnerId: string }) {
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("partner_notifications")
      .select("*")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data as Notif[]) || []);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`partner-notif-${partnerId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "partner_notifications", filter: `partner_id=eq.${partnerId}` },
        () => load()
      ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [partnerId]);

  const unread = items.filter(n => !n.read_at).length;

  const markAllRead = async () => {
    const ids = items.filter(n => !n.read_at).map(n => n.id);
    if (!ids.length) return;
    await supabase.from("partner_notifications")
      .update({ read_at: new Date().toISOString() }).in("id", ids);
    load();
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline">
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-auto">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">No notifications yet</p>
          ) : items.map((n) => (
            <div key={n.id} className={`border-b border-border/40 px-3 py-2 last:border-0 ${!n.read_at ? "bg-primary/5" : ""}`}>
              <div className="flex items-start gap-2">
                {!n.read_at ? <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" /> : <Check className="mt-1 h-3 w-3 flex-shrink-0 text-muted-foreground" />}
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
