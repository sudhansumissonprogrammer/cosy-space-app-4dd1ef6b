import { useState, useRef, useMemo } from "react";
import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useStoreData } from "@/hooks/useStoreData";
import { useStorePurge } from "@/hooks/useStorePurge";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowLeft, Upload, FileText, Download, CheckCircle2, XCircle,
  Loader2, AlertTriangle, FileDown, ArrowRight, Columns3,
} from "lucide-react";
import { compressAndUploadExternalImages } from "@/lib/externalImageCopy";

// ── Types ──────────────────────────────────────────────────────────────────
type ImportMode = "create" | "update" | "both";

interface ParsedRow {
  rowNumber: number;
  raw: Record<string, string>;
  mapped: MappedProduct;
  valid: boolean;
  errors: string[];
  isEmpty: boolean;
}

interface MappedProduct {
  name: string;
  price: number;
  sale_price: number | null;
  description: string;
  category: string;
  stock_quantity: number;
  sku: string;
  image_url: string;
  is_active: boolean;
}

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; error: string }[];
  _createdProducts?: Array<{ id: string; image_url: string }>;
}

// ── Product fields for mapping ─────────────────────────────────────────────
const PRODUCT_FIELDS = [
  { key: "name", label: "Product Name", required: true },
  { key: "price", label: "Price", required: true },
  { key: "sale_price", label: "Sale Price", required: false },
  { key: "description", label: "Description", required: false },
  { key: "category", label: "Category", required: false },
  { key: "stock_quantity", label: "Stock Quantity", required: false },
  { key: "sku", label: "SKU", required: false },
  { key: "image_url", label: "Image URL", required: false },
  { key: "is_active", label: "Active Status", required: false },
] as const;

type ProductFieldKey = typeof PRODUCT_FIELDS[number]["key"];

const EXPORT_COLUMNS = [
  { key: "name", label: "Name" },
  { key: "price", label: "Price" },
  { key: "sale_price", label: "Sale Price" },
  { key: "description", label: "Description" },
  { key: "category", label: "Category" },
  { key: "stock_quantity", label: "Stock Qty" },
  { key: "sku", label: "SKU" },
  { key: "image_url", label: "Image URL" },
  { key: "is_active", label: "Active" },
  { key: "is_best_selling", label: "Best Selling" },
  { key: "slug", label: "Slug" },
];

const CSV_TEMPLATE =
  "name,price,sale_price,description,category,stock_quantity,sku,image_url\n" +
  '"Example Product",29.99,,A great product,Accessories,100,SKU-001,https://example.com/image.jpg\n' +
  '"Another Product",49.99,39.99,Another description,Clothing,50,SKU-002,';

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function generateSlug(name: string): string {
  return (
    name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-") +
    "-" + Math.random().toString(36).substring(2, 6)
  );
}

function fuzzyMatch(input: string, candidates: string[]): string | null {
  const lower = input.toLowerCase().trim();
  if (!lower) return null;
  // exact match
  const exact = candidates.find((c) => c.toLowerCase() === lower);
  if (exact) return exact;
  // starts-with match (either direction)
  const starts = candidates.find((c) => c.toLowerCase().startsWith(lower) || lower.startsWith(c.toLowerCase()));
  if (starts) return starts;
  // 3-4 char prefix similarity
  if (lower.length >= 3) {
    const prefixLen = Math.min(4, lower.length);
    const prefix = lower.substring(0, prefixLen);
    const partial = candidates.find((c) => {
      const cl = c.toLowerCase();
      return cl.substring(0, prefixLen) === prefix || cl.includes(prefix) || prefix.includes(cl.substring(0, Math.min(4, cl.length)));
    });
    if (partial) return partial;
    // contains match
    const contains = candidates.find((c) => c.toLowerCase().includes(lower) || lower.includes(c.toLowerCase()));
    if (contains) return contains;
    // Levenshtein-like: match if >60% chars overlap
    const charMatch = candidates.find((c) => {
      const cl = c.toLowerCase();
      const common = [...lower].filter(ch => cl.includes(ch)).length;
      return common >= Math.max(3, Math.floor(Math.min(lower.length, cl.length) * 0.6));
    });
    if (charMatch) return charMatch;
  }
  return null;
}

