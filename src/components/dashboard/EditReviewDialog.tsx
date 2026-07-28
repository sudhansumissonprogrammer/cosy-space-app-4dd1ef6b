import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, X, Loader2, Plus, Play } from "lucide-react";
import { toast } from "sonner";
import { uploadReviewMedia, type ReviewMedia } from "@/lib/uploadReviewMedia";

interface ReviewRow {
  id: string;
  customer_name: string;
  rating: number;
  title: string | null;
  review_text: string | null;
  media: any;
}

interface Props {
  storeId: string;
  review: ReviewRow;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditReviewDialog({ storeId, review, onClose, onSaved }: Props) {
  const [name, setName] = useState(review.customer_name || "");
  const [rating, setRating] = useState(review.rating || 5);
  const [title, setTitle] = useState(review.title || "");
  const [text, setText] = useState(review.review_text || "");
  const [media, setMedia] = useState<ReviewMedia[]>(
    Array.isArray(review.media)
      ? review.media.filter((m: any) => m?.url).map((m: any) => ({ url: m.url, type: m.type === "video" ? "video" : "image" }))
      : []
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(review.customer_name || "");
    setRating(review.rating || 5);
    setTitle(review.title || "");
    setText(review.review_text || "");
  }, [review.id]);

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

  async function save() {
    if (!name.trim()) {
      toast.error("Customer name is required");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("product_reviews")
        .update({
          customer_name: name.trim().slice(0, 80),
          rating: Math.max(1, Math.min(5, Math.round(rating))),
          title: title.trim().slice(0, 120) || null,
          review_text: text.trim().slice(0, 2000) || null,
          media,
        })
        .eq("id", review.id);
      if (error) throw error;
      toast.success("Review updated");
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
          <DialogTitle>Edit review</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Customer name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>

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
                    className={`h-6 w-6 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
                  />
                </button>
              ))}
            </div>
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
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
