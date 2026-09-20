import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { format } from "date-fns";

// Human-friendly reason from Meta error codes / queue errors
function humanReason(err?: string | null): { label: string; hint: string } {
  const e = (err || "").toLowerCase();
  if (!err) return { label: "Failed", hint: "Message could not be delivered." };
  if (e.includes("131026")) return { label: "Number not on WhatsApp", hint: "This phone number is not registered on WhatsApp." };
  if (e.includes("131049")) return { label: "Blocked by Meta (frequency)", hint: "Meta throttled this to protect user experience. No charge." };
  if (e.includes("131047")) return { label: "24-hour window closed", hint: "Customer hasn't messaged in 24h and template rules blocked it." };
  if (e.includes("130472")) return { label: "User in Meta experiment", hint: "Meta A/B experiment blocked delivery. No charge." };
  if (e.includes("131051")) return { label: "Unsupported message type", hint: "Template payload rejected." };
  if (e.includes("131053")) return { label: "Parcel photo failed", hint: "WhatsApp could not download the parcel photo, so this message was not delivered." };
  if (e.includes("invalid") && e.includes("phone")) return { label: "Invalid phone number", hint: "Number format is wrong." };
  if (e.includes("daily_cap")) return { label: "Daily limit reached", hint: "You already sent max messages to this number today." };
  if (e.includes("cooldown")) return { label: "Cooldown active", hint: "A recent message was sent to this number." };
  if (e.includes("store_disabled")) return { label: "Store WhatsApp disabled", hint: "Enable WhatsApp for this store." };
  if (e.includes("opted_out") || e.includes("optout")) return { label: "Customer opted out", hint: "Customer unsubscribed from WhatsApp messages." };
  return { label: "Failed", hint: err };
}

export function FailedMessagesPanel({ storeId }: { storeId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["wa-failed-messages", storeId],
    staleTime: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [msgs, queued] = await Promise.all([
        (supabase as any)
          .from("whatsapp_messages")
          .select("id, recipient_phone, template_name, message_type, status, error_message, created_at")
          .eq("store_id", storeId)
          .in("status", ["failed", "undelivered"])
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(50),
        (supabase as any)
          .from("wa_send_queue")
          .select("id, recipient_phone, template_name, status, last_error, created_at")
          .eq("store_id", storeId)
          .in("status", ["failed", "skipped"])
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      const rows: any[] = [];
      (msgs.data || []).forEach((m: any) =>
        rows.push({
          id: `m-${m.id}`,
          phone: m.recipient_phone,
          template: m.template_name || m.message_type,
          error: m.error_message,
          created_at: m.created_at,
          source: "sent",
        })
      );
      (queued.data || []).forEach((q: any) =>
        rows.push({
          id: `q-${q.id}`,
          phone: q.recipient_phone,
          template: q.template_name,
          error: q.last_error,
          created_at: q.created_at,
          source: q.status,
        })
      );
      rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return rows;
    },
    enabled: !!storeId,
  });

  if (isLoading) return null;
  if (!data || data.length === 0) return null;

  return (
    <Card className="border-orange-200 dark:border-orange-900/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          Messages that didn't go through ({data.length})
        </CardTitle>
        <CardDescription className="flex items-center gap-1.5 text-xs">
          <ShieldCheck className="h-3 w-3 text-emerald-600" />
          You are NOT charged for these — Meta only bills delivered messages.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 max-h-80 overflow-y-auto divide-y">
        {data.map((r) => {
          const { label, hint } = humanReason(r.error);
          return (
            <div key={r.id} className="p-3 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs">{r.phone}</span>
                <Badge variant="destructive" className="text-[10px]">{label}</Badge>
                <span className="text-[11px] text-muted-foreground ml-auto">
                  {format(new Date(r.created_at), "dd MMM, hh:mm a")}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>
              {r.template && (
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">Template: {r.template}</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
