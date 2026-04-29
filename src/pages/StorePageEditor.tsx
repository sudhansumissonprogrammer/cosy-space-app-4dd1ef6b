import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";
import { useStoreData } from "@/hooks/useStoreData";
import { useStorePurge } from "@/hooks/useStorePurge";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Upload, X, Plus, Trash2, Award, Code, Eye, Sparkles } from "lucide-react";
import { uploadOptimizedImage, generateUploadPath } from "@/lib/uploadOptimizedImage";
import { getDefaultContent } from "@/lib/defaultPageContent";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ICON_OPTIONS = [
  { value: "Award", label: "Award" },
  { value: "Leaf", label: "Leaf" },
  { value: "Shield", label: "Shield" },
  { value: "Star", label: "Star" },
  { value: "Sparkles", label: "Sparkles" },
  { value: "Heart", label: "Heart" },
  { value: "Truck", label: "Truck" },
  { value: "ThumbsUp", label: "ThumbsUp" },
];

interface Feature {
  icon: string;
  title: string;
  description: string;
}

export default function StorePageEditor() {
  const { pageId } = useParams();
  const { storeId, storeSlug } = useStoreSlugParam();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !pageId;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [slug, setSlug] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [features, setFeatures] = useState<Feature[]>([]);

  // Custom HTML state
  const [useCustomHtml, setUseCustomHtml] = useState(false);
  const [customHtml, setCustomHtml] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const { data: store } = useStoreData(storeId);
  const purgeStore = useStorePurge(storeId);

  const { data: page, isLoading } = useQuery({
    queryKey: ["store-page", pageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_pages")
        .select("*")
        .eq("id", pageId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!pageId,
  });

  const pageType = (page as any)?.page_type;
  const showFeatures = pageType === "about_us" || pageType === "about" || pageType === "contact";

  useEffect(() => {
    if (page) {
      setTitle((page as any).title || "");
      const existingContent = (page as any).content || "";
      if (existingContent) {
        setContent(existingContent);
      } else if ((page as any).page_type && (page as any).page_type !== "custom" && store) {
        setContent(getDefaultContent((page as any).page_type, store as any));
      }
      setSlug((page as any).slug || "");
      setIsActive((page as any).is_active ?? true);
      if ((page as any).image_url) setImagePreview((page as any).image_url);

      // Load custom HTML
      const existingHtml = (page as any).custom_html || "";
      if (existingHtml.trim()) {
        setUseCustomHtml(true);
        setCustomHtml(existingHtml);
      }
    }
  }, [page, store]);

  // Load features from store when editing about_us or contact pages
  useEffect(() => {
    if (store && showFeatures) {
      const storeFeatures = store.features as unknown as Feature[] | null;
      if (storeFeatures && Array.isArray(storeFeatures)) {
        setFeatures(storeFeatures);
      }
    }
  }, [store, showFeatures]);

  const generateSlug = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Please enter a prompt describing what you want");
      return;
    }
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-page-html", {
        body: {
          prompt: aiPrompt.trim(),
          storeName: store?.name || "",
          storeDescription: store?.description || "",
          pageType: pageType || "custom",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.html) {
        setCustomHtml(data.html);
        toast.success("HTML generated! Review and edit as needed.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate HTML");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      let imageUrl = (page as any)?.image_url || null;
      if (imageRemoved) imageUrl = null;
      if (imageFile) {
        const basePath = generateUploadPath(user!.id, storeId!);
        const result = await uploadOptimizedImage(imageFile, "store-banners", basePath);
        imageUrl = result.mainUrl;
      }

      const payload: any = {
        title: title.trim(),
        content: content.trim() || null,
        slug: slug.trim() || generateSlug(title),
        is_active: isActive,
        image_url: imageUrl,
        custom_html: useCustomHtml && customHtml.trim() ? customHtml.trim() : null,
      };

      if (isNew) {
        payload.store_id = storeId;
        payload.page_type = "custom";
        const { error } = await supabase.from("store_pages").insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("store_pages")
          .update(payload)
          .eq("id", pageId!);
        if (error) throw error;

        // Sync back to stores table for backward compatibility
        if (pageType === "about_us" || pageType === "about") {
          await supabase.from("stores").update({
            about_us_text: payload.content,
            about_us_image_url: imageUrl,
            features: features.length > 0 ? features : null,
          } as any).eq("id", storeId!);
          queryClient.invalidateQueries({ queryKey: ["store", storeId] });
        } else if (pageType === "contact") {
          await supabase.from("stores").update({
            features: features.length > 0 ? features : null,
          } as any).eq("id", storeId!);
          queryClient.invalidateQueries({ queryKey: ["store", storeId] });
        } else if (pageType === "return_policy") {
          await supabase.from("stores").update({
            return_policy: payload.content,
          } as any).eq("id", storeId!);
          queryClient.invalidateQueries({ queryKey: ["store", storeId] });
        } else if (pageType === "shipping_policy") {
          await supabase.from("stores").update({
            shipping_policy: payload.content,
          } as any).eq("id", storeId!);
          queryClient.invalidateQueries({ queryKey: ["store", storeId] });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-pages", storeId] });
      toast.success(isNew ? "Page created!" : "Page updated!");
      navigate(`/dashboard/stores/${storeSlug}/pages`);
    },
    onError: (err: any) => toast.error(err.message || "Failed to save"),
  });

  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const isSystemPage = pageType && pageType !== "custom";
  const isHtmlEligible = !pageType || pageType === "custom" || pageType === "about_us" || pageType === "about" || pageType === "contact";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/dashboard/stores/${storeSlug}/pages`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {isNew ? "New Page" : `Edit: ${(page as any)?.title || "Page"}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isNew ? "Create a new custom page" : "Modify page content"}
          </p>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Page Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="page-title">Title *</Label>
              <Input
                id="page-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (isNew) setSlug(generateSlug(e.target.value));
                }}
                maxLength={200}
                required
                disabled={isSystemPage}
              />
            </div>

            {!isSystemPage && (
              <div className="space-y-2">
                <Label htmlFor="page-slug">URL Slug</Label>
                <Input
                  id="page-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="my-custom-page"
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">Used in the page URL</p>
              </div>
            )}

            {/* Custom HTML Toggle — only for eligible page types */}
            {isHtmlEligible && (
              <div className="flex items-center justify-between rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4 text-primary" />
                  <div>
                    <Label className="text-sm font-medium">Use Custom HTML</Label>
                    <p className="text-xs text-muted-foreground">Replace default content with your own HTML code</p>
                  </div>
                </div>
                <Switch checked={useCustomHtml} onCheckedChange={setUseCustomHtml} />
              </div>
            )}

            {/* Custom HTML Editor */}
            {useCustomHtml && isHtmlEligible ? (
              <div className="space-y-4">
                {/* AI Generate */}
                <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <Label className="text-sm font-medium">AI Generate HTML</Label>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g., Create a modern about page with team section, mission statement, and image gallery"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      maxLength={500}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAiGenerate}
                      disabled={isGenerating || !aiPrompt.trim()}
                      className="shrink-0"
                    >
                      {isGenerating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
                      Generate
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Describe the layout you want and AI will generate HTML for you</p>
                </div>

                {/* Code Editor */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>HTML Code</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPreview(true)}
                      disabled={!customHtml.trim()}
                    >
                      <Eye className="mr-1 h-4 w-4" /> Preview
                    </Button>
                  </div>
                  <textarea
                    value={customHtml}
                    onChange={(e) => setCustomHtml(e.target.value)}
                    rows={16}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="<div style='text-align: center; padding: 40px;'>&#10;  <h2>Welcome to Our Store</h2>&#10;  <p>Your custom HTML goes here...</p>&#10;</div>"
                    spellCheck={false}
                  />
                  <p className="text-xs text-muted-foreground">{customHtml.length} characters • Scripts and event handlers are stripped for security</p>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="page-content">Content</Label>
                  <Textarea
                    id="page-content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={12}
                    placeholder="Write your page content here..."
                    maxLength={10000}
                  />
                  <p className="text-xs text-muted-foreground">{content.length}/10000 characters</p>
                </div>
              </>
            )}

            {/* Page Image — hide for policy pages */}
            {(!pageType || pageType === "custom" || pageType === "about_us" || pageType === "about" || pageType === "contact") && (
            <div className="space-y-2">
              <Label>Page Image (optional)</Label>
              {imagePreview ? (
                <div className="relative inline-block">
                  <img src={imagePreview} alt="Page" className="h-32 w-full max-w-md rounded-lg border object-cover" />
                  <button
                    type="button"
                    onClick={() => { setImageFile(null); setImagePreview(null); setImageRemoved(true); }}
                    className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex h-24 w-full max-w-md cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-input hover:border-primary/50">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Upload image</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) { setImageFile(f); setImagePreview(URL.createObjectURL(f)); setImageRemoved(false); }
                    }}
                  />
                </label>
              )}
            </div>
            )}

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">Show this page on your storefront</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </CardContent>
        </Card>

        {/* Why Choose Us — shown for About Us & Contact pages */}
        {showFeatures && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Award className="h-5 w-5 text-primary" /> Why Choose Us
              </CardTitle>
              <CardDescription>Selling points shown on your About Us and Contact pages</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {features.map((feature, idx) => (
                <div key={idx} className="flex gap-2 items-start rounded-lg border p-3">
                  <div className="flex-1 space-y-2">
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Select value={feature.icon} onValueChange={(v) => { const updated = [...features]; updated[idx] = { ...updated[idx], icon: v }; setFeatures(updated); }}>
                        <SelectTrigger><SelectValue placeholder="Icon" /></SelectTrigger>
                        <SelectContent>{ICON_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent>
                      </Select>
                      <Input placeholder="Title" value={feature.title} onChange={(e) => { const updated = [...features]; updated[idx] = { ...updated[idx], title: e.target.value }; setFeatures(updated); }} className="sm:col-span-2" maxLength={50} />
                    </div>
                    <Input placeholder="Description" value={feature.description} onChange={(e) => { const updated = [...features]; updated[idx] = { ...updated[idx], description: e.target.value }; setFeatures(updated); }} maxLength={100} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => setFeatures(features.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {features.length < 6 && (
                <Button type="button" variant="outline" size="sm" onClick={() => setFeatures([...features, { icon: "Award", title: "", description: "" }])}>
                  <Plus className="mr-1 h-4 w-4" /> Add Feature
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button type="submit" className="flex-1" disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isNew ? "Create Page" : "Save Changes"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to={`/dashboard/stores/${storeSlug}/pages`}>Cancel</Link>
          </Button>
        </div>
      </form>

      {/* HTML Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>HTML Preview</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto rounded-lg border bg-white">
            <iframe
              srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:16px;font-family:system-ui,-apple-system,sans-serif;color:#1a1a1a;}</style></head><body>${customHtml}</body></html>`}
              className="w-full min-h-[400px] border-0"
              title="HTML Preview"
              sandbox="allow-same-origin"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
