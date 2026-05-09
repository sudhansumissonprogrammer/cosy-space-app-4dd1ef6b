import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Partner {
  id: string;
  partner_code: string;
  name: string;
  email: string;
  mobile: string | null;
  commission_percentage: number;
  status: string;
  total_earnings: number;
  created_at: string;
}

export default function AdminPartners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPct, setEditingPct] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const [{ data: ps }, { data: cs }] = await Promise.all([
      supabase.from("partners").select("*").order("created_at", { ascending: false }),
      supabase.from("partner_commissions").select("id,partner_id,amount_paid,commission_amount,percentage,status,created_at").order("created_at", { ascending: false }).limit(50),
    ]);
    setPartners((ps as Partner[]) || []);
    setCommissions(cs || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updatePct = async (id: string) => {
    const v = Number(editingPct[id]);
    if (!Number.isFinite(v) || v < 0 || v > 100) { toast.error("Enter 0-100"); return; }
    const { error } = await supabase.from("partners").update({ commission_percentage: v }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Updated"); load(); }
  };

  const toggleStatus = async (p: Partner) => {
    const next = p.status === "active" ? "suspended" : "active";
    const { error } = await supabase.from("partners").update({ status: next }).eq("id", p.id);
    if (error) toast.error(error.message); else { toast.success(`Partner ${next}`); load(); }
  };

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Referral Partners</h1>
        <p className="text-sm text-muted-foreground">Manage partner accounts and view commissions</p>
      </div>

      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold">Partners ({partners.length})</h3>
        <div className="space-y-2">
          {partners.length === 0 ? (
            <p className="text-sm text-muted-foreground">No partners yet.</p>
          ) : partners.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{p.name} <span className="font-mono text-xs text-muted-foreground">({p.partner_code})</span></p>
                <p className="truncate text-xs text-muted-foreground">{p.email} · ₹{Number(p.total_earnings).toLocaleString("en-IN")} earned</p>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  className="h-8 w-20 text-sm"
                  defaultValue={p.commission_percentage}
                  onChange={(e) => setEditingPct((s) => ({ ...s, [p.id]: e.target.value }))}
                />
                <span className="text-xs text-muted-foreground">%</span>
                <Button size="sm" variant="outline" onClick={() => updatePct(p.id)}>Save</Button>
              </div>
              <Button
                size="sm"
                variant={p.status === "active" ? "outline" : "destructive"}
                onClick={() => toggleStatus(p)}
              >
                {p.status === "active" ? "Suspend" : "Reactivate"}
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold">Recent commissions</h3>
        <div className="space-y-2">
          {commissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No commissions yet.</p>
          ) : commissions.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-sm">
              <div>
                <p className="font-semibold">₹{Number(c.commission_amount).toLocaleString("en-IN")}</p>
                <p className="text-xs text-muted-foreground">{c.percentage}% of ₹{Number(c.amount_paid).toLocaleString("en-IN")} · {new Date(c.created_at).toLocaleDateString()}</p>
              </div>
              <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium capitalize">{c.status}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
