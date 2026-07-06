import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, Megaphone, ShieldCheck, Wrench } from "lucide-react";

type Range = 1 | 7 | 30;

const CAT_META: Record<string, { label: string; icon: any; color: string }> = {
  marketing: { label: "Marketing", icon: Megaphone, color: "bg-rose-100 text-rose-700" },
  utility: { label: "Utility", icon: ShieldCheck, color: "bg-sky-100 text-sky-700" },
  authentication: { label: "Authentication", icon: ShieldCheck, color: "bg-violet-100 text-violet-700" },
  service: { label: "Service (reply)", icon: Wrench, color: "bg-emerald-100 text-emerald-700" },
};

function maskPhone(p: string) {
  if (!p) return "";
  const s = p.replace(/\D/g, "");
  if (s.length < 6) return s;
  return `${s.slice(0, 2)}…${s.slice(-4)}`;
}

export default function WhatsAppUsageCard({ storeId }: { storeId: string }) {
  const [range, setRange] = useState<Range>(7);

  const since = useMemo(() => new Date(Date.now() - range * 86400_000).toISOString(), [range]);

  const { data: summary } = useQuery({
    queryKey: ["wa-billing-summary", storeId, range],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("wa_billing_summary" as any, {
        _store_id: storeId,
        _since: since,
      });
      if (error) throw error;
      return (data ?? []) as Array<{ category: string; conversations: number; messages: number; charged: number }>;
    },
  });

  const { data: conversations } = useQuery({
    queryKey: ["wa-billing-conversations", storeId, range],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_billing_conversations" as any)
        .select("id, recipient_phone, category, window_start, message_count, price_charged")
        .eq("store_id", storeId)
        .gte("created_at", since)
        .order("window_start", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const totals = useMemo(() => {
    const s = summary ?? [];
    const charged = s.reduce((a, r) => a + Number(r.charged || 0), 0);
    const convs = s.reduce((a, r) => a + Number(r.conversations || 0), 0);
    const msgs = s.reduce((a, r) => a + Number(r.messages || 0), 0);
    return { charged, convs, msgs };
  }, [summary]);

  const byCat = useMemo(() => {
    const m: Record<string, { conversations: number; messages: number; charged: number }> = {};
    for (const r of summary ?? []) m[r.category] = { conversations: Number(r.conversations), messages: Number(r.messages), charged: Number(r.charged) };
    return m;
  }, [summary]);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <MessageCircle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold">WhatsApp usage</p>
              <p className="text-[10px] text-muted-foreground">
                Billed per 24-hour conversation per recipient
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            {([1, 7, 30] as Range[]).map((r) => (
              <Button
                key={r}
                size="sm"
                variant={range === r ? "default" : "outline"}
                className="h-7 px-2 text-[11px]"
                onClick={() => setRange(r)}
              >
                {r === 1 ? "24h" : `${r}d`}
              </Button>
            ))}
          </div>
        </div>

        {/* Totals strip */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border p-2">
            <p className="text-[10px] text-muted-foreground">Total charged</p>
            <p className="text-lg font-bold tabular-nums">₹{totals.charged.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border p-2">
            <p className="text-[10px] text-muted-foreground">Conversations</p>
            <p className="text-lg font-bold tabular-nums">{totals.convs}</p>
          </div>
          <div className="rounded-lg border p-2">
            <p className="text-[10px] text-muted-foreground">Messages delivered</p>
            <p className="text-lg font-bold tabular-nums">{totals.msgs}</p>
          </div>
        </div>

        {/* Per category breakdown */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {(["marketing", "utility", "authentication", "service"] as const).map((cat) => {
            const meta = CAT_META[cat];
            const Icon = meta.icon;
            const row = byCat[cat] ?? { conversations: 0, messages: 0, charged: 0 };
            return (
              <div key={cat} className="rounded-lg border p-2">
                <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.color}`}>
                  <Icon className="h-3 w-3" />
                  {meta.label}
                </div>
                <p className="mt-1 text-sm font-bold tabular-nums">₹{row.charged.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {row.conversations} conv · {row.messages} msg
                </p>
              </div>
            );
          })}
        </div>

      </CardContent>
    </Card>
  );
}
