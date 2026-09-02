import { useState } from "react";
import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";
import { useStorePurge } from "@/hooks/useStorePurge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, Tag, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function StoreCoupons() {
  const { storeId } = useStoreSlugParam();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const purgeStore = useStorePurge(storeId);
  const [open, setOpen] = useState(false);

  // Form state
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "flat">("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [minOrderAmount, setMinOrderAmount] = useState("0");
  const [maxUses, setMaxUses] = useState("");
  const [startsAt, setStartsAt] = useState(new Date().toISOString().slice(0, 16));
  const [expiresAt, setExpiresAt] = useState("");
  const [autoApply, setAutoApply] = useState(false);

  const { data: coupons, isLoading } = useQuery({
    queryKey: ["coupons", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!storeId && !!user,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      // Validate before hitting the DB so owners can't save nonsensical coupons
      // (e.g. 9999% discount, negative min order, expiry before start).
      const trimmedCode = code.trim().toUpperCase();
      if (!/^[A-Z0-9_-]{2,20}$/.test(trimmedCode)) {
        throw new Error("Code must be 2-20 letters, numbers, _ or -");
      }
      const value = Number(discountValue);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("Discount value must be greater than 0");
      }
      if (discountType === "percentage" && value > 100) {
        throw new Error("Percentage discount cannot exceed 100%");
      }
      if (discountType === "flat" && value > 1_000_000) {
        throw new Error("Flat discount looks too large");
      }
      const minOrder = Number(minOrderAmount) || 0;
      if (minOrder < 0) throw new Error("Minimum order cannot be negative");
      const maxUsesNum = maxUses ? Number(maxUses) : null;
      if (maxUsesNum !== null && (!Number.isInteger(maxUsesNum) || maxUsesNum < 1)) {
        throw new Error("Max uses must be a positive whole number");
      }
      const startsAtDate = new Date(startsAt);
      const expiresAtDate = expiresAt ? new Date(expiresAt) : null;
      if (expiresAtDate && expiresAtDate <= startsAtDate) {
        throw new Error("Expiry must be after the start date");
      }

      const { error } = await supabase.from("coupons").insert({
        store_id: storeId!,
        code: trimmedCode,
        discount_type: discountType,
        discount_value: value,
        min_order_amount: minOrder,
        max_uses: maxUsesNum,
        starts_at: startsAtDate.toISOString(),
        expires_at: expiresAtDate ? expiresAtDate.toISOString() : null,
        auto_apply: autoApply,
      } as any);
      if (error) {
        const msg = String((error as any).message || "");
        if ((error as any).code === "23505") {
          if (msg.includes("coupons_one_auto_apply_per_store")) {
            throw new Error("Only one auto-apply coupon allowed per store. Disable the existing one first.");
          }
          throw new Error("A coupon with this code already exists");
        }
        throw new Error("Could not create coupon. Please try again.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons", storeId] });
      toast.success("Coupon created");
      resetForm();
      setOpen(false);
      purgeStore();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("coupons").update({ is_active }).eq("id", id).eq("store_id", storeId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons", storeId] });
      purgeStore();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const autoApplyMutation = useMutation({
    mutationFn: async ({ id, auto_apply }: { id: string; auto_apply: boolean }) => {
      const { error } = await (supabase as any).from("coupons").update({ auto_apply }).eq("id", id).eq("store_id", storeId!);
      if (error) {
        if ((error as any).code === "23505") {
          throw new Error("Only one auto-apply coupon allowed per store. Disable the existing one first.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons", storeId] });
      toast.success("Updated");
      purgeStore();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // WhatsApp-only coupons auto-apply ONLY for shoppers arriving from a
  // WhatsApp marketing/recovery message. Everyone else gets the normal
  // auto-apply coupon (also shown on the product page).
  const waExclusiveMutation = useMutation({
    mutationFn: async ({ id, wa_exclusive }: { id: string; wa_exclusive: boolean }) => {
      const { error } = await (supabase as any).from("coupons").update({ wa_exclusive }).eq("id", id).eq("store_id", storeId!);
      if (error) {
        if ((error as any).code === "23505") {
          throw new Error("Only one auto-apply coupon of each kind is allowed. Disable the existing one first.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons", storeId] });
      toast.success("Updated");
      purgeStore();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coupons").delete().eq("id", id).eq("store_id", storeId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons", storeId] });
      toast.success("Coupon deleted");
      purgeStore();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setCode("");
    setDiscountType("percentage");
    setDiscountValue("");
    setMinOrderAmount("0");
    setMaxUses("");
    setStartsAt(new Date().toISOString().slice(0, 16));
    setExpiresAt("");
    setAutoApply(false);
  };

  const getCouponStatus = (c: any) => {
    if (!c.is_active) return { label: "Inactive", variant: "secondary" as const };
    const now = new Date();
    if (c.expires_at && new Date(c.expires_at) < now) return { label: "Expired", variant: "destructive" as const };
    if (c.max_uses && c.used_count >= c.max_uses) return { label: "Maxed Out", variant: "destructive" as const };
    if (new Date(c.starts_at) > now) return { label: "Scheduled", variant: "outline" as const };
    return { label: "Active", variant: "default" as const };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Coupons</h1>
          <p className="text-sm text-muted-foreground">Create and manage discount coupons</p>
        </div>
        <Button onClick={() => { resetForm(); setOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Create Coupon
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !coupons?.length ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Tag className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">No coupons yet. Create your first coupon.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Min Order</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Auto-apply</TableHead>
                  <TableHead>WhatsApp only</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((c: any) => {
                  const status = getCouponStatus(c);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono font-semibold">
                        {c.code}
                        {c.auto_apply && <Badge variant="outline" className="ml-2 text-[10px]">AUTO</Badge>}
                        {c.wa_exclusive && <Badge variant="outline" className="ml-1 text-[10px]">WA</Badge>}
                      </TableCell>
                      <TableCell>
                        {c.discount_type === "percentage" ? `${c.discount_value}%` : `₹${c.discount_value}`}
                      </TableCell>
                      <TableCell>₹{c.min_order_amount}</TableCell>
                      <TableCell>{c.used_count}{c.max_uses ? `/${c.max_uses}` : ""}</TableCell>
                      <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                      <TableCell>
                        <Switch
                          checked={c.is_active}
                          onCheckedChange={(val) => toggleMutation.mutate({ id: c.id, is_active: val })}
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={!!c.auto_apply}
                          onCheckedChange={(val) => autoApplyMutation.mutate({ id: c.id, auto_apply: val })}
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={!!c.wa_exclusive}
                          onCheckedChange={(val) => waExclusiveMutation.mutate({ id: c.id, wa_exclusive: val })}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete coupon ${c.code}`}
                          onClick={() => {
                            if (window.confirm(`Delete coupon ${c.code}? This cannot be undone.`)) deleteMutation.mutate(c.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}

              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Coupon Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Coupon</DialogTitle>
            <DialogDescription>Set up a discount coupon for your store.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!code.trim() || !discountValue) return toast.error("Fill required fields");
              createMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label>Coupon Code *</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="SAVE20" className="uppercase" maxLength={20} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Discount Type</Label>
                <Select value={discountType} onValueChange={(v) => setDiscountType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="flat">Flat (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Value *</Label>
                <Input type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder={discountType === "percentage" ? "20" : "100"} min="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Min Order (₹)</Label>
                <Input type="number" value={minOrderAmount} onChange={(e) => setMinOrderAmount(e.target.value)} min="0" />
              </div>
              <div className="space-y-2">
                <Label>Max Uses</Label>
                <Input type="number" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="Unlimited" min="1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Starts At</Label>
                <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Expires At</Label>
                <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-md border p-3">
              <Switch checked={autoApply} onCheckedChange={setAutoApply} className="mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-semibold">Auto-apply at checkout</div>
                <div className="text-xs text-muted-foreground">Shows as already applied for every shopper. They can still remove it. Only one auto-apply coupon per store.</div>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Coupon
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
