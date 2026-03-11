import { useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Upload, FileText, Download, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface ParsedProduct {
  name: string;
  price: number;
  sale_price: number | null;
  description: string;
  category: string;
  stock_quantity: number;
  sku: string;
  image_url: string;
  valid: boolean;
  error?: string;
  row: number;
}

const CSV_TEMPLATE = "name,price,sale_price,description,category,stock_quantity,sku,image_url\nExample Product,29.99,,A great product,Accessories,100,SKU-001,https://example.com/image.jpg";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-") +
    "-" + Math.random().toString(36).substring(2, 6);
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
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

function parseCSV(text: string): ParsedProduct[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const nameIdx = headers.indexOf("name");
  const priceIdx = headers.indexOf("price");
  const salePriceIdx = headers.indexOf("sale_price");
  const descIdx = headers.indexOf("description");
  const catIdx = headers.indexOf("category");
  const stockIdx = headers.indexOf("stock_quantity");
  const skuIdx = headers.indexOf("sku");
  const imageIdx = headers.indexOf("image_url");

  if (nameIdx === -1 || priceIdx === -1) {
    return [{ name: "", price: 0, sale_price: null, description: "", category: "", stock_quantity: 0, sku: "", image_url: "", valid: false, error: "CSV must have 'name' and 'price' columns", row: 2 }];
  }

  return lines.slice(1).map((line, idx) => {
    const cols = parseCSVLine(line);
    const name = cols[nameIdx]?.trim() || "";
    const price = parseFloat(cols[priceIdx]) || 0;
    const sale_price = salePriceIdx >= 0 && cols[salePriceIdx] ? parseFloat(cols[salePriceIdx]) || null : null;
    const description = descIdx >= 0 ? cols[descIdx]?.trim() || "" : "";
    const category = catIdx >= 0 ? cols[catIdx]?.trim() || "" : "";
    const stock_quantity = stockIdx >= 0 ? parseInt(cols[stockIdx]) || 0 : 0;
    const sku = skuIdx >= 0 ? cols[skuIdx]?.trim() || "" : "";
    const image_url = imageIdx >= 0 ? cols[imageIdx]?.trim() || "" : "";

    let valid = true;
    let error: string | undefined;
    if (!name) { valid = false; error = `Row ${idx + 2}: Name is required`; }
    else if (price <= 0) { valid = false; error = `Row ${idx + 2}: Price must be > 0`; }

    return { name, price, sale_price, description, category, stock_quantity, sku, image_url, valid, error, row: idx + 2 };
  });
}

export default function BulkUpload() {
  const { storeId } = useParams<{ storeId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [parsed, setParsed] = useState<ParsedProduct[]>([]);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);

  const { data: limitInfo } = useQuery({
    queryKey: ["product-limit", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("check_product_limit", { _user_id: user!.id });
      if (error) throw error;
      return data as { plan_name: string; product_limit: number | null; current_count: number; can_create: boolean };
    },
    enabled: !!user,
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const products = parseCSV(text);
      setParsed(products);
      if (products.length === 0) toast.error("No products found in CSV");
    };
    reader.readAsText(file);
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const validProducts = parsed.filter((p) => p.valid);
      if (validProducts.length === 0) throw new Error("No valid products to upload");

      const remaining = limitInfo?.product_limit
        ? limitInfo.product_limit - limitInfo.current_count
        : Infinity;

      const toInsert = validProducts.slice(0, remaining).map((p) => ({
        store_id: storeId!,
        name: p.name,
        slug: generateSlug(p.name),
        price: p.price,
        sale_price: p.sale_price,
        description: p.description || null,
        category: p.category || null,
        stock_quantity: p.stock_quantity,
        sku: p.sku || null,
        is_active: true,
      }));

      const { error } = await supabase.from("products").insert(toInsert);
      if (error) throw error;

      return { success: toInsert.length, failed: validProducts.length - toInsert.length + parsed.filter((p) => !p.valid).length };
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["products", storeId] });
      queryClient.invalidateQueries({ queryKey: ["products-count", storeId] });
      queryClient.invalidateQueries({ queryKey: ["product-limit"] });
      toast.success(`${data.success} products uploaded successfully!`);
    },
    onError: (err: any) => toast.error(err.message || "Upload failed"),
  });

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const validCount = parsed.filter((p) => p.valid).length;
  const invalidCount = parsed.filter((p) => !p.valid).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/dashboard/stores/${storeId}/products`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Bulk Upload Products</h1>
          <p className="text-sm text-muted-foreground">Import products from a CSV file</p>
        </div>
      </div>

      {limitInfo && (
        <div className="rounded-lg border bg-card p-3 text-sm text-muted-foreground">
          <strong className="text-foreground">{limitInfo.plan_name}</strong> — {limitInfo.current_count}/{limitInfo.product_limit ?? "∞"} products used
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload CSV</CardTitle>
          <CardDescription>
            Your CSV should have columns: name, price, sale_price, description, category, stock_quantity, sku
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" /> Download Template
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Choose CSV File
            </Button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </div>
          {fileName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" /> {fileName}
            </div>
          )}
        </CardContent>
      </Card>

      {parsed.length > 0 && !result && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex gap-3 text-sm">
              <Badge variant="default">{validCount} valid</Badge>
              {invalidCount > 0 && <Badge variant="destructive">{invalidCount} invalid</Badge>}
            </div>
            <Button onClick={() => uploadMutation.mutate()} disabled={validCount === 0 || uploadMutation.isPending}>
              {uploadMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Upload {validCount} Products
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.map((p, i) => (
                    <TableRow key={i} className={!p.valid ? "bg-destructive/5" : ""}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{p.name || "—"}</TableCell>
                      <TableCell className="text-right">${p.price.toFixed(2)}</TableCell>
                      <TableCell>{p.category || "—"}</TableCell>
                      <TableCell className="text-right">{p.stock_quantity}</TableCell>
                      <TableCell>
                        {p.valid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-destructive">
                            <XCircle className="h-3 w-3" /> {p.error}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {result && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
            <p className="text-lg font-semibold text-foreground">{result.success} products uploaded</p>
            {result.failed > 0 && <p className="text-sm text-muted-foreground">{result.failed} skipped (invalid or limit reached)</p>}
            <div className="flex gap-3">
              <Button asChild variant="outline">
                <Link to={`/dashboard/stores/${storeId}/products`}>View Products</Link>
              </Button>
              <Button onClick={() => { setParsed([]); setResult(null); setFileName(""); }}>
                Upload More
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
