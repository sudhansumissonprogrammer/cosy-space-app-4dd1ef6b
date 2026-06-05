import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useStoreData } from "@/hooks/useStoreData";
import { useStorePurge } from "@/hooks/useStorePurge";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog, DialogContent,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Package, AlertCircle, Upload, Download,
  Search, SlidersHorizontal, ArrowUpDown, X, Check, Star, Pin,
} from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import PaginationControls from "@/components/PaginationControls";
import BulkEditDialog from "@/components/BulkEditDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import ProductForm from "@/components/ProductForm";
import QuickEditProductModal from "@/components/dashboard/QuickEditProductModal";
import FAB from "@/components/dashboard/FAB";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import PullToRefreshIndicator from "@/components/dashboard/PullToRefreshIndicator";
import { cleanImageUrl } from "@/lib/imageOptimize";
import { useDashboardStore } from "@/contexts/DashboardStoreContext";
import { useRealtimeStore } from "@/hooks/useRealtimeStore";

type SortOption = "title-asc" | "title-desc" | "date-new" | "date-old";
type StatusFilter = "all" | "active" | "draft";
type StockFilter = "all" | "in-stock" | "out-of-stock";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "title-asc", label: "Product title (A–Z)" },
  { value: "title-desc", label: "Product title (Z–A)" },
  { value: "date-new", label: "Created (newest first)" },
  { value: "date-old", label: "Created (oldest first)" },
];

