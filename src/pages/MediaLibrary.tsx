import { useEffect, useMemo, useState, useRef } from "react";
import PaginationControls from "@/components/PaginationControls";
import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStoreData } from "@/hooks/useStoreData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Upload, Trash2, Loader2, Image as ImageIcon, Search, Copy, Check, X,
} from "lucide-react";
import { processImage, getCompressionMessage } from "@/lib/imageCompression";
import { uploadOptimizedImage, generateUploadPath } from "@/lib/uploadOptimizedImage";
import { Skeleton } from "@/components/ui/skeleton";

const MAX_FILE_SIZE = 6 * 1024 * 1024;

interface MediaItem {
  id: string;
  store_id: string;
  file_url: string;
  file_name: string;
  file_size: number;
  created_at: string;
}

export default function MediaLibrary() {
  const { storeId } = useStoreSlugParam();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: store } = useStoreData(storeId);
  const fileRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: media, isLoading } = useQuery({
    queryKey: ["media-library", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("media_library")
        .select("*")
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as MediaItem[];
    },
    enabled: !!storeId,
  });

  const filteredMedia = search.trim()
    ? media?.filter((m) => m.file_name.toLowerCase().includes(search.toLowerCase()))
    : media;

  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil((filteredMedia?.length || 0) / PAGE_SIZE));
  useEffect(() => { setPage(1); }, [search]);
  useEffect(() => { if (page > totalPages) setPage(1); }, [totalPages, page]);
  const pagedMedia = useMemo(
    () => (filteredMedia || []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredMedia, page]
  );

  const handleUpload = async (files: FileList | null) => {
    if (!files || !storeId || !user) return;
    setUploading(true);
    let successCount = 0;
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`${file.name} exceeds 6MB limit`);
          continue;
        }
        const basePath = generateUploadPath(user.id, storeId) + `/library`;
        const result = await uploadOptimizedImage(file, "product-images", basePath);
        if (result.compressionMessage) toast.success(result.compressionMessage);

        const { error: dbErr } = await (supabase as any).from("media_library").insert({
          store_id: storeId,
          file_url: result.mainUrl,
          file_name: file.name,
          file_size: 0, // multi-variant, size is distributed
        });
        if (dbErr) { toast.error(`Failed to save ${file.name}`); continue; }
        successCount++;
      }
      if (successCount > 0) {
        queryClient.invalidateQueries({ queryKey: ["media-library", storeId] });
        toast.success(`${successCount} image${successCount > 1 ? "s" : ""} uploaded`);
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const toDelete = media?.filter((m) => ids.includes(m.id)) || [];
      const urls = toDelete.map((m) => m.file_url).filter(Boolean);
      // Delete from R2 (r2-delete silently skips legacy supabase URLs)
      if (urls.length > 0) {
        try {
          await supabase.functions.invoke("r2-delete", { body: { urls } });
        } catch (e) {
          console.warn("[media-library] r2-delete failed (non-fatal):", e);
        }
      }
      const { error } = await (supabase as any).from("media_library").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: ["media-library", storeId] });
      toast.success(`${ids.length} image${ids.length > 1 ? "s" : ""} deleted`);
      setSelected(new Set());
      setDeleteOpen(false);
      setSingleDeleteId(null);
    },
    onError: (err: any) => toast.error(err.message || "Delete failed"),
  });

  const copyUrl = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success("URL copied");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Media Library</h1>
          <p className="text-sm text-muted-foreground">
            Upload and manage your store images
          </p>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Delete ({selected.size})
            </Button>
          )}
          <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
            Upload
          </Button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleUpload(e.target.files)}
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search images..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div
        className="flex items-center justify-center rounded-xl border-2 border-dashed border-input p-8 transition-colors hover:border-primary/50 cursor-pointer"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleUpload(e.dataTransfer.files); }}
      >
        <div className="text-center">
          <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Drag & drop images here or click to upload</p>
          <p className="text-xs text-muted-foreground">Max 6MB per image</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      ) : !filteredMedia || filteredMedia.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <ImageIcon className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{search ? "No images match your search" : "No images uploaded yet"}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-3">
          {filteredMedia.map((item) => {
            const isSelected = selected.has(item.id);
            const isCopied = copiedId === item.id;
            return (
              <div key={item.id} className="flex flex-col gap-1">
                <div
                  className={`group relative aspect-square overflow-hidden rounded-xl border-2 transition-all cursor-pointer ${
                    isSelected ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-border"
                  }`}
                >
                  <img src={item.file_url} alt={item.file_name} className="h-full w-full object-cover" loading="lazy" />
                  {/* X delete button - always visible on mobile, hover on desktop */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setSingleDeleteId(item.id); }}
                    className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <div className={`absolute left-2 top-2 transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(item.id)}
                      className="h-5 w-5 border-2 border-white bg-black/40 data-[state=checked]:bg-primary"
                    />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 sm:p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="truncate text-[10px] text-white block">{item.file_name}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={isCopied ? "default" : "outline"}
                  className="h-7 text-xs w-full"
                  onClick={() => copyUrl(item.id, item.file_url)}
                >
                  {isCopied ? <><Check className="mr-1 h-3 w-3" /> Copied</> : <><Copy className="mr-1 h-3 w-3" /> Copy URL</>}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Bulk delete dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} image{selected.size > 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the selected images from storage.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate(Array.from(selected))}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single delete dialog */}
      <AlertDialog open={!!singleDeleteId} onOpenChange={(open) => !open && setSingleDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this image?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove it from storage.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => singleDeleteId && deleteMutation.mutate([singleDeleteId])}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
