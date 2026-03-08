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
import { Loader2, Upload, X, ArrowLeft, Plus } from "lucide-react";
import { Link } from "react-router-dom";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface ProductFormProps {
  productId?: string;
}

export default function ProductForm({ productId }: ProductFormProps) {
  const { storeId } = useParams<{ storeId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isEditing = !!productId;

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [price, setPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [description, setDescription] = useState("");
  const [stockQuantity, setStockQuantity] = useState("0");
  const [category, setCategory] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

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

  // Load store to verify ownership
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

  // Load dynamic categories for this store
  const queryClient = useQueryClient();
  const { data: categories } = useQuery({
    queryKey: ["categories", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("store_id", storeId!)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);

  const createCategory = useMutation({
    mutationFn: async (catName: string) => {
      const slug = catName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const { data, error } = await supabase
        .from("categories")
        .insert({ store_id: storeId!, name: catName.trim(), slug })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["categories", storeId] });
      setCategory(data.name);
      setNewCategoryName("");
      setShowNewCategory(false);
      toast.success("Category created");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Load existing product for editing
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

  useEffect(() => {
    if (existingProduct) {
      setName(existingProduct.name);
      setSlug(existingProduct.slug || "");
      setPrice(String(existingProduct.price));
      setSalePrice(existingProduct.sale_price ? String(existingProduct.sale_price) : "");
      setDescription(existingProduct.description || "");
      setStockQuantity(String(existingProduct.stock_quantity));
      setCategory(existingProduct.category || "");
      setIsActive(existingProduct.is_active);
      if (existingProduct.image_url) setImagePreview(existingProduct.image_url);
    }
  }, [existingProduct]);

  const generateSlug = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const handleNameChange = (value: string) => {
    setName(value);
    if (!isEditing) setSlug(generateSlug(value));
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

  const uploadImage = async (file: File) => {
    const ext = file.name.split(".").pop();
    const path = `${user!.id}/${storeId}/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage
      .from("product-images")
      .upload(path, file, { cacheControl: "3600", upsert: true });
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
        slug: slug.trim() || null,
        price: parseFloat(price),
        sale_price: salePrice ? parseFloat(salePrice) : null,
        description: description.trim() || null,
        stock_quantity: parseInt(stockQuantity) || 0,
        category: category || null,
        is_active: isActive,
        image_url: imageUrl,
      };

      if (isEditing && productId) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", productId);
        if (error) throw error;
        toast.success("Product updated!");
      } else {
        const { error } = await supabase.from("products").insert(productData);
        if (error) {
          if (error.code === "23505") {
            toast.error("A product with this slug already exists in this store");
            return;
          }
          throw error;
        }
        toast.success("Product created!");
      }

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
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {isEditing ? "Edit Product" : "Add Product"}
          </h1>
          <p className="text-sm text-muted-foreground">{store.name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Product Details</CardTitle>
            <CardDescription>Fill in the product information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
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
              <div className="space-y-2">
                <Label htmlFor="product-slug">Slug</Label>
                <Input
                  id="product-slug"
                  placeholder="product-name"
                  value={slug}
                  onChange={(e) => setSlug(generateSlug(e.target.value))}
                  maxLength={200}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="price">Price *</Label>
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="stock">Stock Quantity</Label>
                <Input
                  id="stock"
                  type="number"
                  min="0"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch id="is-active" checked={isActive} onCheckedChange={setIsActive} />
              <Label htmlFor="is-active">Active (visible on storefront)</Label>
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Product Image</Label>
              {imagePreview ? (
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-32 w-32 rounded-lg border object-cover"
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
                <label className="flex h-32 w-32 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-input transition-colors hover:border-primary/50">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                  />
                </label>
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
