import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Upload, X, ArrowLeft, Plus, GripVertical, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { compressImage, getCompressionMessage } from "@/lib/imageCompression";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface ProductFormProps {
  productId?: string;
}

export default function ProductForm({ productId }: ProductFormProps) {
  const { storeId } = useParams<{ storeId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = !!productId;

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [price, setPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [description, setDescription] = useState("");
  const [stockQuantity, setStockQuantity] = useState("0");
  const [trackStock, setTrackStock] = useState(false);
  const [category, setCategory] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isBestSelling, setIsBestSelling] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Additional images state
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
  const [additionalPreviews, setAdditionalPreviews] = useState<{ url: string; isExisting: boolean; id?: string }[]>([]);

  // Variants state
  interface VariantRow { id?: string; name: string; sku: string; price: string; stock: string; isActive: boolean; isExisting?: boolean }
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [expandedVariant, setExpandedVariant] = useState<number | null>(null);



  // Check product limit
  const { data: limitInfo } = useQuery({
    queryKey: ["product-limit", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("check_product_limit", {
        _user_id: user!.id,
      });
      if (error) throw error;
      return data as { plan_name: string; product_limit: number | null; current_count: number; can_create: boolean };
    },
    enabled: !!user && !isEditing,
  });

  // Load store
  const { data: store } = useQuery({
    queryKey: ["store", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("id", storeId!)
        .eq("owner_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId && !!user,
  });

  // Categories
  const { data: categories } = useQuery({
    queryKey: ["categories", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("categories")
        .select("*")
        .eq("store_id", storeId!)
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; slug: string; store_id: string }[];
    },
    enabled: !!storeId,
  });

  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [categoryImageFile, setCategoryImageFile] = useState<File | null>(null);
  const [categoryImagePreview, setCategoryImagePreview] = useState<string | null>(null);

  const handleCategoryImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) { toast.error("Image must be under 5MB"); return; }
    setCategoryImageFile(file);
    setCategoryImagePreview(URL.createObjectURL(file));
  };

  const createCategory = useMutation({
    mutationFn: async (catName: string) => {
      const slug = catName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      let image_url: string | null = null;

      if (categoryImageFile) {
        const result = await compressImage(categoryImageFile);
        const msg = getCompressionMessage(result);
        if (msg) toast.success(msg);
        const ext = result.file.name.split(".").pop();
        const path = `${storeId}/${slug}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("product-images").upload(path, result.file);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
        image_url = urlData.publicUrl;
      }

      const { data, error } = await (supabase as any)
        .from("categories")
        .insert({ store_id: storeId!, name: catName.trim(), slug, image_url })
        .select()
        .single();
      if (error) throw error;
      return data as { id: string; name: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["categories", storeId] });
      setCategory(data.name);
      setNewCategoryName("");
      setCategoryImageFile(null);
      setCategoryImagePreview(null);
      setShowNewCategory(false);
      toast.success("Category created");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteCategory = useMutation({
    mutationFn: async (catId: string) => {
      const { error } = await (supabase as any)
        .from("categories")
        .delete()
        .eq("id", catId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories", storeId] });
      toast.success("Category deleted");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Load existing product
  const { data: existingProduct } = useQuery({
    queryKey: ["product", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!productId,
  });

  // Load existing additional images
  const { data: existingImages } = useQuery({
    queryKey: ["product-images", productId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("product_images")
        .select("*")
        .eq("product_id", productId!)
        .order("display_order");
      if (error) throw error;
      return data as { id: string; image_url: string; display_order: number }[];
    },
    enabled: !!productId,
  });

  // Load existing variants
  const { data: existingVariants } = useQuery({
    queryKey: ["product-variants-edit", productId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("product_variants")
        .select("*")
        .eq("product_id", productId!)
        .order("display_order");
      if (error) throw error;
      return data as { id: string; name: string; sku: string | null; price: number | null; stock_quantity: number }[];
    },
    enabled: !!productId,
  });

  useEffect(() => {
    if (existingVariants) {
      setVariants(existingVariants.map((v: any) => ({
        id: v.id,
        name: v.name,
        sku: v.sku || "",
        price: v.price !== null ? String(v.price) : "",
        stock: String(v.stock_quantity),
        isActive: v.is_active !== false,
        isExisting: true,
      })));
    }
  }, [existingVariants]);

  useEffect(() => {
    if (existingProduct) {
      setName(existingProduct.name);
      setSlug(existingProduct.slug || "");
      setPrice(String(existingProduct.price));
      setSalePrice(existingProduct.sale_price ? String(existingProduct.sale_price) : "");
      setDescription(existingProduct.description || "");
      setStockQuantity(String(existingProduct.stock_quantity));
      setTrackStock(existingProduct.stock_quantity > 0);
      setCategory(existingProduct.category || "");
      setIsActive(existingProduct.is_active);
      setIsBestSelling((existingProduct as any).is_best_selling ?? false);
      if (existingProduct.image_url) setImagePreview(existingProduct.image_url);
    }
  }, [existingProduct]);

  useEffect(() => {
    if (existingImages) {
      setAdditionalPreviews(existingImages.map((img) => ({ url: img.image_url, isExisting: true, id: img.id })));
    }
  }, [existingImages]);

  const generateSlug = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const handleNameChange = (value: string) => {
    setName(value);
    setSlug(generateSlug(value));
  };

  const handleFileSelect = (file: File | null) => {
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error("File must be less than 5MB");
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleAdditionalFiles = (files: FileList | null) => {
    if (!files) return;
    const newFiles: File[] = [];
    const newPreviews: { url: string; isExisting: boolean }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} exceeds 5MB limit`);
        continue;
      }
      newFiles.push(file);
      newPreviews.push({ url: URL.createObjectURL(file), isExisting: false });
    }
    setAdditionalFiles((prev) => [...prev, ...newFiles]);
    setAdditionalPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeAdditionalImage = async (index: number) => {
    const preview = additionalPreviews[index];
    if (preview.isExisting && preview.id) {
      // Delete from DB
      await (supabase as any).from("product_images").delete().eq("id", preview.id);
    } else {
      // Remove from pending files
      const newFileIndex = additionalPreviews.slice(0, index).filter((p) => !p.isExisting).length;
      setAdditionalFiles((prev) => prev.filter((_, i) => i !== newFileIndex));
    }
    setAdditionalPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadImage = async (file: File) => {
    const result = await compressImage(file);
    const msg = getCompressionMessage(result);
    if (msg) toast.success(msg);
    const ext = result.file.name.split(".").pop();
    const path = `${user!.id}/${storeId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error } = await supabase.storage
      .from("product-images")
      .upload(path, result.file, { cacheControl: "3600", upsert: true });
    if (error) throw error;
    return supabase.storage.from("product-images").getPublicUrl(data.path).data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !storeId) return;
    if (!name.trim() || !price) {
      toast.error("Name and price are required");
      return;
    }
    if (!isEditing && limitInfo && !limitInfo.can_create) {
      toast.error(`You've reached the ${limitInfo.plan_name} plan limit of ${limitInfo.product_limit} products. Upgrade to add more.`);
      return;
    }

    setLoading(true);
    try {
      let imageUrl = existingProduct?.image_url || null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const productData = {
        store_id: storeId,
        name: name.trim(),
        slug: slug.trim() || generateSlug(name.trim()),
        price: parseFloat(price),
        sale_price: salePrice ? parseFloat(salePrice) : null,
        description: description.trim() || null,
        stock_quantity: trackStock ? (parseInt(stockQuantity) || 0) : 0,
        category: category || null,
        is_active: isActive,
        is_best_selling: isBestSelling,
        image_url: imageUrl,
      } as any;

      let savedProductId = productId;

      if (isEditing && productId) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", productId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("products").insert(productData).select("id").single();
        if (error) {
          if (error.code === "23505") {
            // Slug conflict — retry with random suffix
            productData.slug = generateSlug(name.trim()) + "-" + Math.random().toString(36).substring(2, 6);
            const { data: retryData, error: retryError } = await supabase.from("products").insert(productData).select("id").single();
            if (retryError) throw retryError;
            savedProductId = retryData.id;
          } else {
            throw error;
          }
        } else {
          savedProductId = data.id;
        }
      }

      // Upload additional images
      if (additionalFiles.length > 0 && savedProductId) {
        const existingCount = additionalPreviews.filter((p) => p.isExisting).length;
        for (let i = 0; i < additionalFiles.length; i++) {
          const url = await uploadImage(additionalFiles[i]);
          await (supabase as any).from("product_images").insert({
            product_id: savedProductId,
            image_url: url,
            display_order: existingCount + i,
          });
        }
      }

      // Save variants
      if (savedProductId) {
        // Delete removed existing variants
        const existingIds = existingVariants?.map((v) => v.id) || [];
        const keptIds = variants.filter((v) => v.isExisting && v.id).map((v) => v.id!);
        const removedIds = existingIds.filter((id) => !keptIds.includes(id));
        for (const id of removedIds) {
          await (supabase as any).from("product_variants").delete().eq("id", id);
        }
        // Upsert variants
        for (let i = 0; i < variants.length; i++) {
          const v = variants[i];
          const variantData = {
            product_id: savedProductId,
            name: v.name.trim(),
            sku: v.sku.trim() || null,
            price: v.price ? parseFloat(v.price) : null,
            stock_quantity: parseInt(v.stock) || 0,
            display_order: i,
            is_active: v.isActive,
          };
          if (v.isExisting && v.id) {
            await (supabase as any).from("product_variants").update(variantData).eq("id", v.id);
          } else {
            await (supabase as any).from("product_variants").insert(variantData);
          }
        }
      }

      toast.success(isEditing ? "Product updated!" : "Product created!");
      navigate(`/dashboard/stores/${storeId}/products`);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (!store) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/dashboard/stores/${storeId}/products`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-foreground">
            {isEditing ? "Edit Product" : "Add Product"}
          </h1>
          <p className="text-sm text-muted-foreground">{store.name}</p>
        </div>
        {isEditing && productId && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="mr-1.5 h-4 w-4" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Product</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this product and all its images/variants. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={async () => {
                    try {
                      await supabase.from("product_images").delete().eq("product_id", productId);
                      await supabase.from("product_variants").delete().eq("product_id", productId);
                      const { error } = await supabase.from("products").delete().eq("id", productId);
                      if (error) throw error;
                      queryClient.invalidateQueries({ queryKey: ["products", storeId] });
                      toast.success("Product deleted");
                      navigate(`/dashboard/stores/${storeId}/products`);
                    } catch (err: any) {
                      toast.error(err.message || "Failed to delete product");
                    }
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Product Details</CardTitle>
            <CardDescription>Fill in the product information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Media Section - Top */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Media</Label>
              <div className="flex flex-wrap gap-3">
                {/* Main image */}
                {imagePreview ? (
                  <div className="relative inline-block">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="h-28 w-28 rounded-lg border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                      }}
                      className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex h-28 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-input transition-colors hover:border-primary/50">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">Main</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                    />
                  </label>
                )}
                {/* Additional images */}
                {additionalPreviews.map((preview, i) => (
                  <div key={i} className="relative inline-block">
                    <img
                      src={preview.url}
                      alt={`Extra ${i + 1}`}
                      className="h-28 w-28 rounded-lg border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeAdditionalImage(i)}
                      className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {/* Add more button */}
                <label className="flex h-28 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-input transition-colors hover:border-primary/50">
                  <Plus className="h-5 w-5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Add</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleAdditionalFiles(e.target.files)}
                  />
                </label>
              </div>
              <p className="text-xs text-muted-foreground">Max 5MB per image</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-name">Name *</Label>
                <Input
                  id="product-name"
                  placeholder="Product name"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  maxLength={200}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe your product..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="price">Regular Price *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sale-price">Sale Price</Label>
                <Input
                  id="sale-price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="track-stock">Track stock quantity</Label>
                  <Switch checked={trackStock} onCheckedChange={setTrackStock} id="track-stock" />
                </div>
                {trackStock && (
                  <Input
                    id="stock"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                {showNewCategory ? (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder="New category name"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        maxLength={50}
                      />
                      <Button type="button" size="sm" onClick={() => newCategoryName.trim() && createCategory.mutate(newCategoryName.trim())} disabled={createCategory.isPending}>
                        {createCategory.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => { setShowNewCategory(false); setCategoryImageFile(null); setCategoryImagePreview(null); }}>
                        Cancel
                      </Button>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Category Photo (optional)</Label>
                      {categoryImagePreview ? (
                        <div className="relative mt-1 inline-block">
                          <img src={categoryImagePreview} alt="" className="h-16 w-16 rounded-full border object-cover" />
                          <button type="button" onClick={() => { setCategoryImageFile(null); setCategoryImagePreview(null); }} className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <label className="mt-1 flex h-16 w-16 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-input transition-colors hover:border-primary/50">
                          <Upload className="h-4 w-4 text-muted-foreground" />
                          <input type="file" accept="image/*" className="hidden" onChange={handleCategoryImage} />
                        </label>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.map((cat) => (
                          <div key={cat.id} className="flex items-center group">
                            <SelectItem value={cat.name} className="flex-1">
                              {cat.name}
                            </SelectItem>
                            <button
                              type="button"
                              className="mr-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Delete category "${cat.name}"?`)) {
                                  deleteCategory.mutate(cat.id);
                                  if (category === cat.name) setCategory("");
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" size="icon" variant="outline" onClick={() => setShowNewCategory(true)} title="New category">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <Switch id="is-active" checked={isActive} onCheckedChange={setIsActive} />
                <Label htmlFor="is-active">Active (visible on storefront)</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="is-best-selling" checked={isBestSelling} onCheckedChange={setIsBestSelling} />
                <Label htmlFor="is-best-selling">Best Selling</Label>
              </div>
            </div>

            {/* Variants */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Variants</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Add sizes, colors, or other options</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setVariants((prev) => [...prev, { name: "", sku: "", price: "", stock: "0", isActive: true }]);
                    setExpandedVariant(variants.length);
                  }}
                >
                  <Plus className="mr-1 h-3 w-3" /> Add Variant
                </Button>
              </div>

              {variants.length > 0 && (
                <div className="space-y-2">
                  {variants.map((v, i) => {
                    const isExpanded = expandedVariant === i;
                    return (
                      <div key={i} className="rounded-lg border bg-card overflow-hidden">
                        {/* Collapsed header row */}
                        <div
                          className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => setExpandedVariant(isExpanded ? null : i)}
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm font-medium truncate block ${!v.name ? 'text-muted-foreground italic' : 'text-foreground'}`}>
                              {v.name || `Variant ${i + 1}`}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {v.price ? `₹${v.price}` : 'Base price'} · Stock: {v.stock}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Switch
                              checked={v.isActive}
                              onCheckedChange={(checked) =>
                                setVariants((prev) => prev.map((vr, idx) => idx === i ? { ...vr, isActive: checked } : vr))
                              }
                              className="scale-75"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setVariants((prev) => prev.filter((_, idx) => idx !== i))}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>

                        {/* Expanded form */}
                        {isExpanded && (
                          <div className="border-t px-3 py-3 space-y-3 bg-muted/20">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Variant Name *</Label>
                              <Input
                                placeholder="e.g. Red, Large, 500ml"
                                value={v.name}
                                onChange={(e) => setVariants((prev) => prev.map((vr, idx) => idx === i ? { ...vr, name: e.target.value } : vr))}
                                maxLength={100}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs">Price Override</Label>
                                <Input
                                  type="number"
                                  placeholder="Use base price"
                                  value={v.price}
                                  onChange={(e) => setVariants((prev) => prev.map((vr, idx) => idx === i ? { ...vr, price: e.target.value } : vr))}
                                  step="0.01"
                                  min="0"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Stock</Label>
                                <Input
                                  type="number"
                                  value={v.stock}
                                  onChange={(e) => setVariants((prev) => prev.map((vr, idx) => idx === i ? { ...vr, stock: e.target.value } : vr))}
                                  min="0"
                                />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">SKU (optional)</Label>
                              <Input
                                placeholder="e.g. PROD-RED-L"
                                value={v.sku}
                                onChange={(e) => setVariants((prev) => prev.map((vr, idx) => idx === i ? { ...vr, sku: e.target.value } : vr))}
                                maxLength={50}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update Product" : "Add Product"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
