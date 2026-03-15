import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { sendAbandonedCartWhatsApp } from "@/lib/whatsappAutomation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ShoppingCart, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function StoreAbandonedCarts() {
  const { storeId } = useParams<{ storeId: string }>();
  const { user } = useAuth();

  const { data: carts, isLoading } = useQuery({
    queryKey: ["abandoned-carts", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("abandoned_carts")
        .select("*")
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!storeId && !!user,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Abandoned Carts</h1>
        <p className="text-sm text-muted-foreground">Carts that were started at checkout but not completed</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !carts?.length ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <ShoppingCart className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">No abandoned carts yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {carts.map((c: any) => {
                  const items = Array.isArray(c.cart_items) ? c.cart_items : [];
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm">{format(new Date(c.created_at), "dd MMM yyyy, hh:mm a")}</TableCell>
                      <TableCell>
                        <div className="text-sm">{c.customer_phone || c.customer_email || "—"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{items.length} item{items.length !== 1 ? "s" : ""}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {items.map((i: any) => i.name || i.product_name).join(", ")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.recovered ? "default" : "secondary"}>
                          {c.recovered ? "Recovered" : "Abandoned"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
