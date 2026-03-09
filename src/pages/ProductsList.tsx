import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Plus, ArrowLeft, Pencil, Trash2, Package, AlertCircle, Upload, Download } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import PaginationControls from "@/components/PaginationControls";

export default function ProductsList() {
  const { storeId } = useParams<{ storeId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: store } = useQuery({
    queryKey: ["store", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores").select("*").eq("id", storeId!).eq("owner_id", user!.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId && !!user,
  });

  const { data: limitInfo } = useQuery({
    queryKey: ["product-limit", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("check_product_limit", { _user_id: user!.id });
      if (error) throw error;
      return data as { plan_name: string; product_limit: number | null; current_count: number; can_create: boolean };
    },
    enabled: !!user,
  });

  const { data: countData } = useQuery({
    queryKey: ["products-count", storeId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("products").select("*", { count: "exact", head: true }).eq("store_id", storeId!);
      if (error) throw error;
      return count;
    },
    enabled: !!storeId,
  });

  const pagination = usePagination(countData ?? undefined);

  const { data: products, isLoading } = useQuery({
    queryKey: ["products", storeId, pagination.page],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products").select("*").eq("store_id", storeId!)
        .order("created_at", { ascending: false })
        .range(pagination.from, pagination.to);
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase.from("products").delete().eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", storeId] });
      queryClient.invalidateQueries({ queryKey: ["products-count", storeId] });
      toast.success("Product deleted");
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete product"),
  });

  if (!store && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">Store not found</p>
        <Button asChild variant="outline"><Link to="/dashboard/stores">Back to stores</Link></Button>
      </div>
    );
  }

  const exportCSV = () => {
    if (!products || products.length === 0) return;
    const headers = ["name","price","sale_price","description","category","stock_quantity","sku","slug","is_active","currency","image_url"];
    const escape = (v: string | null | undefined) => {
      if (v == null) return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = products.map(p => headers.map(h => escape((p as any)[h])).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${store?.slug || "products"}-export.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Products exported");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild><Link to="/dashboard/stores"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Products</h1>
            <p className="text-sm text-muted-foreground">{store?.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} disabled={!products || products.length === 0}>
            <Download className="mr-2 h-4 w-4" />Export CSV
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/dashboard/stores/${storeId}/products/bulk-upload`}><Upload className="mr-2 h-4 w-4" />Import CSV</Link>
          </Button>
          <Button asChild disabled={limitInfo && !limitInfo.can_create}>
            <Link to={`/dashboard/stores/${storeId}/products/create`}><Plus className="mr-2 h-4 w-4" />Add Product</Link>
          </Button>
        </div>
      </div>

      {limitInfo && (
        <div className="flex items-center justify-between rounded-lg border bg-card p-3 text-sm">
          <span className="text-muted-foreground">
            <strong className="text-foreground">{limitInfo.plan_name}</strong> plan — {limitInfo.current_count}/{limitInfo.product_limit ?? "∞"} products used
          </span>
          {!limitInfo.can_create && (
            <Alert variant="destructive" className="mt-0 w-auto border-0 bg-transparent p-0">
              <AlertDescription className="flex items-center gap-1 text-xs">
                <AlertCircle className="h-3 w-3" /> Limit reached. Upgrade your plan.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : products && products.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        {product.image_url ? (
                          <img src={product.image_url} alt="" className="h-10 w-10 rounded-md border object-cover" loading="lazy" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent"><Package className="h-4 w-4 text-muted-foreground" /></div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{product.name}</p>
                          {product.slug && <p className="text-xs text-muted-foreground">{product.slug}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {product.category ? <Badge variant="secondary">{product.category}</Badge> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {product.sale_price ? (
                          <div>
                            <span className="text-sm text-muted-foreground line-through">${Number(product.price).toFixed(2)}</span><br />
                            <span className="font-medium text-foreground">${Number(product.sale_price).toFixed(2)}</span>
                          </div>
                        ) : (
                          <span className="font-medium text-foreground">${Number(product.price).toFixed(2)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{product.stock_quantity}</TableCell>
                      <TableCell>
                        <Badge variant={product.is_active ? "default" : "secondary"}>{product.is_active ? "Active" : "Draft"}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" asChild>
                            <Link to={`/dashboard/stores/${storeId}/products/${product.id}/edit`}><Pencil className="h-4 w-4" /></Link>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete product?</AlertDialogTitle>
                                <AlertDialogDescription>This will permanently delete "{product.name}". This action cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(product.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <PaginationControls page={pagination.page} totalPages={pagination.totalPages} onPageChange={pagination.setPage} />
        </>
      ) : (
        <Card>
          <CardContent className="flex min-h-[200px] flex-col items-center justify-center gap-3">
            <Package className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No products yet</p>
            <Button asChild><Link to={`/dashboard/stores/${storeId}/products/create`}><Plus className="mr-2 h-4 w-4" />Add your first product</Link></Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
