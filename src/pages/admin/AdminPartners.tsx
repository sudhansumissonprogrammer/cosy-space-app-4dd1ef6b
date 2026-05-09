import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Settings2, Search } from "lucide-react";

interface Partner {
  id: string;
  partner_code: string;
  name: string;
  email: string;
  mobile: string | null;
  commission_percentage: number;
  status: string;
  total_earnings: number;
  payouts_paused?: boolean;
  created_at: string;
}

const inr = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function AdminPartners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Partner | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: ps } = await supabase.from("partners").select("*").order("created_at", { ascending: false });
    setPartners((ps as Partner[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = partners.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return p.name?.toLowerCase().includes(s) || p.email?.toLowerCase().includes(s) || p.partner_code?.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Referral Partners</h1>
          <p className="text-sm text-muted-foreground">Manage partner accounts, commissions, and payouts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><a href="/admin/partners/payouts">Payouts</a></Button>
          <Button variant="outline" asChild><a href="/admin/partners/audit">Audit log</a></Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, or code…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} partners</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Partner</th>
                  <th className="px-3 py-2 text-left">Code</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Commission</th>
                  <th className="px-3 py-2 text-right">Earned</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.email}</div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{p.partner_code}</td>
                    <td className="px-3 py-2">
                      <Badge variant={p.status === "active" ? "default" : "secondary"} className="capitalize">{p.status}</Badge>
                      {p.payouts_paused && <Badge variant="destructive" className="ml-1">Payouts paused</Badge>}
                    </td>
                    <td className="px-3 py-2 text-right">{p.commission_percentage}%</td>
                    <td className="px-3 py-2 text-right">{inr(p.total_earnings)}</td>
                    <td className="px-3 py-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => setActive(p)}>
                        <Settings2 className="mr-1 h-3.5 w-3.5" /> Manage
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No partners</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <PartnerControlsDrawer partner={active} onClose={() => setActive(null)} onChanged={load} />
    </div>
  );
}

function PartnerControlsDrawer({ partner, onClose, onChanged }: { partner: Partner | null; onClose: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [walletForm, setWalletForm] = useState({ direction: "credit", bucket: "approved", amount: "", note: "" });
  const [pctValue, setPctValue] = useState("");

  useEffect(() => {
    if (!partner) return;
    setPctValue(String(partner.commission_percentage));
  }, [partner?.id]);

  if (!partner) return null;

  const call = async (action: string, args: Record<string, any> = {}) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-partner-controls", { body: { action, partner_id: partner.id, ...args } });
    setBusy(false);
    if (error || data?.error) { toast.error(error?.message || data?.error); return false; }
    toast.success("Done"); onChanged(); return true;
  };

  return (
    <Sheet open={!!partner} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{partner.name}</SheetTitle>
          <SheetDescription className="font-mono">{partner.partner_code} · {partner.email}</SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="status" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="commission">Commission</TabsTrigger>
            <TabsTrigger value="wallet">Wallet</TabsTrigger>
          </TabsList>

          <TabsContent value="status" className="space-y-4 pt-4">
            <Card className="p-4 space-y-2">
              <Label>Account status</Label>
              <div className="flex gap-2 flex-wrap">
                {["active", "suspended", "banned", "rejected"].map((s) => (
                  <Button key={s} size="sm" variant={partner.status === s ? "default" : "outline"} disabled={busy}
                    onClick={() => call("set_partner_status", { status: s })} className="capitalize">{s}</Button>
                ))}
              </div>
            </Card>
            <Card className="p-4 space-y-2">
              <Label>Payouts</Label>
              <p className="text-xs text-muted-foreground">{partner.payouts_paused ? "Currently paused — partner cannot request withdrawals." : "Active — partner can request withdrawals."}</p>
              <Button size="sm" variant={partner.payouts_paused ? "default" : "destructive"} disabled={busy}
                onClick={() => call(partner.payouts_paused ? "resume_payouts" : "pause_payouts")}>
                {partner.payouts_paused ? "Resume payouts" : "Pause payouts"}
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="commission" className="space-y-4 pt-4">
            <Card className="p-4 space-y-2">
              <Label>Commission %</Label>
              <div className="flex gap-2">
                <Input type="number" value={pctValue} onChange={(e) => setPctValue(e.target.value)} className="max-w-[120px]" />
                <Button disabled={busy} onClick={() => call("set_commission_percentage", { percentage: Number(pctValue) })}>Save</Button>
              </div>
              <p className="text-xs text-muted-foreground">Applied to every paid subscription payment from this partner's referrals.</p>
            </Card>
          </TabsContent>

          <TabsContent value="wallet" className="space-y-4 pt-4">
            <Card className="p-4 space-y-3">
              <Label>Manual wallet adjustment</Label>
              <div className="grid grid-cols-2 gap-2">
                <Select value={walletForm.direction} onValueChange={(v) => setWalletForm((s) => ({ ...s, direction: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Credit</SelectItem>
                    <SelectItem value="debit">Debit</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={walletForm.bucket} onValueChange={(v) => setWalletForm((s) => ({ ...s, bucket: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approved (withdrawable)</SelectItem>
                    <SelectItem value="pending">Pending (on hold)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input type="number" placeholder="Amount" value={walletForm.amount} onChange={(e) => setWalletForm((s) => ({ ...s, amount: e.target.value }))} />
              <Textarea placeholder="Reason / note (recommended)" value={walletForm.note} onChange={(e) => setWalletForm((s) => ({ ...s, note: e.target.value }))} rows={2} />
              <Button disabled={busy || !walletForm.amount} className="w-full" onClick={async () => {
                const ok = await call("wallet_adjustment", { direction: walletForm.direction, bucket: walletForm.bucket, amount: Number(walletForm.amount), note: walletForm.note });
                if (ok) setWalletForm({ direction: "credit", bucket: "approved", amount: "", note: "" });
              }}>Apply adjustment</Button>
            </Card>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
