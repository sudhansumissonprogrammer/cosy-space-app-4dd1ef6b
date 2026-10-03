import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useStoreData } from "@/hooks/useStoreData";
import { useStorePurge } from "@/hooks/useStorePurge";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Upload, X, ArrowLeft, Plus, GripVertical, Trash2, Image as ImageIcon, Sparkles, Video as VideoIcon, Play, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import MediaLibraryPicker from "@/components/MediaLibraryPicker";
import { useProductSourceLink } from "@/hooks/useSourceLinks";
import { sourceLabel } from "@/lib/sourcePdpUrl";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { processImage, getCompressionMessage } from "@/lib/imageCompression";
import { uploadOptimizedImage, generateUploadPath } from "@/lib/uploadOptimizedImage";
import { uploadCompressedVideo } from "@/lib/uploadCompressedVideo";
import { copyExternalImageInBackground, isExternalImageUrl } from "@/lib/externalImageCopy";

import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 6 * 1024 * 1024; // 6MB
const MAX_PRODUCT_IMAGES = 5;

/** Supplier controls are available only to stores that use source links. */
const SUPPLIER_STORE_IDS = new Set([
  "ab19143d-87a9-490e-90b7-837313522782", // utkalwatch
  "d07b0784-4103-494e-b243-8fcbdf5fd473", // hopknock
  "2a9f377a-d8c4-4c7b-8abf-418e9b75cc56", // carrybazaar1
  "c3c5dff2-173a-4f4d-90e4-8b1c88c305d9", // imitationworld
]);
const SUPPLIER_STORE_SLUGS = new Set(["utkalwatch", "hopknock", "carrybazaar1", "imitationworld"]);

const cleanSupplierLink = (value: string) => {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    if (url.hostname === "meesho.com" || url.hostname === "www.meesho.com") {
      url.search = "";
      url.hash = "";
      return url.toString();
    }
  } catch { /* Relative source paths are valid for existing suppliers. */ }
  return trimmed;
};

interface ProductFormProps {
  productId?: string;
  /** When provided, form is in "sheet mode" — no header/back, calls onClose instead of navigate */
  onClose?: () => void;
}

