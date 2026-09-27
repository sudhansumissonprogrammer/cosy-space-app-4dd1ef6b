import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Download, FileJson, Loader2, PackagePlus, Upload, XCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";
import { useStorePurge } from "@/hooks/useStorePurge";
import { toast } from "sonner";

type MeeshoProduct = {
  source_id: string;
  source_url: string;
  name: string;
  selling_price: number | null;
  original_price?: number | null;
  description?: string;
  images: string[];
  videos?: string[];
  missing?: string[];
};

type ImportFile = {
  format: string;
  version: number;
  category?: { name?: string; slug?: string };
  products: MeeshoProduct[];
};

const IMITATIONWORLD_ID = "c3c5dff2-173a-4f4d-90e4-8b1c88c305d9";
const MAX_FILE_BYTES = 2 * 1024 * 1024;

function cleanSourceUrl(value: string) {
  try {
    const url = new URL(value);
    if (!/(^|\.)meesho\.com$/i.test(url.hostname) || !/\/s\/p\/[a-z0-9]+/i.test(url.pathname)) return "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch { return ""; }
}

export default function MeeshoImport() {
  const { storeId, storeSlug } = useStoreSlugParam();
  const queryClient = useQueryClient();
  const purgeStore = useStorePurge(storeId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [products, setProducts] = useState<MeeshoProduct[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fileName, setFileName] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ created: number; skipped: number; failed: string[] } | null>(null);

  const validProducts = useMemo(() => products.filter((product) => (
    product.source_id && cleanSourceUrl(product.source_url) && product.name?.trim().length >= 2 &&
    Number(product.selling_price) > 0 && Array.isArray(product.images) && product.images.length > 0
  )), [products]);

  const readFile = async (file?: File) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return toast.error("Import file is larger than 2 MB.");
    try {
      const parsed = JSON.parse(await file.text()) as ImportFile;
      if (parsed.format !== "shopbanao-meesho-import" || parsed.version !== 1 || !Array.isArray(parsed.products)) {
        throw new Error("This is not a ShopBanao Meesho export file.");
      }
      if (parsed.products.length > 100) throw new Error("A file can contain at most 100 products.");
      const unique = new Map<string, MeeshoProduct>();
      parsed.products.forEach((product) => {
        if (product?.source_id) unique.set(product.source_id, { ...product, source_url: cleanSourceUrl(product.source_url) });
      });
      const next = [...unique.values()];
      setProducts(next);
      setSelected(new Set(next.filter((product) => product.name && Number(product.selling_price) > 0 && product.images?.length).map((product) => product.source_id)));
      setFileName(file.name);
      setResults(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read this import file.");
    }
  };

  const importProducts = async () => {
    if (!storeId || !selected.size) return;
    if (storeId !== IMITATIONWORLD_ID && storeSlug?.toLowerCase() !== "imitationworld") {
      return toast.error("Meesho importing is enabled only for Imitation World.");
    }
    const queue = validProducts.filter((product) => selected.has(product.source_id));
    setRunning(true);
    setProgress(0);
    const next = { created: 0, skipped: 0, failed: [] as string[] };
    for (let index = 0; index < queue.length; index++) {
      const product = queue[index];
      const { data, error } = await supabase.functions.invoke("meesho-product-import", {
        body: { store_id: storeId, category_name: "New2", category_slug: "new2", product },
      });
      if (error || data?.error) next.failed.push(`${product.name}: ${data?.error || error?.message || "Import failed"}`);
      else if (data?.status === "skipped") next.skipped++;
      else next.created++;
      setProgress(index + 1);
    }
    setResults(next);
    setRunning(false);
    queryClient.invalidateQueries({ queryKey: ["categories", storeId] });
    queryClient.invalidateQueries({ queryKey: ["products", storeId] });
    queryClient.invalidateQueries({ queryKey: ["products-all", storeId] });
    queryClient.invalidateQueries({ queryKey: ["products-count", storeId] });
    await purgeStore({ force: true });
    toast.success(`Import finished: ${next.created} created, ${next.skipped} already existed.`);
  };

  const downloadExtension = async () => {
    try {
      const response = await fetch("/shopbanao-meesho-collector.zip");
      if (!response.ok) throw new Error(`Download failed (${response.status})`);
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "shopbanao-meesho-collector.zip";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed.");
    }
  };

  const unavailable = storeId && storeId !== IMITATIONWORLD_ID && storeSlug?.toLowerCase() !== "imitationworld";
  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild><Link to={`/dashboard/stores/${storeSlug}/products`}><ArrowLeft className="h-5 w-5" /></Link></Button>
        <div><h1 className="text-2xl font-bold text-foreground">Meesho Import</h1><p className="text-sm text-muted-foreground">Collect products in Chrome, then review and add them to New2.</p></div>
      </div>
      {unavailable && <Alert variant="destructive"><AlertDescription>This importer is available only for Imitation World.</AlertDescription></Alert>}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">1. Install the collector</CardTitle><CardDescription>It reads pages you open yourself. No ShopBanao password is stored.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={downloadExtension} className="w-full"><Download className="mr-2 h-4 w-4" />Download Chrome extension</Button>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground"><li>Unzip the download.</li><li>Open chrome://extensions and enable Developer mode.</li><li>Choose Load unpacked and select the folder.</li><li>Open each Meesho product and collect it.</li><li>Export the saved products as JSON.</li></ol>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">2. Upload the collected file</CardTitle><CardDescription>Products with missing prices or photos stay blocked.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => readFile(event.target.files?.[0])} />
            <Button variant="outline" className="w-full" onClick={() => inputRef.current?.click()} disabled={Boolean(unavailable) || running}><Upload className="mr-2 h-4 w-4" />Choose JSON file</Button>
            {fileName && <div className="flex items-center gap-2 text-sm text-muted-foreground"><FileJson className="h-4 w-4" />{fileName}</div>}
          </CardContent>
        </Card>
      </div>
      {products.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center justify-between gap-3 text-lg"><span>Review products</span><Badge variant="secondary">{validProducts.length} ready · {products.length - validProducts.length} blocked</Badge></CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
              {products.map((product) => {
                const valid = validProducts.includes(product);
                return <div key={product.source_id} className="flex items-center gap-3 rounded-md border border-border p-3">
                  <Checkbox checked={selected.has(product.source_id)} disabled={!valid || running} onCheckedChange={(checked) => setSelected((current) => { const copy = new Set(current); checked ? copy.add(product.source_id) : copy.delete(product.source_id); return copy; })} />
                  {product.images?.[0] ? <img src={product.images[0]} alt="" className="h-16 w-14 shrink-0 rounded object-cover" /> : <div className="h-16 w-14 shrink-0 rounded bg-muted" />}
                  <div className="min-w-0 flex-1"><p className="truncate font-medium text-foreground">{product.name || "Missing product name"}</p><p className="text-sm text-muted-foreground">{product.selling_price ? `₹${product.selling_price}` : "Missing price"} · {product.images?.length || 0} photos</p><p className="truncate text-xs text-muted-foreground">{product.source_url || "Invalid Meesho link"}</p></div>
                  {valid ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" /> : <XCircle className="h-5 w-5 shrink-0 text-destructive" />}
                </div>;
              })}
            </div>
            <Button className="w-full" disabled={running || selected.size === 0} onClick={importProducts}>
              {running ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing {progress} of {selected.size}</> : <><PackagePlus className="mr-2 h-4 w-4" />Import {selected.size} products into New2</>}
            </Button>
          </CardContent>
        </Card>
      )}
      {results && <Alert><AlertDescription><strong>{results.created}</strong> created · <strong>{results.skipped}</strong> already existed · <strong>{results.failed.length}</strong> failed{results.failed.length > 0 && <ul className="mt-2 list-disc pl-5">{results.failed.map((failure) => <li key={failure}>{failure}</li>)}</ul>}</AlertDescription></Alert>}
    </div>
  );
}