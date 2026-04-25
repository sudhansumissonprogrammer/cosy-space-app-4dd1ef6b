import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Users, Trash2, Phone, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useMyStore } from "@/hooks/useMyStore";
import { getStoreBaseUrl } from "@/lib/storeUrl";

export default function CustomerLeads() {
  const { storeId } = useStoreSlugParam();
  const queryClient = useQueryClient();
  const { data: myStore } = useMyStore();

  const { data: leads, isLoading } = useQuery({
    queryKey: ["customer-leads", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("customer_leads")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as {
        id: string;
        name: string | null;
        phone: string;
        product_name: string | null;
        product_id: string | null;
        source: string;
        created_at: string;
      }[];
    },
    enabled: !!storeId,
  });

  // Fetch slugs for products referenced by leads — to build deep product links
  const productIds = Array.from(
    new Set((leads ?? []).map((l) => l.product_id).filter(Boolean) as string[])
  );

  const { data: productSlugMap } = useQuery({
    queryKey: ["lead-product-slugs", storeId, productIds.sort().join(",")],
    queryFn: async () => {
      if (productIds.length === 0) return {} as Record<string, string>;
      const { data, error } = await supabase
        .from("products")
        .select("id, slug")
        .in("id", productIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data ?? []).forEach((p: any) => {
        if (p.slug) map[p.id] = p.slug;
      });
      return map;
    },
    enabled: !!storeId && productIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const buildRecoveryMessage = (lead: {
    name: string | null;
    product_name: string | null;
    product_id: string | null;
    source: string;
  }) => {
    const storeName = myStore?.name || "our store";
    const storeBase = myStore?.slug
      ? getStoreBaseUrl(myStore.slug, myStore?.custom_domain)
      : "";
    const productSlug = lead.product_id ? productSlugMap?.[lead.product_id] : null;
    const productUrl =
      storeBase && productSlug ? `${storeBase}/product/${productSlug}` : "";

    const greeting = lead.name ? `Hi ${lead.name}! 👋` : "Hi there! 👋";
    const productLine = lead.product_name
      ? `I noticed you were checking out *${lead.product_name}* on ${storeName} but didn't complete your order.`
      : `I noticed you showed interest in our products at ${storeName} but didn't complete your order.`;

    const linkLine = productUrl
      ? `👉 Continue your order here:\n${productUrl}`
      : storeBase
        ? `👉 Visit our store: ${storeBase}`
        : "";

    return [
      greeting,
      "",
      productLine,
      "",
      "Is there anything I can help you with? 😊",
      "✅ Free assistance with your order",
      "✅ Quick delivery available",
      "✅ Easy payment options (UPI / COD)",
      "",
      linkLine,
      "",
      `Thank you,\nTeam ${storeName}`,
    ]
      .filter(Boolean)
      .join("\n");
  };

  const deleteMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await (supabase as any)
        .from("customer_leads")
        .delete()
        .eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-leads", storeId] });
      toast.success("Lead deleted");
    },
    onError: () => toast.error("Failed to delete lead"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Customer Leads</h1>
        <p className="text-sm text-muted-foreground">
          People who filled their details before ordering via WhatsApp
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">
            {leads?.length ?? 0} Lead{leads?.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : leads && leads.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">
                        {lead.name || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {lead.phone}
                        </div>
                      </TableCell>
                      <TableCell>
                        {lead.product_name || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          <MessageCircle className="mr-1 h-3 w-3" />
                          {lead.source === "whatsapp_order" ? "WhatsApp" : lead.source}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(lead.created_at), "MMM d, yyyy h:mm a")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Send recovery message on WhatsApp"
                            onClick={() => {
                              const phone = lead.phone.replace(/[^0-9+]/g, "");
                              const message = buildRecoveryMessage(lead);
                              window.open(
                                `https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(message)}`,
                                "_blank"
                              );
                            }}
                          >
                            <MessageCircle className="h-4 w-4 text-primary" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently remove this lead record.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(lead.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Users className="h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">No leads collected yet</p>
              <p className="text-xs text-muted-foreground">
                Leads appear when customers fill in their details before ordering via WhatsApp
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
