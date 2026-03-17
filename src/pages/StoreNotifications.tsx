import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Bell, Send, Link as LinkIcon, Trash2 } from "lucide-react";
import { format } from "date-fns";

export default function StoreNotifications() {
  const { storeId } = useParams<{ storeId: string }>();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["store-notifications", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_notifications")
        .select("*")
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      // 1. Insert into store_notifications (triggers realtime for online users)
      const { error } = await supabase.from("store_notifications").insert({
        store_id: storeId!,
        title: title.trim(),
        body: body.trim(),
        link_url: linkUrl.trim() || null,
      });
      if (error) throw error;

      // 2. Also send web-push for offline users
      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        await fetch(
          `https://${projectId}.supabase.co/functions/v1/web-push`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              action: "send",
              store_id: storeId,
              title: title.trim(),
              message: body.trim(),
              url: linkUrl.trim() || "/",
            }),
          }
        );
      } catch {
        // Web push is best-effort; don't fail the whole operation
      }
    },
    onSuccess: () => {
      toast.success("Notification sent to all store visitors!");
      setTitle("");
      setBody("");
      setLinkUrl("");
      queryClient.invalidateQueries({ queryKey: ["store-notifications", storeId] });
    },
    onError: () => toast.error("Failed to send notification"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("store_notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-notifications", storeId] });
    },
  });

  const canSend = title.trim().length > 0 && body.trim().length > 0;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Push Notifications
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Send notifications to customers who have your store's app installed
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Send New Notification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notif-title">Title</Label>
            <Input
              id="notif-title"
              placeholder="🎉 Flash Sale Today!"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notif-body">Message</Label>
            <Textarea
              id="notif-body"
              placeholder="Get 30% off on all products. Use code FLASH30 at checkout!"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={300}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notif-link" className="flex items-center gap-1.5">
              <LinkIcon className="h-3.5 w-3.5" />
              Link URL (optional)
            </Label>
            <Input
              id="notif-link"
              placeholder="/best-sellers or https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              When customer taps the notification, they'll be taken to this page
            </p>
          </div>
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={!canSend || sendMutation.isPending}
            className="w-full gap-2"
          >
            <Send className="h-4 w-4" />
            {sendMutation.isPending ? "Sending..." : "Send Notification"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sent Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : !notifications?.length ? (
            <p className="text-sm text-muted-foreground">No notifications sent yet</p>
          ) : (
            <div className="space-y-3">
              {notifications.map((n: any) => (
                <div
                  key={n.id}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <Bell className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                    {n.link_url && (
                      <p className="text-xs text-primary mt-1 truncate">{n.link_url}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {format(new Date(n.created_at), "dd MMM yyyy, hh:mm a")}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => deleteMutation.mutate(n.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
