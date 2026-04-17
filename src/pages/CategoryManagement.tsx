import { useState, useCallback, useRef } from "react";
import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStoreData } from "@/hooks/useStoreData";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Upload, Loader2, FolderOpen, Image as ImageIcon, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { processImage, getCompressionMessage } from "@/lib/imageCompression";
import { uploadOptimizedImage, generateUploadPath } from "@/lib/uploadOptimizedImage";
import { Skeleton } from "@/components/ui/skeleton";
import MediaLibraryPicker from "@/components/MediaLibraryPicker";
import CategoryProductsDialog from "@/components/CategoryProductsDialog";

const MAX_FILE_SIZE = 6 * 1024 * 1024;

export default function CategoryManagement() {
  const { storeId } = useStoreSlugParam();
  const queryClient = useQueryClient();
  const { data: store } = useStoreData(storeId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [productsDialogCat, setProductsDialogCat] = useState<string | null>(null);

  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("store_id", storeId!)
        .order("display_order")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  const [reordering, setReordering] = useState(false);

  const moveCategory = useCallback(async (index: number, direction: "up" | "down") => {
    if (!categories || reordering) return;
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= categories.length) return;
    setReordering(true);
    try {
      const a = categories[index];
      const b = categories[newIndex];
      await Promise.all([
        supabase.from("categories").update({ display_order: newIndex } as any).eq("id", a.id),
        supabase.from("categories").update({ display_order: index } as any).eq("id", b.id),
      ]);
      queryClient.invalidateQueries({ queryKey: ["categories", storeId] });
    } catch {
      toast.error("Failed to reorder");
    } finally {
      setReordering(false);
    }
  }, [categories, reordering, storeId, queryClient]);

  const openCreate = () => {
    setEditingId(null);
    setName("");
    setImageFile(null);
    setImagePreview(null);
    setDialogOpen(true);
  };

  const openEdit = (cat: any) => {
    setEditingId(cat.id);
    setName(cat.name);
    setImageFile(null);
    setImagePreview(cat.image_url || null);
    setDialogOpen(true);
  };

  /** Center-crop an image to a 1:1 square via canvas */
  const cropToSquare = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Canvas export failed"));
            resolve(new File([blob], file.name.replace(/\.\w+$/, ".webp"), { type: "image/webp" }));
          },
          "image/webp",
          0.85
        );
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) { toast.error("Image must be under 6MB"); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Category name is required"); return; }
    setSaving(true);
    try {
      const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      let image_url: string | null = imagePreview;

      if (imageFile) {
        // Crop to square first so it looks perfect in circles
        const squareFile = await cropToSquare(imageFile);
        const basePath = generateUploadPath(storeId!, "categories");
        const result = await uploadOptimizedImage(squareFile, "product-images", basePath);
        if (result.compressionMessage) toast.success(result.compressionMessage);
        image_url = result.mainUrl;
      }

      if (editingId) {
        const { error } = await supabase
          .from("categories")
          .update({ name: name.trim(), slug, image_url })
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Category updated");
      } else {
        const { error } = await supabase
          .from("categories")
          .insert({ store_id: storeId!, name: name.trim(), slug, image_url });
        if (error) throw error;
        toast.success("Category created");
      }

      queryClient.invalidateQueries({ queryKey: ["categories", storeId] });
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (catId: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", catId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories", storeId] });
      toast.success("Category deleted");
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Categories</h1>
          <p className="text-sm text-muted-foreground">Manage your store categories</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> Add Category
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : !categories || categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <FolderOpen className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">No categories yet</p>
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" /> Create First Category
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((cat, idx) => (
            <Card key={cat.id} className="group overflow-hidden cursor-pointer" onClick={() => setProductsDialogCat(cat.name)}>
              <div className="relative aspect-square bg-muted">
                {cat.image_url ? (
                  <img src={cat.image_url} alt={cat.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex w-full justify-between gap-1 p-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8"
                        disabled={idx === 0 || reordering}
                        onClick={() => moveCategory(idx, "up")}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8"
                        disabled={idx === categories.length - 1 || reordering}
                        onClick={() => moveCategory(idx, "down")}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => openEdit(cat)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="destructive" className="h-8 w-8">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete "{cat.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove the category. Products in this category won't be deleted.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => deleteMutation.mutate(cat.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              </div>
              <CardContent className="p-3">
                <p className="truncate text-sm font-medium text-foreground">{cat.name}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Category" : "New Category"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Update category details" : "Add a new category to your store"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Category Name *</Label>
              <Input
                placeholder="e.g. Summer Collection"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>Category Image</Label>
              <div className="flex items-center gap-3">
                {imagePreview ? (
                  <div className="relative">
                    <img src={imagePreview} alt="" className="h-24 w-24 rounded-lg border object-cover" />
                    <button
                      type="button"
                      onClick={() => { setImageFile(null); setImagePreview(null); }}
                      className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                    >
                      <span className="sr-only">Remove</span>×
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-input hover:border-primary/50">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">Upload</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImage} />
                    </label>
                    <button
                      type="button"
                      onClick={() => setLibraryOpen(true)}
                      className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-input hover:border-primary/50"
                    >
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">Library</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {storeId && (
        <MediaLibraryPicker
          storeId={storeId}
          open={libraryOpen}
          onClose={() => setLibraryOpen(false)}
          onSelect={(urls) => {
            if (urls[0]) {
              setImageFile(null);
              setImagePreview(urls[0]);
            }
          }}
        />
      )}

      {storeId && productsDialogCat && (
        <CategoryProductsDialog
          open={!!productsDialogCat}
          onClose={() => setProductsDialogCat(null)}
          categoryName={productsDialogCat}
          storeId={storeId}
        />
      )}
    </div>
  );
}
