import { useState, useRef } from "react";
import { useParams } from "react-router-dom";
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
import { Skeleton } from "@/components/ui/skeleton";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function MediaLibrary() {
  const { storeId } = useParams<{ storeId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: store } = useStoreData(storeId);
  const fileRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: media, isLoading } = useQuery({
    queryKey: ["media-library", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_library")
        .select("*")
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  const filteredMedia = search.trim()
    ? media?.filter((m) => m.file_name.toLowerCase().includes(search.toLowerCase()))
    : media;

  const handleUpload = async (files: FileList | null) => {
    if (!files || !storeId || !user) return;
    setUploading(true);
    let successCount = 0;
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`${file.name} exceeds 5MB limit`);
          continue;
        }
        const result = await processImage(file);
        const msg = getCompressionMessage(result);
        if (msg) toast.success(msg);
        const ext = result.file.name.split(".").pop();
        const path = `${user.id}/${storeId}/library/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("product-images")
          .upload(path, result.file, { cacheControl: "3600" });
        if (upErr) { toast.error(`Failed to upload ${file.name}`); continue; }
        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);

        const { error: dbErr } = await supabase.from("media_library").insert({
          store_id: storeId,
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_size: result.file.size,
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
      // Get URLs to delete from storage
      const toDelete = media?.filter((m) => ids.includes(m.id)) || [];
      for (const item of toDelete) {
        // Extract storage path from URL
        const url = new URL(item.file_url);
        const pathMatch = url.pathname.match(/\/object\/public\/product-images\/(.+)/);
        if (pathMatch) {
          await supabase.storage.from("product-images").remove([pathMatch[1]]);
        }
      }
      const { error } = await supabase.from("media_library").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media-library", storeId] });
      toast.success(`${selected.size} image${selected.size > 1 ? "s" : ""} deleted`);
      setSelected(new Set());
      setDeleteOpen(false);
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

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search images..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Upload zone */}
      <div
        className="flex items-center justify-center rounded-xl border-2 border-dashed border-input p-8 transition-colors hover:border-primary/50 cursor-pointer"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleUpload(e.dataTransfer.files);
        }}
      >
        <div className="text-center">
          <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Drag & drop images here or click to upload
          </p>
          <p className="text-xs text-muted-foreground">Max 5MB per image</p>
        </div>
      </div>

      {/* Grid */}
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
            <p className="text-muted-foreground">
              {search ? "No images match your search" : "No images uploaded yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {filteredMedia.map((item) => {
            const isSelected = selected.has(item.id);
            return (
              <div
                key={item.id}
                className={`group relative aspect-square overflow-hidden rounded-xl border-2 transition-all cursor-pointer ${
                  isSelected ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-border"
                }`}
              >
                <img
                  src={item.file_url}
                  alt={item.file_name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                {/* Checkbox overlay */}
                <div className={`absolute left-2 top-2 transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(item.id)}
                    className="h-5 w-5 border-2 border-white bg-black/40 data-[state=checked]:bg-primary"
                  />
                </div>
                {/* Actions overlay */}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="truncate text-[10px] text-white max-w-[70%]">{item.file_name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); copyUrl(item.id, item.file_url); }}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40"
                  >
                    {copiedId === item.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
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
            <AlertDialogDescription>
              This will permanently delete the selected images from storage. This cannot be undone.
            </AlertDialogDescription>
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
    </div>
  );
}
