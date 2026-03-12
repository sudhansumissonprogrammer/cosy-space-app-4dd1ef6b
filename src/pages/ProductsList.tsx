import { useState, useMemo, useRef, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Package, AlertCircle, Upload, Download,
  Search, SlidersHorizontal, ArrowUpDown, X, Check,
} from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import PaginationControls from "@/components/PaginationControls";
import BulkEditDialog from "@/components/BulkEditDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type SortOption = "title-asc" | "title-desc" | "date-new" | "date-old";
type StatusFilter = "all" | "active" | "draft";
type StockFilter = "all" | "in-stock" | "out-of-stock";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "title-asc", label: "Product title (A–Z)" },
  { value: "title-desc", label: "Product title (Z–A)" },
  { value: "date-new", label: "Created (newest first)" },
  { value: "date-old", label: "Created (oldest first)" },
];

export default function ProductsList() {
  const { storeId } = useParams<{ storeId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // Search, filter & sort state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [sort, setSort] = useState<SortOption>("date-new");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [categoryPopupOpen, setCategoryPopupOpen] = useState(false);
  const categoryBtnRef = useRef<HTMLButtonElement>(null);
  const categoryPopupRef = useRef<HTMLDivElement>(null);

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

  // Fetch all products for client-side filtering (up to 1000)
  const { data: allProducts, isLoading } = useQuery({
    queryKey: ["products-all", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products").select("*").eq("store_id", storeId!)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  // Extract unique categories
  const categories = useMemo(() => {
    if (!allProducts) return [];
    const cats = new Set<string>();
    allProducts.forEach(p => { if (p.category) cats.add(p.category); });
    return Array.from(cats).sort();
  }, [allProducts]);

  // Apply filters + search + sort
  const filteredProducts = useMemo(() => {
    if (!allProducts) return [];
    let result = [...allProducts];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter === "active") result = result.filter(p => p.is_active);
    if (statusFilter === "draft") result = result.filter(p => !p.is_active);

    // Stock filter
    if (stockFilter === "in-stock") result = result.filter(p => p.stock_quantity > 0);
    if (stockFilter === "out-of-stock") result = result.filter(p => p.stock_quantity <= 0);

    // Category filter
    if (categoryFilter.length > 0) result = result.filter(p => p.category && categoryFilter.includes(p.category));

    // Sort
    switch (sort) {
      case "title-asc":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "title-desc":
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "date-new":
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "date-old":
        result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
    }

    return result;
  }, [allProducts, search, statusFilter, stockFilter, categoryFilter, sort]);

  const pagination = usePagination(filteredProducts.length);
  const paginatedProducts = filteredProducts.slice(pagination.from, pagination.to + 1);

  const deleteMutation = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase.from("products").delete().eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-all", storeId] });
      toast.success("Product deleted");
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete product"),
  });

  const activeFilterCount =
    (stockFilter !== "all" ? 1 : 0) +
    (categoryFilter.length > 0 ? 1 : 0);

  const clearFilters = () => {
    setStockFilter("all");
    setCategoryFilter([]);
    setStatusFilter("all");
    setFilterOpen(false);
  };

  // Close category popup on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        categoryPopupRef.current &&
        !categoryPopupRef.current.contains(e.target as Node) &&
        categoryBtnRef.current &&
        !categoryBtnRef.current.contains(e.target as Node)
      ) {
        setCategoryPopupOpen(false);
      }
    };
    if (categoryPopupOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [categoryPopupOpen]);

  const toggleCategory = (cat: string) => {
    setCategoryFilter(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
    pagination.setPage(1);
  };

  if (!store && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">Store not found</p>
        <Button asChild variant="outline"><Link to="/dashboard/stores">Back to stores</Link></Button>
      </div>
    );
  }

  const exportCSV = () => {
    if (!allProducts || allProducts.length === 0) return;
    const headers = ["name","price","sale_price","description","category","stock_quantity","sku","slug","is_active","currency","image_url"];
    const escape = (v: string | null | undefined) => {
      if (v == null) return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = allProducts.map(p => headers.map(h => escape((p as any)[h])).join(","));
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

  const currencySymbol = store?.currency === "INR" ? "₹" : store?.currency === "USD" ? "$" : (store?.currency || "$");

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Products</h1>
        <div className="flex gap-1.5">
          {!isMobile && (
            <>
              <Button variant="outline" size="sm" onClick={exportCSV} disabled={!allProducts || allProducts.length === 0}>
                <Download className="mr-1.5 h-3.5 w-3.5" />Export
              </Button>
              {allProducts && allProducts.length > 0 && (
                <BulkEditDialog products={allProducts} storeId={storeId!} />
              )}
              <Button variant="outline" size="sm" asChild>
                <Link to={`/dashboard/stores/${storeId}/products/bulk-upload`}><Upload className="mr-1.5 h-3.5 w-3.5" />Import</Link>
              </Button>
            </>
          )}
          <Button size="sm" asChild disabled={limitInfo && !limitInfo.can_create}>
            <Link to={`/dashboard/stores/${storeId}/products/create`}><Plus className="mr-1 h-4 w-4" />{isMobile ? "" : "Add Product"}</Link>
          </Button>
        </div>
      </div>

      {/* Plan info */}
      {limitInfo && (
        <div className="flex items-center justify-between rounded-lg border bg-card p-2.5 text-xs">
          <span className="text-muted-foreground">
            <strong className="text-foreground">{limitInfo.plan_name}</strong> — {limitInfo.current_count}/{limitInfo.product_limit ?? "∞"} products
          </span>
          {!limitInfo.can_create && (
            <span className="flex items-center gap-1 text-destructive text-[11px]">
              <AlertCircle className="h-3 w-3" /> Limit reached
            </span>
          )}
        </div>
      )}

      {/* Search + Filter + Sort bar (Shopify style) */}
      <Card className="border shadow-none">
        <CardContent className="p-2.5 space-y-2.5">
          {/* Search row */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter products"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {/* Sort button */}
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => setSortOpen(true)}
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
            {/* Filter button */}
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 relative"
              onClick={() => setFilterOpen(true)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>

          {/* Status tabs (Shopify style) */}
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => { setStatusFilter(tab.value); pagination.setPage(1); }}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                  statusFilter === tab.value
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {stockFilter !== "all" && (
                <Badge variant="secondary" className="gap-1 text-xs pr-1">
                  {stockFilter === "in-stock" ? "In stock" : "Out of stock"}
                  <button onClick={() => setStockFilter("all")}><X className="h-3 w-3" /></button>
                </Badge>
              )}
              {categoryFilter !== "all" && (
                <Badge variant="secondary" className="gap-1 text-xs pr-1">
                  {categoryFilter}
                  <button onClick={() => setCategoryFilter("all")}><X className="h-3 w-3" /></button>
                </Badge>
              )}
              <button onClick={clearFilters} className="text-xs text-primary font-medium">
                Clear all
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : paginatedProducts.length > 0 ? (
        <>
          {isMobile ? (
            /* Mobile: Card-based list like Shopify */
            <div className="divide-y rounded-lg border bg-card">
              {paginatedProducts.map((product) => (
                <Link
                  key={product.id}
                  to={`/dashboard/stores/${storeId}/products/${product.id}/edit`}
                  className="flex items-center gap-3 px-3 py-3 active:bg-accent/50 transition-colors"
                >
                  {product.image_url ? (
                    <img src={product.image_url} alt="" className="h-12 w-12 rounded-lg border object-cover shrink-0" loading="lazy" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted shrink-0">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.stock_quantity > 0
                        ? `${product.stock_quantity} available`
                        : "Out of stock"}
                    </p>
                  </div>
                  <Badge
                    variant={product.is_active ? "default" : "secondary"}
                    className={cn(
                      "shrink-0 text-[11px]",
                      product.is_active && "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0"
                    )}
                  >
                    {product.is_active ? "Active" : "Draft"}
                  </Badge>
                </Link>
              ))}
            </div>
          ) : (
            /* Desktop: Table view */
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
                    {paginatedProducts.map((product) => (
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
                              <span className="text-sm text-muted-foreground line-through">{currencySymbol}{Number(product.price).toFixed(2)}</span><br />
                              <span className="font-medium text-foreground">{currencySymbol}{Number(product.sale_price).toFixed(2)}</span>
                            </div>
                          ) : (
                            <span className="font-medium text-foreground">{currencySymbol}{Number(product.price).toFixed(2)}</span>
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
                                  <AlertDialogDescription>This will permanently delete "{product.name}".</AlertDialogDescription>
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
          )}
          <PaginationControls page={pagination.page} totalPages={pagination.totalPages} onPageChange={pagination.setPage} />
          <p className="text-center text-xs text-muted-foreground">
            Showing {pagination.from + 1}–{Math.min(pagination.from + paginatedProducts.length, filteredProducts.length)} of {filteredProducts.length} products
          </p>
        </>
      ) : (
        <Card>
          <CardContent className="flex min-h-[200px] flex-col items-center justify-center gap-3">
            <Package className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              {search || statusFilter !== "all" || activeFilterCount > 0
                ? "No products match your filters"
                : "No products yet"}
            </p>
            {!search && statusFilter === "all" && activeFilterCount === 0 && (
              <Button asChild><Link to={`/dashboard/stores/${storeId}/products/create`}><Plus className="mr-2 h-4 w-4" />Add your first product</Link></Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sort Sheet */}
      <Sheet open={sortOpen} onOpenChange={setSortOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader>
            <SheetTitle className="text-left">Sort by</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-1">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { setSort(opt.value); setSortOpen(false); pagination.setPage(1); }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-3 text-sm transition-colors",
                  sort === opt.value
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-foreground hover:bg-accent/50"
                )}
              >
                {opt.label}
                {sort === opt.value && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Filter Sheet */}
      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8 max-h-[80vh] overflow-auto">
          <SheetHeader>
            <div className="flex items-center justify-between pr-8">
              <SheetTitle className="text-left">Filters</SheetTitle>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="text-xs text-primary font-medium">
                  Clear all
                </button>
              )}
            </div>
          </SheetHeader>
          <div className="mt-4 space-y-5">
            {/* Stock filter */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Stock status
              </p>
              <div className="space-y-1">
                {([
                  { value: "all" as StockFilter, label: "All" },
                  { value: "in-stock" as StockFilter, label: "In stock" },
                  { value: "out-of-stock" as StockFilter, label: "Out of stock" },
                ]).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setStockFilter(opt.value); pagination.setPage(1); }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors",
                      stockFilter === opt.value
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-foreground hover:bg-accent/50"
                    )}
                  >
                    {opt.label}
                    {stockFilter === opt.value && <Check className="h-4 w-4 text-primary" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Category filter */}
            {categories.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Category
                </p>
                <div className="space-y-1">
                  <button
                    onClick={() => { setCategoryFilter("all"); pagination.setPage(1); }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors",
                      categoryFilter === "all"
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-foreground hover:bg-accent/50"
                    )}
                  >
                    All categories
                    {categoryFilter === "all" && <Check className="h-4 w-4 text-primary" />}
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => { setCategoryFilter(cat); pagination.setPage(1); }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors",
                        categoryFilter === cat
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-foreground hover:bg-accent/50"
                      )}
                    >
                      {cat}
                      {categoryFilter === cat && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Button onClick={() => setFilterOpen(false)} className="w-full mt-6">
            Apply Filters
          </Button>
        </SheetContent>
      </Sheet>
    </div>
  );
}