function autoMapColumns(csvHeaders: string[]): Record<string, ProductFieldKey | "skip"> {
  const mapping: Record<string, ProductFieldKey | "skip"> = {};
  const aliases: Record<string, ProductFieldKey> = {
    name: "name", product_name: "name", title: "name", product_title: "name", "product name": "name",
    price: "price", regular_price: "price", "regular price": "price",
    sale_price: "sale_price", "sale price": "sale_price", discount_price: "sale_price",
    description: "description", desc: "description", details: "description",
    category: "category", categories: "category", cat: "category", "product category": "category",
    stock_quantity: "stock_quantity", stock: "stock_quantity", qty: "stock_quantity", quantity: "stock_quantity",
    sku: "sku", "product sku": "sku",
    image_url: "image_url", image: "image_url", "image url": "image_url", photo: "image_url", picture: "image_url",
    is_active: "is_active", active: "is_active", status: "is_active",
  };

  const used = new Set<string>();
  csvHeaders.forEach((h) => {
    const normalized = h.toLowerCase().replace(/[\s_-]+/g, "_").replace(/^_|_$/g, "");
    const match = aliases[normalized] || aliases[h.toLowerCase().trim()];
    if (match && !used.has(match)) {
      mapping[h] = match;
      used.add(match);
    } else {
      mapping[h] = "skip";
    }
  });
  return mapping;
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function BulkUpload() {
  const { storeId, storeSlug } = useStoreSlugParam();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  // Steps: upload → map → preview → importing → result
  const [step, setStep] = useState<"upload" | "map" | "preview" | "importing" | "result">("upload");
  const [fileName, setFileName] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, ProductFieldKey | "skip">>({});
  const [importMode, setImportMode] = useState<ImportMode>("create");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Export state
  const [showExport, setShowExport] = useState(false);
  const [exportColumns, setExportColumns] = useState<string[]>(
    EXPORT_COLUMNS.map((c) => c.key)
  );

  const { data: limitInfo } = useQuery({
    queryKey: ["product-limit", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("check_product_limit", { _user_id: user!.id });
      if (error) throw error;
      return data as { plan_name: string; product_limit: number | null; current_count: number; can_create: boolean };
    },
    enabled: !!user,
  });

  const { data: store } = useStoreData(storeId);
  const purgeStore = useStorePurge(storeId);

  const { data: categories } = useQuery({
    queryKey: ["categories", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("categories").select("*").eq("store_id", storeId!).order("name");
      if (error) throw error;
      return data as { id: string; name: string; slug: string }[];
    },
    enabled: !!storeId,
  });

  const categoryNames = useMemo(() => categories?.map((c) => c.name) || [], [categories]);

  // ── Parse CSV File ──────────────────────────────────────────────────────

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Accept .csv or common CSV MIME types; also allow .xls/.xlsx extension picked by Android
    const validExts = [".csv", ".txt"];
    const validMimes = ["text/csv", "text/comma-separated-values", "application/csv", "application/vnd.ms-excel", "text/plain"];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!validExts.includes(ext) && !validMimes.includes(file.type)) {
      toast.error("Please upload a CSV file (.csv)");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) { toast.error("CSV must have a header row and at least one data row"); return; }
      const headers = parseCSVLine(lines[0]);
      const rows = lines.slice(1).map(parseCSVLine);
      setCsvHeaders(headers);
      setCsvRows(rows);
      setColumnMapping(autoMapColumns(headers));
      setStep("map");
    };
    reader.readAsText(file);
  };

  // ── Build parsed rows from mapping ────────────────────────────────────

  const parsedRows = useMemo((): ParsedRow[] => {
    if (!csvHeaders.length || !csvRows.length) return [];

    return csvRows.map((cols, idx) => {
      const raw: Record<string, string> = {};
      csvHeaders.forEach((h, i) => { raw[h] = cols[i] || ""; });

      // Check if row is completely empty
      const isEmpty = cols.every((c) => !c.trim());
      if (isEmpty) return { rowNumber: idx + 2, raw, mapped: {} as MappedProduct, valid: false, errors: [], isEmpty: true };

      const getValue = (field: ProductFieldKey): string => {
        const header = Object.entries(columnMapping).find(([, v]) => v === field)?.[0];
        if (!header) return "";
        const hIdx = csvHeaders.indexOf(header);
        return hIdx >= 0 ? (cols[hIdx] || "").trim() : "";
      };

      const name = getValue("name");
      const priceStr = getValue("price");
      const price = parseFloat(priceStr) || 0;
      const salePriceStr = getValue("sale_price");
      const sale_price = salePriceStr ? parseFloat(salePriceStr) || null : null;
      const description = getValue("description");
      const rawCategory = getValue("category");
      const stockStr = getValue("stock_quantity").trim();
      // If no stock column mapped or value is empty, treat as unlimited (999999)
      const stock_quantity = stockStr === "" ? 999999 : (parseInt(stockStr) || 0);
      const sku = getValue("sku");
      const image_url = getValue("image_url");
      const activeStr = getValue("is_active");
      const is_active = activeStr ? !["false", "0", "no", "inactive", "draft"].includes(activeStr.toLowerCase()) : true;

      // Fuzzy match category
      let category = rawCategory;
      if (rawCategory && categoryNames.length > 0) {
        const matched = fuzzyMatch(rawCategory, categoryNames);
        if (matched) category = matched;
      }

      const errors: string[] = [];
      if (!name) errors.push("Name is required");
      if (price <= 0 && priceStr) errors.push("Price must be greater than 0");
      if (!priceStr) errors.push("Price is required");

      return {
        rowNumber: idx + 2,
        raw,
        mapped: { name, price, sale_price, description, category, stock_quantity, sku, image_url, is_active },
        valid: errors.length === 0,
        errors,
        isEmpty: false,
      };
    });
  }, [csvHeaders, csvRows, columnMapping, categoryNames]);

  const activeRows = parsedRows.filter((r) => !r.isEmpty);
  const validRows = activeRows.filter((r) => r.valid);
  const invalidRows = activeRows.filter((r) => !r.valid);

  // ── Import Mutation ───────────────────────────────────────────────────

  const importMutation = useMutation({
    mutationFn: async (): Promise<ImportResult> => {
      const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
      const createdProducts: Array<{ id: string; image_url: string }> = [];
      if (validRows.length === 0) throw new Error("No valid products to import");

      const remaining = limitInfo?.product_limit ? limitInfo.product_limit - limitInfo.current_count : Infinity;

      // Auto-create missing categories
      const uniqueCategories = [...new Set(validRows.map(r => r.mapped.category).filter(Boolean))];
      const existingCategoryNames = new Set(categoryNames.map(n => n.toLowerCase()));
      const missingCategories = uniqueCategories.filter(c => !existingCategoryNames.has(c.toLowerCase()));

      if (missingCategories.length > 0) {
        const newCategories = missingCategories.map(name => ({
          store_id: storeId!,
          name,
          slug: name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-"),
        }));
        const { error: catError } = await (supabase as any).from("categories").insert(newCategories);
        if (catError) {
          console.error("Failed to create categories:", catError);
          toast.error(`Failed to auto-create some categories: ${catError.message}`);
        } else {
          toast.success(`Auto-created ${missingCategories.length} new categor${missingCategories.length === 1 ? 'y' : 'ies'}: ${missingCategories.join(', ')}`);
        }
      }

      // For update mode, load existing products by SKU
      let existingBySku: Record<string, string> = {};
      if (importMode === "update" || importMode === "both") {
        const { data } = await supabase
          .from("products")
          .select("id, sku")
          .eq("store_id", storeId!)
          .not("sku", "is", null);
        if (data) {
          data.forEach((p: any) => { if (p.sku) existingBySku[p.sku] = p.id; });
        }
      }

      let createdCount = 0;

      for (const row of validRows) {
        try {
          const { mapped } = row;
          const existingId = mapped.sku ? existingBySku[mapped.sku] : null;

          if (existingId && (importMode === "update" || importMode === "both")) {
            // Update existing
            const { error } = await supabase.from("products").update({
              name: mapped.name,
              price: mapped.price,
              sale_price: mapped.sale_price,
              description: mapped.description || null,
              category: mapped.category || null,
              stock_quantity: mapped.stock_quantity,
              image_url: mapped.image_url || null,
              is_active: mapped.is_active,
            }).eq("id", existingId);
            if (error) throw error;
            result.updated++;
          } else if (!existingId && (importMode === "create" || importMode === "both")) {
            // Create new
            if (createdCount >= remaining) {
              result.errors.push({ row: row.rowNumber, error: "Product limit reached" });
              result.skipped++;
              continue;
            }
            const { data: insertedProduct, error } = await supabase.from("products").insert({
              store_id: storeId!,
              name: mapped.name,
              slug: generateSlug(mapped.name),
              price: mapped.price,
              sale_price: mapped.sale_price,
              currency: store?.currency || 'INR',
              description: mapped.description || null,
              category: mapped.category || null,
              stock_quantity: mapped.stock_quantity,
              sku: mapped.sku || null,
              image_url: mapped.image_url || null,
              is_active: mapped.is_active,
            }).select("id").single();
            if (error) throw error;
            result.created++;
            createdCount++;
            // Track for background image copy
            if (insertedProduct && mapped.image_url) {
              createdProducts.push({ id: insertedProduct.id, image_url: mapped.image_url });
            }
          } else {
            result.skipped++;
          }
        } catch (err: any) {
          result.errors.push({ row: row.rowNumber, error: err.message || "Unknown error" });
          result.skipped++;
        }
      }

      // Add invalid rows to errors
      invalidRows.forEach((r) => {
        result.errors.push({ row: r.rowNumber, error: r.errors.join("; ") });
        result.skipped++;
      });

      return { ...result, _createdProducts: createdProducts };
    },
    onSuccess: (data) => {
      const { _createdProducts, ...importResult } = data;
      setImportResult(importResult);
      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["categories", storeId] });
      queryClient.invalidateQueries({ queryKey: ["products", storeId] });
      queryClient.invalidateQueries({ queryKey: ["products-all", storeId] });
      queryClient.invalidateQueries({ queryKey: ["products-count", storeId] });
      queryClient.invalidateQueries({ queryKey: ["product-limit"] });

      // Background-copy external images to our storage + sync to media library
      if (_createdProducts && _createdProducts.length > 0 && storeId) {
        compressAndUploadExternalImages(_createdProducts, storeId);

        // Auto-sync product images to media library (fire-and-forget)
        const imageUrls = _createdProducts
          .map((p) => p.image_url)
          .filter((u): u is string => !!u && u.trim() !== "");

        if (imageUrls.length > 0) {
          supabase
            .from("media_library")
            .select("file_url")
            .eq("store_id", storeId)
            .in("file_url", imageUrls)
            .then(({ data: existing }) => {
              const existingSet = new Set((existing || []).map((m: any) => m.file_url));
              const newUrls = imageUrls.filter((u) => !existingSet.has(u));
              if (newUrls.length > 0) {
                supabase
                  .from("media_library")
                  .insert(
                    newUrls.map((url) => ({
                      store_id: storeId,
                      file_url: url,
                      file_name: url.split("/").pop()?.split("?")[0] || "product-image",
                      file_size: 0,
                    }))
                  )
                  .then(() =>
                    console.info(`[media-sync] Synced ${newUrls.length} images to media library`)
                  );
              }
            });
        }
      }

      const msg = [];
      if (importResult.created > 0) msg.push(`${importResult.created} created`);
      if (importResult.updated > 0) msg.push(`${importResult.updated} updated`);
      toast.success(`Import complete: ${msg.join(", ")}`);
    },
    onError: (err: any) => toast.error(err.message || "Import failed"),
  });

  // ── Export ────────────────────────────────────────────────────────────

  const handleExport = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("name, price, sale_price, description, category, stock_quantity, sku, image_url, is_active, is_best_selling, slug")
        .eq("store_id", storeId!);
      if (error) throw error;
      if (!data?.length) { toast.error("No products to export"); return; }
      const headers = exportColumns.join(",");
      const rows = data.map((p: any) =>
        exportColumns.map((col) => {
          const val = p[col] ?? "";
          return `"${String(val).replace(/"/g, '""')}"`;
        }).join(",")
      );
      const csv = [headers, ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "products-export.csv"; a.click();
      URL.revokeObjectURL(url);
      setShowExport(false);
      toast.success("Products exported");
    } catch (e: any) { toast.error(e.message); }
  };

  // ── Download errors as CSV ────────────────────────────────────────────

  const downloadErrors = () => {
    if (!importResult?.errors.length) return;
    const csv = "Row,Error\n" + importResult.errors.map((e) => `${e.row},"${e.error.replace(/"/g, '""')}"`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "import-errors.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "products-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    setStep("upload");
    setFileName("");
    setCsvHeaders([]);
    setCsvRows([]);
    setColumnMapping({});
    setImportResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/dashboard/stores/${storeSlug}/products`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-foreground">Import / Export Products</h1>
          <p className="text-sm text-muted-foreground">CSV-based product management</p>
        </div>
      </div>

      {limitInfo && (
        <div className="rounded-lg border bg-card p-3 text-sm text-muted-foreground">
          <strong className="text-foreground">{limitInfo.plan_name}</strong> — {limitInfo.current_count}/{limitInfo.product_limit ?? "∞"} products used
        </div>
      )}

      {/* ── Step: Upload ─────────────────────────────────────────────────── */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Import or Export Products</CardTitle>
            <CardDescription>Upload a CSV to import products, or export your existing catalog.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-input p-6 transition-colors hover:border-primary/50 hover:bg-accent/30"
              >
                <Upload className="h-8 w-8 text-primary" />
                <div className="text-center">
                  <p className="font-medium text-foreground">Import CSV</p>
                  <p className="text-xs text-muted-foreground">Upload & map columns</p>
                </div>
              </button>
              <button
                onClick={() => setShowExport(true)}
                className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-input p-6 transition-colors hover:border-primary/50 hover:bg-accent/30"
              >
                <Download className="h-8 w-8 text-primary" />
                <div className="text-center">
                  <p className="font-medium text-foreground">Export CSV</p>
                  <p className="text-xs text-muted-foreground">Choose columns to export</p>
                </div>
              </button>
              <button
                onClick={downloadTemplate}
                className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-input p-6 transition-colors hover:border-primary/50 hover:bg-accent/30"
              >
                <FileText className="h-8 w-8 text-primary" />
                <div className="text-center">
                  <p className="font-medium text-foreground">Download Template</p>
                  <p className="text-xs text-muted-foreground">Get sample CSV format</p>
                </div>
              </button>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/comma-separated-values,application/csv,application/vnd.ms-excel,text/plain" className="hidden" onChange={handleFile} />
          </CardContent>
        </Card>
      )}

      {/* ── Step: Column Mapping ───────────────────────────────────────── */}
      {step === "map" && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Columns3 className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">Map Columns</CardTitle>
                <CardDescription>
                  Map your CSV columns to product fields. File: <span className="font-medium text-foreground">{fileName}</span>
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {csvHeaders.map((header) => (
                <div key={header} className="flex items-center gap-3">
                  <div className="w-40 shrink-0 truncate rounded bg-muted px-3 py-2 text-sm font-medium">{header}</div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <Select
                    value={columnMapping[header] || "skip"}
                    onValueChange={(val) => setColumnMapping((prev) => ({ ...prev, [header]: val as ProductFieldKey | "skip" }))}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">⏭ Skip this column</SelectItem>
                      {PRODUCT_FIELDS.map((f) => (
                        <SelectItem key={f.key} value={f.key}>
                          {f.label} {f.required && "*"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Show sample value */}
                  <span className="truncate text-xs text-muted-foreground">
                    e.g. "{csvRows[0]?.[csvHeaders.indexOf(header)] || ""}"
                  </span>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Import Mode</Label>
              <Select value={importMode} onValueChange={(v) => setImportMode(v as ImportMode)}>
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="create">Create new products only</SelectItem>
                  <SelectItem value="update">Update existing only (match by SKU)</SelectItem>
                  <SelectItem value="both">Create & Update (match by SKU)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {importMode === "create" && "All rows will be imported as new products."}
                {importMode === "update" && "Only rows with matching SKUs will be updated. New rows will be skipped."}
                {importMode === "both" && "Matching SKUs will be updated, non-matching rows will be created."}
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={resetAll}>Cancel</Button>
              <Button onClick={() => setStep("preview")}>
                Preview Data <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step: Preview ─────────────────────────────────────────────── */}
      {step === "preview" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-3 text-sm">
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> {validRows.length} valid
              </Badge>
              {invalidRows.length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" /> {invalidRows.length} invalid
                </Badge>
              )}
              {parsedRows.filter((r) => r.isEmpty).length > 0 && (
                <Badge variant="secondary" className="gap-1">
                  {parsedRows.filter((r) => r.isEmpty).length} empty (skipped)
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("map")}>← Back to Mapping</Button>
              <Button
                onClick={() => { setStep("importing"); importMutation.mutate(); }}
                disabled={validRows.length === 0}
              >
                {importMode === "create" && `Import ${validRows.length} Products`}
                {importMode === "update" && `Update Products`}
                {importMode === "both" && `Import & Update`}
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeRows.map((row) => (
                      <TableRow key={row.rowNumber} className={!row.valid ? "bg-destructive/5" : ""}>
                        <TableCell className="text-muted-foreground text-xs">{row.rowNumber}</TableCell>
                        <TableCell className="max-w-[200px] truncate font-medium">{row.mapped.name || "—"}</TableCell>
                        <TableCell className="text-right">{row.mapped.price > 0 ? row.mapped.price.toFixed(2) : "—"}</TableCell>
                        <TableCell className="max-w-[120px] truncate">{row.mapped.category || "—"}</TableCell>
                        <TableCell className="text-right">{row.mapped.stock_quantity}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{row.mapped.sku || "—"}</TableCell>
                        <TableCell>
                          {row.valid ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-destructive" title={row.errors.join("; ")}>
                              <XCircle className="h-3 w-3 shrink-0" /> {row.errors[0]}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Step: Importing ────────────────────────────────────────────── */}
      {step === "importing" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium text-foreground">Importing products...</p>
            <p className="text-sm text-muted-foreground">Please don't close this page</p>
          </CardContent>
        </Card>
      )}

      {/* ── Step: Result ───────────────────────────────────────────────── */}
      {step === "result" && importResult && (
        <Card>
          <CardContent className="space-y-6 py-8">
            <div className="flex flex-col items-center gap-3 text-center">
              {importResult.errors.length === 0 ? (
                <CheckCircle2 className="h-14 w-14 text-green-600" />
              ) : (
                <AlertTriangle className="h-14 w-14 text-yellow-500" />
              )}
              <h2 className="text-xl font-semibold text-foreground">Import Complete</h2>
            </div>

            <div className="mx-auto grid max-w-md grid-cols-3 gap-4 text-center">
              <div className="rounded-lg border bg-green-50 p-4 dark:bg-green-950/30">
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{importResult.created}</p>
                <p className="text-xs text-muted-foreground">Created</p>
              </div>
              <div className="rounded-lg border bg-blue-50 p-4 dark:bg-blue-950/30">
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{importResult.updated}</p>
                <p className="text-xs text-muted-foreground">Updated</p>
              </div>
              <div className="rounded-lg border bg-yellow-50 p-4 dark:bg-yellow-950/30">
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{importResult.skipped}</p>
                <p className="text-xs text-muted-foreground">Skipped</p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="mx-auto max-w-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-foreground">Error Details ({importResult.errors.length})</h3>
                  <Button variant="outline" size="sm" onClick={downloadErrors}>
                    <FileDown className="mr-2 h-3 w-3" /> Download Errors
                  </Button>
                </div>
                <ScrollArea className="max-h-48 rounded-md border">
                  <div className="space-y-1 p-3">
                    {importResult.errors.map((e, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <Badge variant="outline" className="shrink-0">Row {e.row}</Badge>
                        <span className="text-destructive">{e.error}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            <div className="flex justify-center gap-3">
              <Button asChild variant="outline">
                <Link to={`/dashboard/stores/${storeSlug}/products`}>View Products</Link>
              </Button>
              <Button onClick={resetAll}>Import More</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Export Dialog ────────────────────────────────────────────── */}
      <Dialog open={showExport} onOpenChange={setShowExport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Products</DialogTitle>
            <DialogDescription>Choose which columns to include in the export.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {EXPORT_COLUMNS.map((col) => (
              <div key={col.key} className="flex items-center gap-3">
                <Checkbox
                  id={`export-${col.key}`}
                  checked={exportColumns.includes(col.key)}
                  onCheckedChange={(checked) => {
                    if (checked) setExportColumns((prev) => [...prev, col.key]);
                    else setExportColumns((prev) => prev.filter((c) => c !== col.key));
                  }}
                />
                <Label htmlFor={`export-${col.key}`} className="cursor-pointer">{col.label}</Label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExport(false)}>Cancel</Button>
            <Button onClick={handleExport} disabled={exportColumns.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Export {exportColumns.length} columns
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