export default function ProductsList() { // v2
  const slugStore = useStoreSlugParam();
  const dashboardStore = useDashboardStore();
  const storeId = slugStore.storeId ?? dashboardStore.storeId;
  const storeSlug = slugStore.storeSlug ?? dashboardStore.storeSlug;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  useRealtimeStore(storeId, "products");

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

  // Bulk edit inline state
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkActionOpen, setBulkActionOpen] = useState(false);
  const [bulkPriceChange, setBulkPriceChange] = useState("");
  const [bulkStockChange, setBulkStockChange] = useState("");
  const [bulkPriceMode, setBulkPriceMode] = useState<"set" | "adjust">("set");
  const [bulkStockMode, setBulkStockMode] = useState<"set" | "adjust">("set");

  // Image preview state
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Mobile product sheet state
  const [mobileProductId, setMobileProductId] = useState<string | null | undefined>(undefined); // undefined = closed, null = create, string = edit
  const [quickEditProduct, setQuickEditProduct] = useState<any | null>(null); // tap price/stock pill → quick edit

  // Long-press state
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  const handleTouchStart = useCallback((productId: string) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      if (!bulkMode) setBulkMode(true);
      setBulkSelected(prev => new Set(prev).add(productId));
      // Haptic feedback if available
      if (navigator.vibrate) navigator.vibrate(50);
    }, 600);
  }, [bulkMode]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const { data: fetchedStore, isLoading: fetchedStoreLoading } = useStoreData(storeId);
  const store = fetchedStore ?? dashboardStore.store ?? slugStore.store;
  const storeLoading = dashboardStore.isLoading || fetchedStoreLoading;
  const purgeStore = useStorePurge(storeId);

  const { data: limitInfo } = useQuery({
    queryKey: ["product-limit", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("check_product_limit", { _user_id: user!.id });
      if (error) throw error;
      return data as { plan_name: string; product_limit: number | null; current_count: number; can_create: boolean };
    },
    enabled: !!user,
  });

  const { data: allProducts, isLoading } = useQuery({
    queryKey: ["products-all", storeId],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, slug, image_url, price, sale_price, stock_quantity, is_active, is_best_selling, is_category_pinned, category_pinned_at, category, sku, currency, created_at")
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  const categories = useMemo(() => {
    if (!allProducts) return [];
    const cats = new Set<string>();
    allProducts.forEach(p => { if (p.category) cats.add(p.category); });
    return Array.from(cats).sort();
  }, [allProducts]);

  const filteredProducts = useMemo(() => {
    if (!allProducts) return [];
    let result = [...allProducts];
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q)
      );
    }
    if (statusFilter === "active") result = result.filter(p => p.is_active);
    if (statusFilter === "draft") result = result.filter(p => !p.is_active);
    if (stockFilter === "in-stock") result = result.filter(p => p.stock_quantity > 0);
    if (stockFilter === "out-of-stock") result = result.filter(p => p.stock_quantity <= 0 && p.stock_quantity < 999999);
    if (categoryFilter.length > 0) result = result.filter(p => p.category && categoryFilter.includes(p.category));
    switch (sort) {
      case "title-asc": result.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "title-desc": result.sort((a, b) => b.name.localeCompare(a.name)); break;
      case "date-new": result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
      case "date-old": result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); break;
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
      purgeStore();
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete product"),
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(bulkSelected);
      if (ids.length === 0) throw new Error("No products selected");
      for (const id of ids) {
        const product = allProducts?.find((p) => p.id === id);
        if (!product) continue;
        const updates: Record<string, number> = {};
        if (bulkPriceChange !== "") {
          const val = parseFloat(bulkPriceChange);
          if (isNaN(val)) throw new Error("Invalid price value");
          updates.price = bulkPriceMode === "set" ? val : Math.max(0, product.price + val);
        }
        if (bulkStockChange !== "") {
          const val = parseInt(bulkStockChange);
          if (isNaN(val)) throw new Error("Invalid stock value");
          updates.stock_quantity = bulkStockMode === "set" ? val : Math.max(0, product.stock_quantity + val);
        }
        if (Object.keys(updates).length > 0) {
          const { error } = await supabase.from("products").update(updates).eq("id", id);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-all", storeId] });
      toast.success(`${bulkSelected.size} products updated`);
      exitBulkMode();
      purgeStore();
    },
    onError: (err: any) => toast.error(err.message || "Bulk update failed"),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(bulkSelected);
      if (ids.length === 0) throw new Error("No products selected");
      // Batch delete related data first, then products — 3 queries total
      const { error: imgErr } = await supabase.from("product_images").delete().in("product_id", ids);
      if (imgErr) throw imgErr;
      const { error: varErr } = await supabase.from("product_variants").delete().in("product_id", ids);
      if (varErr) throw varErr;
      const { error } = await supabase.from("products").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-all", storeId] });
      queryClient.invalidateQueries({ queryKey: ["product-limit"] });
      toast.success(`${bulkSelected.size} products deleted`);
      exitBulkMode();
      purgeStore();
    },
    onError: (err: any) => toast.error(err.message || "Bulk delete failed"),
  });

  const bulkBestSellerMutation = useMutation({
    mutationFn: async (value: boolean) => {
      const ids = Array.from(bulkSelected);
      if (ids.length === 0) throw new Error("No products selected");
      const { error } = await supabase.from("products").update({ is_best_selling: value }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, value) => {
      queryClient.invalidateQueries({ queryKey: ["products-all", storeId] });
      toast.success(`${bulkSelected.size} products ${value ? "marked as" : "removed from"} best sellers`);
      exitBulkMode();
      purgeStore();
    },
    onError: (err: any) => toast.error(err.message || "Failed to update best seller status"),
  });

  // Single-row "Pin to top of category" toggle. Pinned products surface at the
  // top of their category page on the storefront (independent of Best Selling,
  // which only affects the homepage rail).
  const pinMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase
        .from("products")
        .update({
          is_category_pinned: value,
          category_pinned_at: value ? new Date().toISOString() : null,
        } as any)
        .eq("id", id);
      if (error) throw error;
      return { id, value };
    },
    onSuccess: ({ value }) => {
      queryClient.invalidateQueries({ queryKey: ["products-all", storeId] });
      toast.success(value ? "Pinned to top of category" : "Unpinned from category");
      purgeStore();
    },
    onError: (err: any) => toast.error(err.message || "Failed to update pin"),
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

  const toggleBulkSelect = (id: string) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (bulkSelected.size === paginatedProducts.length) {
      setBulkSelected(new Set());
    } else {
      setBulkSelected(new Set(paginatedProducts.map(p => p.id)));
    }
  };

  const exitBulkMode = () => {
    setBulkMode(false);
    setBulkSelected(new Set());
    setBulkActionOpen(false);
    setBulkPriceChange("");
    setBulkStockChange("");
  };

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

  // Pull-to-refresh — re-fetch products on mobile pull-down
  const { pull, refreshing } = usePullToRefresh({
    onRefresh: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products", storeId] });
    },
  });

  // Note: no early "Store not found" return here.
  // Conditional returns after hooks caused React error #300 because the JSX
  // below contains conditionally-mounted children (Sheets, Dialogs, BulkEditDialog)
  // — toggling between early-return and full-render causes hook-count mismatches.
  // If there is no store, the products query stays disabled and the empty state shows.

  return (
    <div className="space-y-3">
      <PullToRefreshIndicator pull={pull} refreshing={refreshing} />
      {/* Mobile FAB to add a new product (hidden in bulk-mode) */}
      {!bulkMode && (
        <FAB
          onClick={() => setMobileProductId(null)}
          label="Product"
        />
      )}

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
                <Link to={`/dashboard/stores/${storeSlug}/products/bulk-upload`}><Upload className="mr-1.5 h-3.5 w-3.5" />Import</Link>
              </Button>
            </>
          )}
          {isMobile ? null : (
            <Button size="sm" asChild disabled={limitInfo && !limitInfo.can_create}>
              <Link to={`/dashboard/stores/${storeSlug}/products/create`}><Plus className="mr-1 h-4 w-4" />Add Product</Link>
            </Button>
          )}
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

      {/* Bulk mode header bar */}
      {bulkMode && (
        <div className="flex items-center justify-between rounded-lg border bg-accent/50 p-2.5">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={bulkSelected.size === paginatedProducts.length && paginatedProducts.length > 0}
              onCheckedChange={toggleSelectAll}
            />
            <span className="text-sm font-medium text-foreground">
              {bulkSelected.size} selected
            </span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={exitBulkMode}>Cancel</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={bulkSelected.size === 0 || bulkDeleteMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  {bulkDeleteMutation.isPending ? "Deleting..." : "Delete"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {bulkSelected.size} Products</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the selected products and all their images/variants. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => bulkDeleteMutation.mutate()}
                  >
                    Delete All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkSelected.size === 0 || bulkBestSellerMutation.isPending}
              onClick={() => bulkBestSellerMutation.mutate(true)}
            >
              <Star className="h-3.5 w-3.5 mr-1 fill-yellow-400 text-yellow-500" />
              Best Seller
            </Button>
            <Button
              size="sm"
              disabled={bulkSelected.size === 0}
              onClick={() => setBulkActionOpen(true)}
            >
              Edit Selected
            </Button>
          </div>
        </div>
      )}

      {/* Search + Filter + Sort bar — sticky on mobile so it stays in view as the list scrolls */}
      <Card className="border shadow-none sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">

        <CardContent className="p-2.5 space-y-2.5">
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
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setSortOpen(true)}>
              <ArrowUpDown className="h-4 w-4" />
            </Button>
            <Button
              variant="outline" size="icon"
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

          {/* Inline filter buttons */}
          <div className="flex gap-1.5 items-center">
            <button
              onClick={() => { setStatusFilter(statusFilter === "active" ? "all" : "active"); pagination.setPage(1); }}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border",
                statusFilter === "active"
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-input hover:bg-accent"
              )}
            >
              Active
            </button>
            <button
              onClick={() => { setStatusFilter(statusFilter === "draft" ? "all" : "draft"); pagination.setPage(1); }}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border",
                statusFilter === "draft"
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-input hover:bg-accent"
              )}
            >
              Inactive
            </button>
            {/* Category button */}
            <div className="relative">
              <button
                ref={categoryBtnRef}
                onClick={() => setCategoryPopupOpen(!categoryPopupOpen)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border flex items-center gap-1",
                  categoryFilter.length > 0
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-muted-foreground border-input hover:bg-accent"
                )}
              >
                Category
                {categoryFilter.length > 0 && (
                  <span className="bg-background text-foreground rounded-full h-4 min-w-[16px] flex items-center justify-center text-[10px] font-bold px-1">
                    {categoryFilter.length}
                  </span>
                )}
              </button>
              {categoryPopupOpen && categories.length > 0 && (
                <div
                  ref={categoryPopupRef}
                  className="absolute top-full left-0 mt-1 z-[60] min-w-[200px] max-h-[250px] overflow-y-auto rounded-lg border bg-popover p-2 shadow-lg"
                  style={{ position: "fixed", top: categoryBtnRef.current ? categoryBtnRef.current.getBoundingClientRect().bottom + 4 : 0, left: categoryBtnRef.current ? categoryBtnRef.current.getBoundingClientRect().left : 0 }}
                >
                  {categories.map(cat => (
                    <label
                      key={cat}
                      className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-accent cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={categoryFilter.includes(cat)}
                        onCheckedChange={() => toggleCategory(cat)}
                      />
                      <span className="truncate text-foreground">{cat}</span>
                    </label>
                  ))}
                  {categoryFilter.length > 0 && (
                    <button
                      onClick={() => { setCategoryFilter([]); pagination.setPage(1); }}
                      className="w-full text-xs text-primary font-medium mt-1 py-1"
                    >
                      Clear categories
                    </button>
                  )}
                </div>
              )}
            </div>
            {/* Bulk Edit toggle */}
            {allProducts && allProducts.length > 0 && !bulkMode && (
              <button
                onClick={() => setBulkMode(true)}
                className="ml-auto px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border bg-background text-muted-foreground border-input hover:bg-accent flex items-center gap-1"
              >
                <Pencil className="h-3 w-3" /> Bulk Edit
              </button>
            )}
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
              {categoryFilter.map(cat => (
                <Badge key={cat} variant="secondary" className="gap-1 text-xs pr-1">
                  {cat}
                  <button onClick={() => toggleCategory(cat)}><X className="h-3 w-3" /></button>
                </Badge>
              ))}
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
            <div className={cn("divide-y rounded-lg border bg-card", bulkMode && "pb-20")}>
              {paginatedProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 px-3 py-3"
                  onTouchStart={() => handleTouchStart(product.id)}
                  onTouchEnd={handleTouchEnd}
                  onTouchMove={handleTouchMove}
                >
                  {bulkMode && (
                    <Checkbox
                      checked={bulkSelected.has(product.id)}
                      onCheckedChange={() => toggleBulkSelect(product.id)}
                      className="shrink-0"
                    />
                  )}
                  {/* Image - tap to preview */}
                  {product.image_url ? (
                    <img
                      src={cleanImageUrl(product.image_url)}
                      alt=""
                      className="h-12 w-12 rounded-lg border object-cover shrink-0 cursor-pointer"
                      loading="lazy"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!longPressTriggered.current) setPreviewImage(cleanImageUrl(product.image_url)); }}
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted shrink-0">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      if (longPressTriggered.current) return;
                      if (bulkMode) { toggleBulkSelect(product.id); return; }
                      setMobileProductId(product.id);
                    }}
                    className="flex-1 min-w-0 active:bg-accent/50 transition-colors text-left"
                  >
                    <p className="font-medium text-sm text-foreground truncate">{product.name}</p>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      {/* Tappable PRICE pill — opens quick-edit (#4) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (longPressTriggered.current) return;
                          setQuickEditProduct(product);
                        }}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-border bg-muted/40 text-[11px] font-semibold text-foreground active:bg-muted"
                      >
                        {currencySymbol}
                        {Number(product.sale_price ?? product.price).toFixed(0)}
                        {product.sale_price && Number(product.sale_price) < Number(product.price) && (
                          <span className="text-[9px] text-muted-foreground line-through ml-0.5">{Number(product.price).toFixed(0)}</span>
                        )}
                      </button>
                      {/* Tappable STOCK pill */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (longPressTriggered.current) return;
                          setQuickEditProduct(product);
                        }}
                        className={cn(
                          "inline-flex items-center px-1.5 py-0.5 rounded-md border text-[11px] font-semibold active:bg-muted",
                          product.stock_quantity >= 999999
                            ? "border-border bg-muted/40 text-muted-foreground"
                            : product.stock_quantity > 0
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
                            : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
                        )}
                      >
                        {product.stock_quantity >= 999999
                          ? "∞"
                          : product.stock_quantity > 0
                          ? `${product.stock_quantity} in stock`
                          : "Out of stock"}
                      </button>
                    </div>
                  </button>
                  <Badge
                    variant={product.is_active ? "default" : "secondary"}
                    className={cn(
                      "shrink-0 text-[11px]",
                      product.is_active && "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0"
                    )}
                  >
                    {product.is_active ? "Active" : "Draft"}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {bulkMode && <TableHead className="w-10"><Checkbox checked={bulkSelected.size === paginatedProducts.length && paginatedProducts.length > 0} onCheckedChange={toggleSelectAll} /></TableHead>}
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
                      <TableRow key={product.id} className={cn(bulkSelected.has(product.id) && "bg-accent/30")}>
                        {bulkMode && (
                          <TableCell>
                            <Checkbox checked={bulkSelected.has(product.id)} onCheckedChange={() => toggleBulkSelect(product.id)} />
                          </TableCell>
                        )}
                        <TableCell>
                          {product.image_url ? (
                            <img
                              src={cleanImageUrl(product.image_url)}
                              alt=""
                              className="h-10 w-10 rounded-md border object-cover cursor-pointer hover:opacity-80 transition-opacity"
                              loading="lazy"
                              onClick={() => setPreviewImage(cleanImageUrl(product.image_url))}
                            />
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
                        <TableCell className="text-right">{product.stock_quantity >= 999999 ? "∞" : product.stock_quantity}</TableCell>
                        <TableCell>
                          <Badge variant={product.is_active ? "default" : "secondary"}>{product.is_active ? "Active" : "Draft"}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" asChild>
                              <Link to={`/dashboard/stores/${storeSlug}/products/${product.id}/edit`}><Pencil className="h-4 w-4" /></Link>
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
              <Button asChild><Link to={`/dashboard/stores/${storeSlug}/products/create`}><Plus className="mr-2 h-4 w-4" />Add your first product</Link></Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bulk edit floating action bar */}
      {bulkMode && bulkSelected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-3 shadow-lg safe-area-pb">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <span className="text-sm font-medium text-foreground">{bulkSelected.size} selected</span>
            <Button size="sm" onClick={() => setBulkActionOpen(true)}>
              Update Selected
            </Button>
          </div>
        </div>
      )}

      {/* Bulk edit action sheet */}
      <Sheet open={bulkActionOpen} onOpenChange={setBulkActionOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8 max-h-[80vh] overflow-auto">
          <SheetHeader>
            <SheetTitle className="text-left">Update {bulkSelected.size} Products</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Price</Label>
              <div className="flex gap-2">
                <select
                  value={bulkPriceMode}
                  onChange={(e) => setBulkPriceMode(e.target.value as "set" | "adjust")}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="set">Set to</option>
                  <option value="adjust">Adjust by (+/-)</option>
                </select>
                <Input
                  type="number"
                  placeholder={bulkPriceMode === "set" ? "New price" : "+10 or -5"}
                  value={bulkPriceChange}
                  onChange={(e) => setBulkPriceChange(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Stock Quantity</Label>
              <div className="flex gap-2">
                <select
                  value={bulkStockMode}
                  onChange={(e) => setBulkStockMode(e.target.value as "set" | "adjust")}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="set">Set to</option>
                  <option value="adjust">Adjust by (+/-)</option>
                </select>
                <Input
                  type="number"
                  placeholder={bulkStockMode === "set" ? "New stock" : "+10 or -5"}
                  value={bulkStockChange}
                  onChange={(e) => setBulkStockChange(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="space-y-2 mt-4">
            <Label>Best Seller</Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={bulkBestSellerMutation.isPending}
                onClick={() => bulkBestSellerMutation.mutate(true)}
              >
                <Star className="h-3.5 w-3.5 mr-1.5 fill-yellow-400 text-yellow-500" />
                Mark as Best Seller
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={bulkBestSellerMutation.isPending}
                onClick={() => bulkBestSellerMutation.mutate(false)}
              >
                <Star className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                Remove Best Seller
              </Button>
            </div>
          </div>
          <div className="flex gap-2 mt-6">
            <Button variant="outline" className="flex-1" onClick={() => setBulkActionOpen(false)}>Cancel</Button>
            <Button
              className="flex-1"
              onClick={() => bulkUpdateMutation.mutate()}
              disabled={(bulkPriceChange === "" && bulkStockChange === "") || bulkUpdateMutation.isPending}
            >
              {bulkUpdateMutation.isPending ? "Updating..." : `Update ${bulkSelected.size} Products`}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

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
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Stock status</p>
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
            {categories.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Category</p>
                <div className="space-y-1">
                  {categories.map(cat => (
                    <label key={cat} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-accent/50 cursor-pointer">
                      <Checkbox checked={categoryFilter.includes(cat)} onCheckedChange={() => toggleCategory(cat)} />
                      <span className="text-foreground">{cat}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <Button onClick={() => setFilterOpen(false)} className="w-full mt-6">Apply Filters</Button>
        </SheetContent>
      </Sheet>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={(v) => { if (!v) setPreviewImage(null); }}>
        <DialogContent className="sm:max-w-lg p-2 bg-background/95 backdrop-blur">
          {previewImage && (
            <img
              src={previewImage}
              alt="Product preview"
              className="w-full h-auto max-h-[80vh] object-contain rounded-md"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Mobile Product Edit/Create Sheet */}
      <Sheet open={mobileProductId !== undefined} onOpenChange={(v) => { if (!v) setMobileProductId(undefined); }}>
        <SheetContent side="bottom" className="h-[95vh] rounded-t-2xl px-0 overflow-hidden flex flex-col">
          <SheetHeader className="px-4 pb-3 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg font-bold">
                {mobileProductId ? "Edit Product" : "Add Product"}
              </SheetTitle>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {mobileProductId !== undefined && (
              <ProductForm
                key={mobileProductId || "create"}
                productId={mobileProductId || undefined}
                onClose={() => {
                  setMobileProductId(undefined);
                  queryClient.invalidateQueries({ queryKey: ["products-all", storeId] });
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Quick edit modal — opens when tapping price/stock pill on mobile (#4) */}
      <QuickEditProductModal
        open={!!quickEditProduct}
        onOpenChange={(v) => { if (!v) setQuickEditProduct(null); }}
        product={quickEditProduct}
        storeId={storeId}
      />
    </div>
  );
}