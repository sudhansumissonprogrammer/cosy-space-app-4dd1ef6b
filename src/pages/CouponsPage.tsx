import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Tag } from "lucide-react";
import { format } from "date-fns";

export default function CouponsPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // Form state
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [minOrderAmount, setMinOrderAmount] = useState("0");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const { data: store } = useQuery({
    queryKey: ["store", storeId],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("*").eq("id", storeId!).eq("owner_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId && !!user,
  });

  const { data: coupons, isLoading } = useQuery({
    queryKey: ["coupons", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("coupons")
        .select("*")
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!storeId,
  });

  const createCoupon = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("coupons").insert({
        store_id: storeId!,
        code: code.trim().toUpperCase(),
        discount_type: discountType,
        discount_value: parseFloat(discountValue),
        min_order_amount: parseFloat(minOrderAmount) || 0,
        max_uses: maxUses ? parseInt(maxUses) : null,
        expires_at: expiresAt || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons", storeId] });
      toast.success("Coupon created!");
      setOpen(false);
      resetForm();
    },
    onError: (err: any) => toast.error(err.message?.includes("unique") ? "This coupon code already exists" : err.message),
  });

  const deleteCoupon = useMutation({
    mutationFn: async (couponId: string) => {
      const { error } = await (supabase as any).from("coupons").delete().eq("id", couponId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons", storeId] });
      toast.success("Coupon deleted");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await (supabase as any).from("coupons").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons", storeId] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const resetForm = () => {
    setCode(""); setDiscountType("percentage"); setDiscountValue(""); setMinOrderAmount("0"); setMaxUses(""); setExpiresAt("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild><Link to="/dashboard/stores"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Coupons</h1>
            <p className="text-sm text-muted-foreground">{store?.name}</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> New Coupon</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Coupon</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createCoupon.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input placeholder="SAVE10" value={code} onChange={(e) => setCode(e.target.value)} maxLength={30} required />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Discount Type</Label>
                  <Select value={discountType} onValueChange={setDiscountType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Discount Value *</Label>
                  <Input type="number" step="0.01" min="0" placeholder="10" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} required />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Min Order Amount</Label>
                  <Input type="number" step="0.01" min="0" value={minOrderAmount} onChange={(e) => setMinOrderAmount(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Max Uses</Label>
                  <Input type="number" min="1" placeholder="Unlimited" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Expires At</Label>
                <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={createCoupon.isPending}>
                {createCoupon.isPending ? "Creating..." : "Create Coupon"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : coupons && coupons.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Min Order</TableHead>
                  <TableHead className="text-center">Used / Max</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-semibold text-foreground">{c.code}</TableCell>
                    <TableCell>
                      {c.discount_type === "percentage"
                        ? `${Number(c.discount_value)}%`
                        : `$${Number(c.discount_value).toFixed(2)}`}
                    </TableCell>
                    <TableCell>${Number(c.min_order_amount).toFixed(2)}</TableCell>
                    <TableCell className="text-center">{c.used_count} / {c.max_uses ?? "∞"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.expires_at ? format(new Date(c.expires_at), "MMM d, yyyy") : "Never"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={c.is_active ? "secondary" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleActive.mutate({ id: c.id, active: !c.is_active })}
                      >
                        {c.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteCoupon.mutate(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex min-h-[200px] flex-col items-center justify-center gap-3">
            <Tag className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No coupons yet</p>
            <p className="text-sm text-muted-foreground">Create discount codes for your customers</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
