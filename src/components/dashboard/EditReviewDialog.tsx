import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Star, X, Loader2, Plus, Play, History } from "lucide-react";
import { toast } from "sonner";
import { uploadReviewMedia, type ReviewMedia } from "@/lib/uploadReviewMedia";

interface ReviewRow {
  id: string;
  product_id?: string | null;
  customer_name: string;
  rating: number;
  title: string | null;
  review_text: string | null;
  is_verified?: boolean;
  created_at?: string;
  media: any;
}

interface Props {
  storeId: string;
  /** null / undefined => create mode */
  review?: ReviewRow | null;
  onClose: () => void;
  onSaved: () => void;
}

function toLocalInput(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function EditReviewDialog({ storeId, review, onClose, onSaved }: Props) {
  const isCreate = !review;
  const [name, setName] = useState(review?.customer_name || "");
  const [rating, setRating] = useState(review?.rating || 5);
  const [title, setTitle] = useState(review?.title || "");
  const [text, setText] = useState(review?.review_text || "");
  const [productId, setProductId] = useState(review?.product_id || "");
  const [verified, setVerified] = useState(review?.is_verified ?? true);
  const [date, setDate] = useState(toLocalInput(review?.created_at));
  const [productSearch, setProductSearch] = useState("");
  const [media, setMedia] = useState<ReviewMedia[]>(
    Array.isArray(review?.media)
      ? review!.media.filter((m: any) => m?.url).map((m: any) => ({ url: m.url, type: m.type === "video" ? "video" : "image" }))
      : []
  );
  const [uploading, setUploading] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [recentMedia, setRecentMedia] = useState<(ReviewMedia & { lastModified?: string })[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!review) return;
    setName(review.customer_name || "");
    setRating(review.rating || 5);
    setTitle(review.title || "");
    setText(review.review_text || "");
    setProductId(review.product_id || "");
    setVerified(review.is_verified ?? true);
    setDate(toLocalInput(review.created_at));
  }, [review?.id]);

  // Product list (create mode only) — light payload, cached.
  const { data: products = [] } = useQuery({
    queryKey: ["dashboard-review-products", storeId],
    enabled: isCreate && !!storeId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
  });

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    const list = q ? products.filter((p) => p.name?.toLowerCase().includes(q)) : products;
    return list.slice(0, 50);
  }, [products, productSearch]);

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    try {
      for (const f of files) {
        const up = await uploadReviewMedia(f, storeId);
        setMedia((m) => [...m, up]);
      }
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function removeAt(i: number) {
    setMedia((m) => m.filter((_, idx) => idx !== i));
  }

  async function loadRecentUploads() {
    setShowRecent(true);
    if (recentMedia.length) return;
    setLoadingRecent(true);
    try {
      const { data, error } = await supabase.functions.invoke("review-upload", {
        method: "GET",
        headers: { "x-store-id": storeId },
      });
      if (error) throw error;
      setRecentMedia(Array.isArray(data?.files) ? data.files : []);
    } catch (err: any) {
      toast.error(err?.message || "Could not load recent uploads");
      setShowRecent(false);
    } finally {
      setLoadingRecent(false);
    }
  }

  function restoreUpload(item: ReviewMedia) {
    setMedia((current) => current.some((entry) => entry.url === item.url) ? current : [...current, item]);
    toast.success("Upload restored to this review");
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Customer name is required");
      return;
    }
    if (isCreate && !productId) {
      toast.error("Pick the product this review is for");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        customer_name: name.trim().slice(0, 80),
        rating: Math.max(1, Math.min(5, Math.round(rating))),
        title: title.trim().slice(0, 120) || null,
        review_text: text.trim().slice(0, 2000) || null,
        media: media as any,
      };

      if (isCreate) {
        // Keep the picked date but a realistic time-of-day
        const created = new Date(`${date}T10:00:00`);
        const { error } = await supabase.from("product_reviews").insert({
          ...payload,
          store_id: storeId,
          product_id: productId,
          is_verified: verified,
          is_hidden: false,
          created_at: isNaN(created.getTime()) ? new Date().toISOString() : created.toISOString(),
        });
        if (error) throw error;
        toast.success("Review added");
      } else {
        const created = new Date(`${date}T10:00:00`);
        const { error } = await supabase
          .from("product_reviews")
          .update({
            ...payload,
            is_verified: verified,
            ...(isNaN(created.getTime()) ? {} : { created_at: created.toISOString() }),
          })
          .eq("id", review!.id);
        if (error) throw error;
        toast.success("Review updated");
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isCreate ? "Add review" : "Edit review"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isCreate && (
            <div>
              <Label>Product *</Label>
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search products…"
                className="mt-1"
              />
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a product…</option>
                {filteredProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <Label>Customer name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Rating</Label>
              <div className="mt-1 flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    className="p-1"
                    aria-label={`${n} stars`}
                  >
                    <Star
                      className={`h-6 w-6 ${n <= rating ? "fill-warning text-warning" : "text-muted-foreground"}`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="cursor-pointer">Verified buyer badge</Label>
              <p className="text-xs text-muted-foreground">Shows a “Verified” tag on the storefront</p>
            </div>
            <Switch checked={verified} onCheckedChange={setVerified} />
          </div>

          <div>
            <Label>Title (optional)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </div>

          <div>
            <Label>Review text</Label>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={2000} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Photos & videos</Label>
              <span className="text-xs text-muted-foreground">{media.length} item{media.length === 1 ? "" : "s"}</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {media.map((m, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
                  {m.type === "video" ? (
                    <>
                      <video src={m.url} className="h-full w-full object-cover" muted playsInline />
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
                        <Play className="h-5 w-5 fill-white text-white" />
                      </div>
                    </>
                  ) : (
                    <img src={m.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  )}
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
                    aria-label="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-border bg-accent/40 text-muted-foreground hover:bg-accent"
              >
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
              </button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 h-8 px-2 text-xs"
              onClick={loadRecentUploads}
              disabled={loadingRecent}
            >
              {loadingRecent ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <History className="mr-1.5 h-3.5 w-3.5" />}
              Recover recent uploads
            </Button>
            {showRecent && !loadingRecent && (
              <div className="mt-2 rounded-md border p-2">
                <p className="mb-2 text-xs font-medium">Recent review uploads</p>
                {recentMedia.length ? (
                  <div className="grid max-h-44 grid-cols-4 gap-2 overflow-y-auto">
                    {recentMedia.map((item) => {
                      const selected = media.some((entry) => entry.url === item.url);
                      return (
                        <button
                          key={item.url}
                          type="button"
                          className="relative aspect-square overflow-hidden rounded-md border bg-muted disabled:opacity-40"
                          onClick={() => restoreUpload(item)}
                          disabled={selected}
                          title={selected ? "Already added" : "Add to this review"}
                        >
                          {item.type === "video" ? (
                            <>
                              <video src={item.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                              <Play className="pointer-events-none absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 fill-primary-foreground text-primary-foreground" />
                            </>
                          ) : (
                            <img src={item.url} alt="Recent review upload" className="h-full w-full object-cover" loading="lazy" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No recent uploads found.</p>
                )}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={onPickFiles}
              className="hidden"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || uploading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isCreate ? "Add review" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