export default function ProductForm({ productId, onClose }: ProductFormProps) {
  const { storeId, storeSlug, store: paramStore } = useStoreSlugParam();
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
  /** Additional categories (ids) this product should also appear in. */
  const [extraCategoryIds, setExtraCategoryIds] = useState<string[]>([]);

  const [isActive, setIsActive] = useState(true);

  const [isBestSelling, setIsBestSelling] = useState(false);
  const [isCategoryPinned, setIsCategoryPinned] = useState(false);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Additional images state
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
  const [additionalPreviews, setAdditionalPreviews] = useState<{ url: string; isExisting: boolean; id?: string }[]>([]);

  // Variants state
  interface VariantRow { id?: string; name: string; isActive: boolean; isExisting?: boolean }
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [expandedVariant, setExpandedVariant] = useState<number | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);

  // Product video state
  const [sourcePlatformInput, setSourcePlatformInput] = useState("");
  const [sourceIdInput, setSourceIdInput] = useState("");
  const [sourcePathInput, setSourcePathInput] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const [videoPosterUrl, setVideoPosterUrl] = useState<string | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoStage, setVideoStage] = useState<string>("");

  const handleGenerateDescription = async () => {
    if (!name.trim()) {
      toast.error("Enter a product name first");
      return;
    }
    setGeneratingDesc(true);
    try {
      const res = await supabase.functions.invoke("generate-description", {
        body: { product_name: name.trim() },
      });
      if (res.error) throw res.error;
      const desc = res.data?.description;
      if (!desc) throw new Error("Empty response");
      setDescription(desc);
      toast.success("Description generated!");
    } catch {
      toast.error("Failed to generate description. Try again.");
    } finally {
      setGeneratingDesc(false);
    }
  };


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

  // Load store (fall back to slug-resolved store to avoid an infinite spinner
  // when useStoreData hasn't hydrated yet, e.g. admin-view or direct deep-link)
  const { data: storeFull } = useStoreData(storeId);
  const store = storeFull || paramStore;
  const canManageSupplier = Boolean(
    (storeId && SUPPLIER_STORE_IDS.has(storeId))
      || (storeSlug && SUPPLIER_STORE_SLUGS.has(storeSlug.toLowerCase())),
  );
  const purgeStore = useStorePurge(storeId);

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
    if (file.size > MAX_FILE_SIZE) { toast.error("Image must be under 6MB"); return; }
    setCategoryImageFile(file);
    setCategoryImagePreview(URL.createObjectURL(file));
  };

  const createCategory = useMutation({
    mutationFn: async (catName: string) => {
      const slug = catName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      let image_url: string | null = null;

      if (categoryImageFile) {
        if (!user) throw new Error("You must be signed in to upload images");
        const basePath = generateUploadPath(user.id, storeId!) + "-cat";
        const uploadResult = await uploadOptimizedImage(categoryImageFile, "product-images", basePath);
        if (uploadResult.compressionMessage) toast.success(uploadResult.compressionMessage);
        image_url = uploadResult.mainUrl;
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

  // Supplier (source store) PDP link for synced products
  const { url: sourceUrl, platform: sourcePlatform } = useProductSourceLink(
    canManageSupplier ? storeId : undefined,
    canManageSupplier ? existingProduct as any : undefined,
  );


  // ── Multi-category: extra categories this product also appears in ──
  const { data: existingProductCategories } = useQuery({
    queryKey: ["product-categories", productId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("product_categories")
        .select("category_id")
        .eq("product_id", productId!);
      if (error) throw error;
      return (data || []).map((r: any) => r.category_id as string);
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
      setTrackStock(existingProduct.stock_quantity > 0 && existingProduct.stock_quantity < 999999);
      setCategory(existingProduct.category || "");
      setIsActive(existingProduct.is_active);
      setIsBestSelling((existingProduct as any).is_best_selling ?? false);
      setIsCategoryPinned((existingProduct as any).is_category_pinned ?? false);
      if (existingProduct.image_url) setImagePreview(existingProduct.image_url);
      const ep = existingProduct as any;
      if (ep.video_url) setVideoUrl(ep.video_url);
      if (ep.video_poster_url) setVideoPosterUrl(ep.video_poster_url);
      setSourcePlatformInput(ep.source_platform || "");
      setSourceIdInput(ep.source_id || "");
      setSourcePathInput(ep.source_path || "");
    }
  }, [existingProduct]);


  // Seed extra categories once links + category list are loaded (skip primary).
  useEffect(() => {
    if (!existingProductCategories || !categories) return;
    const primaryId = categories.find(
      (c: any) => c.name?.toLowerCase() === (existingProduct as any)?.category?.toLowerCase(),
    )?.id;
    setExtraCategoryIds(existingProductCategories.filter((id: string) => id !== primaryId));
  }, [existingProductCategories, categories, existingProduct]);


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
        toast.error("File must be less than 6MB");
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleAdditionalFiles = (files: FileList | null) => {
    if (!files) return;
    const totalExisting = additionalPreviews.filter(p => p.isExisting).length;
    const totalNew = additionalFiles.length;
    const remaining = MAX_PRODUCT_IMAGES - totalExisting - totalNew - (imagePreview ? 1 : 0);
    
    const fileArr = Array.from(files);
    if (fileArr.length > remaining) {
      toast.error(`Maximum ${MAX_PRODUCT_IMAGES} images per product. You can add ${Math.max(0, remaining)} more.`);
    }
    
    const newFiles: File[] = [];
    const newPreviews: { url: string; isExisting: boolean }[] = [];
    for (const file of fileArr.slice(0, Math.max(0, remaining))) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} exceeds 6MB limit`);
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
    const basePath = generateUploadPath(user!.id, storeId!);
    const result = await uploadOptimizedImage(file, "product-images", basePath, {
      productPhotoVariants: true,
    });
    if (result.compressionMessage) toast.success(result.compressionMessage);
    return result.mainUrl;
  };

  const handleVideoSelect = async (file: File | null) => {
    if (!file || !user || !storeId) return;
    setVideoUploading(true);
    setVideoProgress(0);
    setVideoStage("Preparing…");
    try {
      const result = await uploadCompressedVideo(file, {
        userId: user.id,
        storeId,
        onProgress: (p) => setVideoProgress(Math.round(p * 100)),
        onStage: (s) => {
          setVideoStage(
            s === "loading-ffmpeg" ? "Loading compressor…" :
            s === "compressing" ? "Compressing video…" :
            s === "uploading-video" ? "Uploading video…" :
            "Uploading thumbnail…"
          );
        },
      });
      setVideoUrl(result.videoUrl);
      setVideoPosterUrl(result.posterUrl);
      const savedKB = Math.max(0, Math.round((result.originalBytes - result.compressedBytes) / 1024));
      toast.success(`Video ready — saved ${savedKB > 1024 ? (savedKB / 1024).toFixed(1) + "MB" : savedKB + "KB"}`);
    } catch (err: any) {
      toast.error(err?.message || "Video upload failed");
    } finally {
      setVideoUploading(false);
      setVideoStage("");
      setVideoProgress(0);
    }
  };

  const removeVideo = () => {
    setVideoUrl(null);
    setVideoPosterUrl(null);
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
      let imageUrl: string | null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      } else if (imagePreview) {
        // Keep current preview (existing URL or new URL-based image)
        imageUrl = imagePreview;
      } else {
        // User explicitly removed the image
        imageUrl = null;
      }

      const productData = {
        store_id: storeId,
        name: name.trim(),
        slug: slug.trim() || generateSlug(name.trim()),
        price: parseFloat(price),
        sale_price: salePrice ? parseFloat(salePrice) : null,
        currency: store?.currency || 'INR',
        description: description.trim() || null,
        stock_quantity: trackStock ? (parseInt(stockQuantity) || 0) : 999999,
        category: category || null,
        is_active: isActive,
        is_best_selling: isBestSelling,
        is_category_pinned: isCategoryPinned,
        category_pinned_at: isCategoryPinned
          ? ((existingProduct as any)?.category_pinned_at ?? new Date().toISOString())
          : null,
        image_url: imageUrl,
        video_url: videoUrl,
        video_poster_url: videoPosterUrl,
        source_platform: sourcePlatformInput.trim() || null,
        source_id: sourceIdInput.trim() || null,
        source_path: canManageSupplier ? cleanSupplierLink(sourcePathInput) || null : (existingProduct as any)?.source_path ?? null,
      } as any;

      let savedProductId = productId;

      if (isEditing && productId) {
        // Don't send store_id on update
        const { store_id, ...updateData } = productData;
        const { error } = await supabase
          .from("products")
          .update(updateData)
          .eq("id", productId)
          .eq("store_id", storeId!);
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

      // ── Sync multi-category links ──
      // The primary category link is maintained by a DB trigger; here we only
      // reconcile the EXTRA categories the merchant ticked.
      if (savedProductId && storeId) {
        const primaryId = categories?.find(
          (c: any) => c.name?.toLowerCase() === (category || "").toLowerCase(),
        )?.id;
        const wanted = extraCategoryIds.filter((id) => id !== primaryId);
        const { data: currentLinks } = await (supabase as any)
          .from("product_categories")
          .select("category_id,is_primary")
          .eq("product_id", savedProductId);
        const current = (currentLinks || []) as { category_id: string; is_primary: boolean }[];

        // Remove any link that is neither the current primary nor a ticked
        // extra — including stale rows that used to be the primary category.
        const toRemove = current
          .filter((l) => l.category_id !== primaryId && !wanted.includes(l.category_id))
          .map((l) => l.category_id);
        if (toRemove.length > 0) {
          await (supabase as any)
            .from("product_categories")
            .delete()
            .eq("product_id", savedProductId)
            .in("category_id", toRemove);
        }

        const existingIdsSet = new Set(current.map((l) => l.category_id));
        const toAdd = wanted.filter((id) => !existingIdsSet.has(id));
        if (toAdd.length > 0) {
          const { error: linkErr } = await (supabase as any).from("product_categories").insert(
            toAdd.map((id) => ({
              product_id: savedProductId,
              category_id: id,
              store_id: storeId,
              is_primary: false,
            })),
          );
          if (linkErr) console.error("[ProductForm] category links:", linkErr.message);
        }
        queryClient.invalidateQueries({ queryKey: ["product-categories", savedProductId] });
      }

      // Upload additional images (files + URL-based)

      if (savedProductId) {
        const existingCount = additionalPreviews.filter((p) => p.isExisting).length;
        // Handle file uploads
        // Upload extra photos 3 at a time; display order is fixed by the
        // original index so parallel finishing order never reshuffles photos.
        const uploadedUrls: string[] = new Array(additionalFiles.length);
        let next = 0;
        const worker = async () => {
          while (next < additionalFiles.length) {
            const i = next++;
            uploadedUrls[i] = await uploadImage(additionalFiles[i]);
          }
        };
        await Promise.all(Array.from({ length: Math.min(3, additionalFiles.length) }, worker));
        let orderIdx = existingCount;
        const urlOnlyPreviews = additionalPreviews.filter((p) => !p.isExisting && !p.url.startsWith("blob:"));
        const rows = [
          ...uploadedUrls.map((url) => ({ product_id: savedProductId, image_url: url, display_order: orderIdx++ })),
          ...urlOnlyPreviews.map((p) => ({ product_id: savedProductId, image_url: p.url, display_order: orderIdx++ })),
        ];
        if (rows.length > 0) {
          const { error: imgErr } = await (supabase as any).from("product_images").insert(rows);
          if (imgErr) throw imgErr;
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
            sku: null,
            price: null,
            // Variant inventory is not edited separately in this form, so it
            // must follow the product's stock setting. Saving 0 here made every
            // newly added variant fail checkout as "Out of stock".
            stock_quantity: productData.stock_quantity,
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

      // Background-copy external images to our storage
      if (savedProductId && storeId) {
        const mainImg = imagePreview;
        if (isExternalImageUrl(mainImg)) {
          copyExternalImageInBackground(mainImg!, storeId, savedProductId);
        }
        // Also copy external additional image URLs
        for (const preview of additionalPreviews) {
          if (!preview.isExisting && isExternalImageUrl(preview.url)) {
            copyExternalImageInBackground(preview.url, storeId, savedProductId);
          }
        }
      }

      // ── Sync product images to Media Library ──
      // Ensures all product images appear in the media library for easy URL copying
      if (savedProductId && storeId) {
        const allImageUrls: string[] = [];
        if (imageUrl) allImageUrls.push(imageUrl);
        for (const preview of additionalPreviews) {
          if (preview.url && !preview.url.startsWith("blob:")) allImageUrls.push(preview.url);
        }
        // Also include freshly uploaded additional files
        // (their URLs were already inserted into product_images above)

        if (allImageUrls.length > 0) {
          // Fetch existing media URLs to avoid duplicates
          const { data: existingMedia } = await (supabase as any)
            .from("media_library")
            .select("file_url")
            .eq("store_id", storeId)
            .in("file_url", allImageUrls);

          const existingUrls = new Set((existingMedia || []).map((m: any) => m.file_url));
          const newUrls = allImageUrls.filter((u) => !existingUrls.has(u));

          if (newUrls.length > 0) {
            const inserts = newUrls.map((url) => ({
              store_id: storeId,
              file_url: url,
              file_name: name.trim() || "product-image",
              file_size: 0,
            }));
            await (supabase as any).from("media_library").insert(inserts);
          }
        }
      }

      toast.success(isEditing ? "Product updated!" : "Product created!");

      // Invalidate all relevant queries so lists/details refresh instantly
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["product", productId] }),
        queryClient.invalidateQueries({ queryKey: ["product-images", productId] }),
        queryClient.invalidateQueries({ queryKey: ["product-variants-edit", productId] }),
        queryClient.invalidateQueries({ queryKey: ["product-limit"] }),
        queryClient.invalidateQueries({ queryKey: ["storefront-products"] }),
        queryClient.invalidateQueries({ queryKey: ["best-selling-products"] }),
      ]);
      
      // Purge before pre-warming. Running these concurrently can let prewarm
      // re-cache the old gallery before the version bump reaches the Worker.
      await purgeStore({ force: true });

      // Pre-warm edge caches so storefront reflects changes instantly.
      // Pass the product slug so /api/pdp?slug=... is warmed too — first
      // WhatsApp click after save lands on a hot KV cache (no DB hit).
      const productSlugForWarm = (slug?.trim() || generateSlug(name.trim())) || undefined;
      import("@/lib/prewarmStore").then(({ prewarmStore }) => {
        if (storeSlug) prewarmStore(storeSlug, undefined, { hidden: !isActive, productSlug: productSlugForWarm });
      }).catch(() => {});

      if (onClose) {
        onClose();
      } else {
        navigate(`/dashboard/stores/${storeSlug}/products`);
      }
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
    <div className={cn("mx-auto max-w-2xl space-y-6", onClose && "space-y-4")}>
      {!onClose && (
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/dashboard/stores/${storeSlug}/products`}>
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
                        // FK ON DELETE CASCADE handles product_images & product_variants atomically
                        const { error } = await supabase.from("products").delete().eq("id", productId).eq("store_id", storeId!);
                        if (error) throw error;
                        queryClient.invalidateQueries({ queryKey: ["products", storeId] });
                        toast.success("Product deleted");
                        purgeStore();
                        if (onClose) { onClose(); } else { navigate(`/dashboard/stores/${storeSlug}/products`); }
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
      )}

      {isEditing && canManageSupplier && sourceUrl && (
        <div className="space-y-2">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 transition-colors hover:bg-primary/10"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Open on {sourceLabel(sourcePlatform)}</p>
              <p className="truncate text-xs text-muted-foreground">{sourceUrl}</p>
            </div>
            <ExternalLink className="h-4 w-4 shrink-0 text-primary" />
          </a>
          {(existingProduct as any)?.supplier_out_of_stock && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              This item is out of stock at the supplier. Your store stock is left unchanged — verify before dispatch.
            </p>
          )}
        </div>
      )}

      {isEditing && canManageSupplier && (
        <Card className={cn("mb-4", onClose && "border-0 shadow-none")}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Supplier</CardTitle>
            <CardDescription>
              Where this product is sourced from. Used for the supplier link and stock sync.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="source-platform">Supplier</Label>
              <Input
                id="source-platform"
                value={sourcePlatformInput}
                onChange={(e) => setSourcePlatformInput(e.target.value)}
                placeholder="jdwebship / cartpe"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="source-id">Supplier SKU / ID</Label>
              <Input
                id="source-id"
                value={sourceIdInput}
                onChange={(e) => setSourceIdInput(e.target.value)}
                placeholder="SKU1768899006980586"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="source-path">Supplier product URL / path</Label>
              <Input
                id="source-path"
                value={sourcePathInput}
                onChange={(e) => setSourcePathInput(e.target.value)}
                placeholder="https://supplier.com/product-page"
              />
            </div>
          </CardContent>
        </Card>
      )}




      <form onSubmit={handleSubmit}>
        <Card className={cn(onClose && "border-0 shadow-none")}>

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
                {/* Choose from Library */}
                <button
                  type="button"
                  onClick={() => setLibraryOpen(true)}
                  className="flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-input transition-colors hover:border-primary/50"
                >
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Library</span>
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Max 6MB per image</p>

              {/* Product video (optional) — appears as slide #2 on PDP */}
              <div className="space-y-2 pt-2 border-t border-border/50 mt-3">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <VideoIcon className="h-4 w-4" /> Product Video (optional)
                  </Label>
                  <span className="text-[10px] text-muted-foreground">Max 60s · Auto-compressed</span>
                </div>
                {videoUrl && !videoUploading ? (
                  <div className="flex flex-wrap gap-3 items-start">
                    <div className="relative inline-block">
                      {videoPosterUrl ? (
                        <img
                          src={videoPosterUrl}
                          alt="Video thumbnail"
                          className="h-28 w-28 rounded-lg border object-cover"
                        />
                      ) : (
                        <div className="h-28 w-28 rounded-lg border bg-muted flex items-center justify-center">
                          <VideoIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30 pointer-events-none">
                        <Play className="h-7 w-7 text-white drop-shadow" fill="currentColor" />
                      </div>
                      <button
                        type="button"
                        onClick={removeVideo}
                        className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                        aria-label="Remove video"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="text-xs text-muted-foreground self-center">
                      Video uploaded. Shows as slide 2 on the product page.
                    </div>
                  </div>
                ) : videoUploading ? (
                  <div className="rounded-lg border border-dashed p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{videoStage || "Processing…"}</span>
                      <span className="ml-auto tabular-nums text-muted-foreground">{videoProgress}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.max(2, videoProgress)}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Compression runs in your browser — keep this tab open.
                    </p>
                  </div>
                ) : (
                  <label className="flex h-28 w-full max-w-sm cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-input transition-colors hover:border-primary/50">
                    <VideoIcon className="h-5 w-5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Click to upload video</span>
                    <span className="text-[10px] text-muted-foreground/70">MP4 / MOV / WebM · up to 60s · max 100MB</span>
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => handleVideoSelect(e.target.files?.[0] || null)}
                    />
                  </label>
                )}
              </div>


              {/* Media Library Picker */}
              <MediaLibraryPicker
                storeId={storeId!}
                open={libraryOpen}
                onClose={() => setLibraryOpen(false)}
                multiple
                onSelect={(urls) => {
                  for (const url of urls) {
                    if (!imagePreview) {
                      setImagePreview(url);
                      setImageFile(null);
                    } else {
                      setAdditionalPreviews((prev) => [...prev, { url, isExisting: false }]);
                    }
                  }
                  if (urls.length > 0) toast.success(`${urls.length} image${urls.length > 1 ? "s" : ""} added from library`);
                }}
              />

              {/* Image URL input */}
              <div className="flex items-end gap-2 pt-1">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="image-url-input" className="text-xs text-muted-foreground">Or add image via URL</Label>
                  <Input
                    id="image-url-input"
                    placeholder="https://example.com/image.jpg"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const input = e.currentTarget;
                        const url = input.value.trim();
                        if (!url) return;
                        if (!/^https?:\/\/.+/i.test(url)) { toast.error("Please enter a valid URL"); return; }
                        if (!imagePreview) {
                          setImagePreview(url);
                          setImageFile(null);
                        } else {
                          setAdditionalPreviews((prev) => [...prev, { url, isExisting: false }]);
                        }
                        input.value = "";
                        toast.success("Image added from URL");
                      }
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const input = document.getElementById("image-url-input") as HTMLInputElement;
                    const url = input?.value?.trim();
                    if (!url) return;
                    if (!/^https?:\/\/.+/i.test(url)) { toast.error("Please enter a valid URL"); return; }
                    if (!imagePreview) {
                      setImagePreview(url);
                      setImageFile(null);
                    } else {
                      setAdditionalPreviews((prev) => [...prev, { url, isExisting: false }]);
                    }
                    input.value = "";
                    toast.success("Image added from URL");
                  }}
                >
                  Add URL
                </Button>
              </div>
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
              <div className="flex items-center justify-between">
                <Label htmlFor="description">Description</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 gap-1.5 text-xs text-primary hover:text-primary/80"
                  disabled={generatingDesc || !name.trim()}
                  onClick={handleGenerateDescription}
                >
                  {generatingDesc ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {generatingDesc ? "Generating…" : "AI Generate"}
                </Button>
              </div>
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
                          <SelectItem key={cat.id} value={cat.name} className="group pr-9 relative">
                            <span>{cat.name}</span>
                            <button
                              type="button"
                              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                              onPointerDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (confirm(`Delete category "${cat.name}"?`)) {
                                  deleteCategory.mutate(cat.id);
                                  if (category === cat.name) setCategory("");
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </SelectItem>
                        ))}
                      </SelectContent>

                    </Select>
                    <Button type="button" size="icon" variant="outline" onClick={() => setShowNewCategory(true)} title="New category">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">Main category — used for pinning &amp; breadcrumbs.</p>

                {/* Multi-category: additional categories */}
                {(categories?.length ?? 0) > 0 && (
                  <div className="space-y-2 pt-1">
                    <Label className="text-xs">Also show in (optional)</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {categories!
                        .filter((c: any) => c.name?.toLowerCase() !== (category || "").toLowerCase())
                        .map((c: any) => {
                          const active = extraCategoryIds.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() =>
                                setExtraCategoryIds((prev) =>
                                  prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id],
                                )
                              }
                              className={cn(
                                "rounded-full border px-3 py-1 text-xs transition-colors",
                                active
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-input bg-background hover:bg-accent",
                              )}
                            >
                              {c.name}
                            </button>
                          );
                        })}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      This product will also appear on the selected category pages.
                    </p>
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
              <div className="flex items-center gap-3">
                <Switch
                  id="is-category-pinned"
                  checked={isCategoryPinned}
                  onCheckedChange={setIsCategoryPinned}
                  disabled={!category}
                />
                <Label htmlFor="is-category-pinned" className={!category ? "opacity-60" : ""}>
                  Pin to top of category
                  {!category && <span className="ml-1 text-xs text-muted-foreground">(set a category first)</span>}
                </Label>
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
                    setVariants((prev) => [...prev, { name: "", isActive: true }]);
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
                              {v.isActive ? 'Active' : 'Inactive'}
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
                              className="h-9 w-9"
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
                                placeholder="e.g. S, M, L, XL, Red, Blue"
                                value={v.name}
                                onChange={(e) => setVariants((prev) => prev.map((vr, idx) => idx === i ? { ...vr, name: e.target.value } : vr))}
                                maxLength={100}
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
